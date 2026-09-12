// CSV-Import von Eingangsrechnungen als Verbindlichkeiten.
//
// Wer seine Rechnungen schon in einer Tabelle führt — oder sie aus einer
// anderen Verwaltersoftware herausbekommt —, soll sie nicht abtippen müssen.
// Erwartet wird eine Kopfzeile; die Spalten werden an ihren Namen erkannt, in
// beliebiger Reihenfolge, wie beim Bankimport. Pflicht sind ein Betrag, ein
// Rechnungsdatum und irgendetwas, das den Posten benennt (Bezeichnung,
// Rechnungsnummer oder Gläubiger).
//
// Geprüft wird die ganze Datei, bevor etwas gespeichert wird: Jede Zeile
// bekommt ihr Ergebnis (lesbar oder Grund), die Oberfläche zeigt das als
// Vorschau, und erst die Bestätigung legt an. So sieht die Verwaltung vorher,
// was passiert — und eine fehlerhafte Zeile blockiert nicht die 40 guten.
import { decodeBankFile, normHeader, parseCsv, parseSignedEuroToCents } from "./bank-import";

export type RechnungZeile = {
  /** 1-basierte Zeilennummer in der Datei (Kopfzeile mitgezählt) — für Fehlermeldungen. */
  zeile: number;
  title: string;
  creditor: string | null;
  amountCents: number;
  /** ISO-Tag YYYY-MM-DD. */
  incurredOn: string;
  dueDate: string | null;
  note: string | null;
};

export type RechnungenCsvFehler =
  | { art: "leer" }
  | { art: "kopfzeile"; fehlt: ("betrag" | "datum" | "bezeichnung")[] }
  | { art: "betrag" | "datum" | "bezeichnung"; zeile: number }
  | { art: "zuviel"; maximum: number };

export type RechnungenCsvErgebnis =
  | { ok: true; zeilen: RechnungZeile[] }
  | { ok: false; fehler: RechnungenCsvFehler };

/** Eine geprüfte Zeile — lesbar mit Daten, oder unlesbar mit Grund. */
export type GepruefteZeile =
  | { zeile: number; ok: true; daten: RechnungZeile }
  | { zeile: number; ok: false; grund: "betrag" | "datum" | "bezeichnung"; roh: string };

export type RechnungenPruefung =
  | { ok: true; zeilen: GepruefteZeile[] }
  | { ok: false; fehler: Extract<RechnungenCsvFehler, { art: "leer" | "kopfzeile" | "zuviel" }> };

export const GRUND_TEXT: Record<"betrag" | "datum" | "bezeichnung", string> = {
  betrag: "Betrag nicht lesbar (Format: 1.250,00)",
  datum: "Datum nicht lesbar (Format: 14.03.2026)",
  bezeichnung: "weder Bezeichnung noch Rechnungsnummer noch Gläubiger",
};

export const MAX_RECHNUNGEN_JE_IMPORT = 500;

// Reihenfolge = Vorrang. „Fällig" steht vor „Datum", weil „Fälligkeitsdatum"
// sonst als Rechnungsdatum durchginge.
type Spalte = "faellig" | "datum" | "betrag" | "glaeubiger" | "nummer" | "bezeichnung" | "notiz";

const MUSTER: [Spalte, RegExp][] = [
  ["faellig", /faellig|zahlbar bis|zahlungsziel/],
  ["datum", /rechnungsdatum|belegdatum|entstanden|^datum$|datum/],
  ["betrag", /brutto|rechnungsbetrag|^betrag|betrag$|gesamt|summe|amount/],
  ["glaeubiger", /glaeubiger|lieferant|kreditor|rechnungssteller|zahlungsempfaenger|empfaenger|firma|anbieter|creditor/],
  ["nummer", /rechnungsnr|rechnungsnummer|belegnr|belegnummer|rechnungs nr|beleg nr|^nr$|^nummer$/],
  ["bezeichnung", /bezeichnung|titel|beschreibung|verwendungszweck|leistung|betreff|gegenstand|text/],
  ["notiz", /notiz|bemerkung|kommentar|anmerkung/],
];

export function erkenneSpalten(header: string[]): Partial<Record<Spalte, number>> {
  const zuordnung: Partial<Record<Spalte, number>> = {};
  header.forEach((h, i) => {
    const n = normHeader(h);
    if (!n) return;
    for (const [spalte, muster] of MUSTER) {
      if (zuordnung[spalte] !== undefined) continue;
      if (muster.test(n)) {
        zuordnung[spalte] = i;
        return;
      }
    }
  });
  return zuordnung;
}

