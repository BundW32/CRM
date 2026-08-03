// KI-gestützte Objektdaten-Extraktion aus einem PDF (z. B. ERP-/Exposé-/
// Objektdatenblatt). Der Verwalter lädt beim Anlegen ein PDF hoch; die Felder
// werden per Google Gemini vorbefüllt und können vor dem Speichern geprüft/
// korrigiert werden.
//
// DSGVO: Wie bei Triage/Assistent werden Inhalte an Google (US) gesendet. Daher
// standardmäßig AUS – nur aktiv bei AI_OBJEKT_IMPORT_ENABLED="true" UND gesetztem
// GEMINI_API_KEY. Fehler blockieren nie das manuelle Anlegen.

export type ExtractedUnit = { label: string; floor?: string };

export type ExtractedObjekt = {
  name?: string;
  street?: string;
  zip?: string;
  city?: string;
  buildYear?: number;
  livingArea?: number;
  floors?: number;
  buildingType?: string;
  heatingType?: string;
  notes?: string;
  units?: ExtractedUnit[];
};

export function isObjektImportEnabled(): boolean {
  return process.env.AI_OBJEKT_IMPORT_ENABLED === "true" && Boolean(process.env.GEMINI_API_KEY);
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    street: { type: "string" },
    zip: { type: "string" },
    city: { type: "string" },
    buildYear: { type: "integer" },
    livingArea: { type: "number" },
    floors: { type: "integer" },
    buildingType: { type: "string" },
    heatingType: { type: "string" },
    notes: { type: "string" },
    units: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          floor: { type: "string" },
        },
      },
    },
  },
} as const;

const PROMPT =
  "Du extrahierst Stammdaten einer Immobilie aus dem beigefügten PDF (z. B. " +
  "Objektdatenblatt, Exposé oder ERP-Export einer Hausverwaltung). Gib nur Werte " +
  "zurück, die im Dokument tatsächlich stehen – erfinde nichts, lasse Unbekanntes " +
  "weg. Felder: name (Objektbezeichnung, sonst die Straße), street (Straße + " +
  "Hausnummer), zip (PLZ), city (Ort), buildYear (Baujahr als Zahl), livingArea " +
  "(Gesamtwohnfläche in m² als Zahl), floors (Anzahl Etagen als Zahl), " +
  "buildingType (Bauart, z. B. Mehrfamilienhaus), heatingType (Heizungsart), " +
  "notes (knappe sonstige Hinweise). units: Liste der Wohn-/Gewerbeeinheiten mit " +
  "label (Bezeichnung, z. B. 'WE 01') und optional floor (Etage), falls im " +
  "Dokument aufgeführt.";

function num(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v.replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function str(v: unknown, max = 200): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : undefined;
}

// Liefert die extrahierten Felder oder null (KI aus, Fehler, Timeout, kein PDF).
export async function extractObjektFromPdf(
  pdf: Buffer,
  mimeType: string,
): Promise<ExtractedObjekt | null> {
  if (!isObjektImportEnabled()) return null;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  if (mimeType !== "application/pdf") return null;
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
                { inline_data: { mime_type: "application/pdf", data: pdf.toString("base64") } },
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
    const unitsRaw = Array.isArray(raw.units) ? raw.units : [];
    const units: ExtractedUnit[] = unitsRaw
      .map((u) => {
        const label = str((u as Record<string, unknown>)?.label, 200);
        if (!label) return null;
        const floor = str((u as Record<string, unknown>)?.floor, 100);
        return floor ? { label, floor } : { label };
      })
      .filter((u): u is ExtractedUnit => u !== null)
      .slice(0, 100);

    const buildYear = num(raw.buildYear);
    const floors = num(raw.floors);
    return {
      name: str(raw.name),
      street: str(raw.street),
      zip: str(raw.zip, 20),
      city: str(raw.city),
      buildYear: buildYear != null ? Math.round(buildYear) : undefined,
      livingArea: num(raw.livingArea),
      floors: floors != null ? Math.round(floors) : undefined,
      buildingType: str(raw.buildingType),
      heatingType: str(raw.heatingType),
      notes: str(raw.notes, 2000),
      units,
    };
  } catch {
    return null;
  }
}
