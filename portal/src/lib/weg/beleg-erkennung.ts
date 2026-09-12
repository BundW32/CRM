// KI-Belegerkennung: Eine Rechnung als PDF oder Foto hochladen, die Felder der
// Verbindlichkeit (Gläubiger, Betrag, Rechnungsdatum, Fälligkeit, Bezeichnung)
// werden als **Vorschlag** vorbefüllt. Gespeichert wird nichts, bevor der
// Verwalter die Felder geprüft und das Formular abgeschickt hat.
//
// Gleiche Bauart wie der Objekt-Import (`lib/objekt-extraction.ts`): Die Datei
// geht **vollständig** an Google Gemini. Eine Rechnung enthält den Namen des
// Handwerkers, oft Namen von Eigentümern und eine IBAN — deshalb ist die
// Funktion standardmäßig AUS und braucht eine eigene Freigabe
// (AI_BELEG_ERKENNUNG_ENABLED), nicht die der anderen KI-Funktionen. Fehler
// blockieren nie das manuelle Erfassen: Ergebnis null heißt „von Hand".
//
// Was NICHT hinausgeht: nichts außer der Datei. Kein Objektname, keine
// Kostenarten, keine Einheit — der Vorschlag braucht davon nichts.

export type ErkannteRechnung = {
  /** Rechnungssteller, wie er auf dem Beleg steht. */
  creditor?: string;
  invoiceNumber?: string;
  /** ISO-Datum YYYY-MM-DD. */
  invoiceDate?: string;
  /** ISO-Datum YYYY-MM-DD. */
  dueDate?: string;
  /** Bruttobetrag in Cent, immer > 0. */
  grossCents?: number;
  /** Kurze Beschreibung der Leistung, z. B. „Dachreparatur nach Sturmschaden". */
  description?: string;
};

/** Dateitypen, die Gemini als `inline_data` liest — PDF und die üblichen Fotoformate. */
export const BELEG_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;

export function isBelegErkennungEnabled(): boolean {
  return process.env.AI_BELEG_ERKENNUNG_ENABLED === "true" && Boolean(process.env.GEMINI_API_KEY);
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    creditor: { type: "string" },
    invoiceNumber: { type: "string" },
    invoiceDate: { type: "string" },
    dueDate: { type: "string" },
    grossAmount: { type: "number" },
    description: { type: "string" },
  },
} as const;

const PROMPT =
  "Du liest eine Eingangsrechnung einer deutschen Wohnungseigentümergemeinschaft oder " +
  "Hausverwaltung (PDF oder Foto). Gib nur Werte zurück, die auf dem Beleg tatsächlich " +
  "stehen – erfinde nichts, lasse Unbekanntes weg. Felder: creditor (Rechnungssteller, " +
  "Firmenname ohne Anschrift), invoiceNumber (Rechnungsnummer), invoiceDate " +
  "(Rechnungsdatum als YYYY-MM-DD), dueDate (Fälligkeitsdatum als YYYY-MM-DD, falls " +
  "genannt; bei „zahlbar innerhalb von X Tagen“ vom Rechnungsdatum aus rechnen), " +
  "grossAmount (Rechnungsbetrag brutto in Euro als Zahl, Dezimalpunkt), description " +
  "(die abgerechnete Leistung in höchstens 80 Zeichen, z. B. „Dachreparatur nach " +
  "Sturmschaden“). Keine IBAN, keine Kontonummern.";

function str(v: unknown, max = 200): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : undefined;
}

/**
 * Datum aus der Antwort als ISO-Tag. Verlangt ist YYYY-MM-DD, aber ein Modell,
 * das den Beleg liest, gibt gelegentlich zurück, was dort steht: „14.03.2026".
 * Beides wird angenommen; alles andere wird verworfen statt geraten.
 */
export function isoTag(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) {
    const de = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (!de) return undefined;
    m = [de[0], de[3], de[2].padStart(2, "0"), de[1].padStart(2, "0")];
  }
  const [, j, mo, d] = m;
  const date = new Date(Date.UTC(Number(j), Number(mo) - 1, Number(d)));
  if (date.getUTCMonth() !== Number(mo) - 1 || date.getUTCDate() !== Number(d)) return undefined;
  if (Number(j) < 1990 || Number(j) > 2100) return undefined;
  return `${j}-${mo}-${d}`;
}

/** Bruttobetrag in Cent — akzeptiert Zahl oder Zeichenkette mit Komma. */
export function bruttoCents(v: unknown): number | undefined {
  let n: number | undefined;
  if (typeof v === "number") n = v;
  else if (typeof v === "string") {
    const s = v.replace(/\s|€|EUR/gi, "");
    // Deutsches Format (1.234,56) oder englisches (1,234.56): das letzte
    // Trennzeichen ist das Dezimalzeichen.
    const komma = s.lastIndexOf(",");
    const punkt = s.lastIndexOf(".");
    const norm =
      komma > punkt ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
    n = Number.parseFloat(norm);
  }
  if (n == null || !Number.isFinite(n) || n <= 0) return undefined;
  const cents = Math.round(n * 100);
  return cents > 0 ? cents : undefined;
}

/** Liefert die erkannten Felder oder null (KI aus, Fehler, Timeout, falscher Dateityp). */
export async function extractRechnung(
  datei: Buffer,
  mimeType: string,
): Promise<ErkannteRechnung | null> {
  if (!isBelegErkennungEnabled()) return null;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  if (!(BELEG_MIME_TYPES as readonly string[]).includes(mimeType)) return null;
  const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25000);
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inline_data: { mime_type: mimeType, data: datei.toString("base64") } },
                { text: PROMPT },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
          },
        }),
      },
    ).finally(() => clearTimeout(timer));

    if (!res.ok) return null;
    const data = await res.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    const raw = JSON.parse(text) as Record<string, unknown>;
    const ergebnis: ErkannteRechnung = {
      creditor: str(raw.creditor, 160),
      invoiceNumber: str(raw.invoiceNumber, 60),
      invoiceDate: isoTag(raw.invoiceDate),
      dueDate: isoTag(raw.dueDate),
      grossCents: bruttoCents(raw.grossAmount),
      description: str(raw.description, 120),
    };
    // Ein Ergebnis ohne jeden Wert ist keins — dann lieber „von Hand" als ein
    // leeres „übernommen".
    return Object.values(ergebnis).some((v) => v !== undefined) ? ergebnis : null;
  } catch {
    return null;
  }
}

/**
 * Bezeichnung der Verbindlichkeit aus dem Erkannten: „Rechnung 2026-114,
 * Dachreparatur" — dieselbe Form, die der Platzhalter des Formulars vorschlägt.
 */
export function vorschlagBezeichnung(r: ErkannteRechnung): string {
  const teile: string[] = [];
  if (r.invoiceNumber) teile.push(`Rechnung ${r.invoiceNumber}`);
  if (r.description) teile.push(r.description);
  if (teile.length === 0 && r.creditor) teile.push(`Rechnung ${r.creditor}`);
  return teile.join(", ").slice(0, 200);
}