/** dd.mm.yyyy, dd.mm.yy oder yyyy-mm-dd → ISO-Tag; sonst null. */
export function isoTagAus(input: string): string | null {
  const t = input.trim();
  let j: number, m: number, d: number;
  let match = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
  if (match) {
    d = Number(match[1]);
    m = Number(match[2]);
    j = Number(match[3]);
    if (j < 100) j += j >= 70 ? 1900 : 2000;
  } else {
    match = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    j = Number(match[1]);
    m = Number(match[2]);
    d = Number(match[3]);
  }
  const probe = new Date(Date.UTC(j, m - 1, d));
  if (probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return null;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${j}-${p(m)}-${p(d)}`;
}

const zelle = (row: string[], i: number | undefined): string =>
  i === undefined ? "" : (row[i] ?? "").trim();

/** Prüft die ganze Datei und liefert jede Zeile mit Ergebnis — Grundlage der Vorschau. */
export function pruefeRechnungenCsv(bytes: Uint8Array): RechnungenPruefung {
  const { text } = decodeBankFile(bytes);
  const parsed = parseCsv(text);
  if (parsed.rows.length === 0 && parsed.header.length === 0) return { ok: false, fehler: { art: "leer" } };

  const spalten = erkenneSpalten(parsed.header);
  const fehlt: ("betrag" | "datum" | "bezeichnung")[] = [];
  if (spalten.betrag === undefined) fehlt.push("betrag");
  if (spalten.datum === undefined) fehlt.push("datum");
  if (
    spalten.bezeichnung === undefined &&
    spalten.nummer === undefined &&
    spalten.glaeubiger === undefined
  ) {
    fehlt.push("bezeichnung");
  }
  if (fehlt.length > 0) return { ok: false, fehler: { art: "kopfzeile", fehlt } };

  // Leere Zeilen am Ende (Excel hängt sie gern an) zählen nicht.
  const daten = parsed.rows.filter((r) => r.some((c) => c.trim() !== ""));
  if (daten.length === 0) return { ok: false, fehler: { art: "leer" } };
  if (daten.length > MAX_RECHNUNGEN_JE_IMPORT) {
    return { ok: false, fehler: { art: "zuviel", maximum: MAX_RECHNUNGEN_JE_IMPORT } };
  }

  const zeilen: GepruefteZeile[] = [];
  for (const [i, row] of daten.entries()) {
    // Zeilennummer wie im Editor: Vorspann + Kopfzeile + Index.
    const zeile = parsed.skippedBefore + (parsed.hasHeader ? 1 : 0) + i + 1;
    const roh = row.filter((c) => c.trim()).join(" · ").slice(0, 120);
    const fehler = (grund: "betrag" | "datum" | "bezeichnung"): GepruefteZeile => ({ zeile, ok: false, grund, roh });

    const cents = parseSignedEuroToCents(zelle(row, spalten.betrag));
    if (cents === null || cents === 0) {
      zeilen.push(fehler("betrag"));
      continue;
    }
    const incurredOn = isoTagAus(zelle(row, spalten.datum));
    if (!incurredOn) {
      zeilen.push(fehler("datum"));
      continue;
    }
    const faelligRoh = zelle(row, spalten.faellig);
    const dueDate = faelligRoh ? isoTagAus(faelligRoh) : null;
    if (faelligRoh && !dueDate) {
      zeilen.push(fehler("datum"));
      continue;
    }

    const bezeichnung = zelle(row, spalten.bezeichnung);
    const nummer = zelle(row, spalten.nummer);
    const glaeubiger = zelle(row, spalten.glaeubiger);
    const title = (
      bezeichnung ||
      (nummer ? `Rechnung ${nummer}` : "") ||
      (glaeubiger ? `Rechnung ${glaeubiger}` : "")
    ).slice(0, 200);
    if (title.length < 2) {
      zeilen.push(fehler("bezeichnung"));
      continue;
    }

    // Die Rechnungsnummer geht nicht verloren, wenn sie nicht schon im Titel steht.
    const notizTeile: string[] = [];
    if (nummer && !title.includes(nummer)) notizTeile.push(`Rechnungsnr. ${nummer}`);
    const notiz = zelle(row, spalten.notiz);
    if (notiz) notizTeile.push(notiz);

    zeilen.push({
      zeile,
      ok: true,
      daten: {
        zeile,
        title,
        creditor: glaeubiger ? glaeubiger.slice(0, 160) : null,
        // Ein Betrag mit Minus ist in einer Rechnungsliste eine Gutschrift — die
        // gehört nicht in die Verbindlichkeiten. Wir nehmen den Betrag, wie er
        // ist, absolut: Wer Gutschriften führt, führt sie woanders.
        amountCents: Math.abs(cents),
        incurredOn,
        dueDate,
        note: notizTeile.length > 0 ? notizTeile.join(" · ").slice(0, 1000) : null,
      },
    });
  }
  return { ok: true, zeilen };
}

/**
 * Alles-oder-nichts-Sicht auf dieselbe Prüfung: die erste unlesbare Zeile als
 * Fehler, sonst alle Daten. Für Aufrufer ohne Vorschau.
 */
export function parseRechnungenCsv(bytes: Uint8Array): RechnungenCsvErgebnis {
  const p = pruefeRechnungenCsv(bytes);
  if (!p.ok) return p;
  const erste = p.zeilen.find((z) => !z.ok);
  if (erste && !erste.ok) return { ok: false, fehler: { art: erste.grund, zeile: erste.zeile } };
  return { ok: true, zeilen: p.zeilen.flatMap((z) => (z.ok ? [z.daten] : [])) };
}

/** Die Kopfzeile, die die Vorlage trägt — Spaltennamen, die der Import sicher erkennt. */
export const VORLAGE_KOPF = ["Bezeichnung", "Gläubiger", "Betrag", "Rechnungsdatum", "Fällig am", "Rechnungsnummer", "Notiz"];
export const VORLAGE_BEISPIEL = [
  "Dachreparatur nach Sturmschaden",
  "Dachdeckerei Müller GmbH",
  "1.250,00",
  "14.03.2026",
  "28.03.2026",
  "2026-114",
  "Beschluss TOP 4",
];
