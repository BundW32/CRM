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
  | {
      ok: true;
      zeilen: GepruefteZeile[];
      /** Welche Spalte der Datei welches Feld füllt — für die Vorschau. */
      zuordnung: { feld: string; spalte: string }[];
      /** Stand keine Kopfzeile in der Datei? Dann wurde am Inhalt geraten. */
      geraten: boolean;
    }
  | { ok: false; fehler: Extract<RechnungenCsvFehler, { art: "leer" | "kopfzeile" | "zuviel" }> };

export const GRUND_TEXT: Record<"betrag" | "datum" | "bezeichnung", string> = {
  betrag: "Betrag nicht lesbar (Format: 1.250,00)",
  datum: "Datum nicht lesbar (Format: 14.03.2026)",
  bezeichnung: "weder Bezeichnung noch Rechnungsnummer noch Gläubiger",
};

export const MAX_RECHNUNGEN_JE_IMPORT = 500;

type Spalte = "faellig" | "datum" | "betrag" | "glaeubiger" | "nummer" | "bezeichnung" | "notiz";

export const SPALTEN_NAMEN: Record<Spalte, string> = {
  bezeichnung: "Bezeichnung",
  glaeubiger: "Gläubiger",
  betrag: "Betrag",
  datum: "Rechnungsdatum",
  faellig: "Fällig am",
  nummer: "Rechnungsnummer",
  notiz: "Notiz",
};

/**
 * Spaltenerkennung an der Kopfzeile — in Stufen, nicht in Reihenfolge der
 * Datei. Die erste Fassung nahm je Zelle den ersten passenden Namen und traf
 * in einer DATEV-artigen Liste „Nettobetrag" vor „Bruttobetrag", weil Netto
 * links stand: Der Import hätte 100 € statt 119 € eingetragen, und niemand
 * hätte es gesehen. Deshalb je Feld: erst die genauen Namen über die ganze
 * Kopfzeile, dann die allgemeinen — und für den Betrag ein Ausschluss, der
 * Netto, Steuer und Skonto nie zum Rechnungsbetrag macht.
 *
 * Reihenfolge der Felder = Vorrang beim Belegen: „Fällig" vor „Datum", weil
 * „Fälligkeitsdatum" sonst als Rechnungsdatum durchginge.
 */
const REGELN: { spalte: Spalte; stufen: RegExp[]; ausschluss?: RegExp }[] = [
  { spalte: "faellig", stufen: [/faellig|zahlbar bis|zahlungsziel|\bdue\b/] },
  {
    spalte: "datum",
    stufen: [/rechnungsdatum|belegdatum|invoice date|entstanden/, /^datum$|^date$|datum|\bdate\b/],
    ausschluss: /faellig|due|zahlbar|valuta|zahlung|buchung/,
  },
  {
    spalte: "betrag",
    stufen: [
      /brutto|gesamt|summe|total|zu zahlen|endbetrag|rechnungsbetrag|gross/,
      /betrag|amount|preis|price/,
    ],
    ausschluss: /netto|\bust\b|mwst|steuer|skonto|\bnet\b|\btax\b|\bvat\b|rabatt/,
  },
  {
    spalte: "glaeubiger",
    stufen: [
      /glaeubiger|lieferant|kreditor|rechnungssteller|zahlungsempfaenger|empfaenger|creditor|vendor|supplier|payee/,
      /firma|anbieter|kontakt|partner|^name$|company/,
    ],
  },
  {
    spalte: "nummer",
    stufen: [
      /rechnungsnr|rechnungsnummer|belegnr|belegnummer|rechnungs nr|beleg nr|invoice number|invoice no|^nr$|^nummer$|^number$|^no$/,
    ],
  },
  {
    spalte: "bezeichnung",
    stufen: [
      /bezeichnung|titel|beschreibung|verwendungszweck|leistung|betreff|gegenstand|description|subject/,
      /\btext\b|title|position/,
    ],
  },
  { spalte: "notiz", stufen: [/notiz|bemerkung|kommentar|anmerkung|\bnote|comment/] },
];

export function erkenneSpalten(header: string[]): Partial<Record<Spalte, number>> {
  const norm = header.map(normHeader);
  const zuordnung: Partial<Record<Spalte, number>> = {};
  const belegt = new Set<number>();
  for (const regel of REGELN) {
    for (const stufe of regel.stufen) {
      const i = norm.findIndex(
        (n, idx) => n && !belegt.has(idx) && stufe.test(n) && !regel.ausschluss?.test(n),
      );
      if (i >= 0) {
        zuordnung[regel.spalte] = i;
        belegt.add(i);
        break;
      }
    }
  }
  return zuordnung;
}

/**
 * Ohne Kopfzeile: die Spalten am Inhalt erkennen. Ein Datum sieht aus wie ein
 * Datum, ein Betrag wie ein Betrag — das reicht für die Pflichtfelder. Zwei
 * Datumsspalten: die mit den späteren Werten ist die Fälligkeit. Zwei
 * Betragsspalten: die mit den größeren Werten ist brutto. Von den Textspalten
 * wird die längste zur Bezeichnung, die zweite zum Gläubiger; eine kurze
 * Spalte aus Ziffern und Kürzeln ist die Rechnungsnummer.
 *
 * Die Vorschau zeigt die getroffene Zuordnung — wer sie sieht, kann sie
 * korrigieren, bevor etwas angelegt wird.
 */
export function rateSpaltenAusInhalt(rows: string[][]): Partial<Record<Spalte, number>> {
  const breite = Math.max(0, ...rows.map((r) => r.length));
  if (breite === 0 || rows.length === 0) return {};
  const zelleVon = (r: string[], i: number) => (r[i] ?? "").trim();
  const mind = Math.ceil(rows.length / 2);

  type Info = {
    i: number;
    daten: number;
    betraege: number;
    summe: number;
    textLaenge: number;
    woerter: number;
    firmenhaft: number;
    nummerhaft: number;
  };
  const FIRMA = /\b(GmbH|AG|KG|OHG|UG|GbR|mbH|e\.?\s?K\.?|e\.?\s?V\.?|Inh\.|& Co|SE|Stadtwerke|Meisterbetrieb|Ltd|Inc)\b/;
  const infos: Info[] = [];
  for (let i = 0; i < breite; i++) {
    const info: Info = { i, daten: 0, betraege: 0, summe: 0, textLaenge: 0, woerter: 0, firmenhaft: 0, nummerhaft: 0 };
    for (const r of rows) {
      const z = zelleVon(r, i);
      if (!z) continue;
      if (isoTagAus(z)) {
        info.daten++;
        continue;
      }
      const cents = parseSignedEuroToCents(z);
      if (cents !== null && /\d/.test(z)) {
        info.betraege++;
        info.summe += Math.abs(cents);
        continue;
      }
      info.textLaenge += z.length;
      info.woerter += z.split(/\s+/).length;
      if (FIRMA.test(z)) info.firmenhaft++;
      if (/^[A-Za-z]{0,4}[-/_]?\d[\w\-/.]*$/.test(z)) info.nummerhaft++;
    }
    infos.push(info);
  }

  const zuordnung: Partial<Record<Spalte, number>> = {};
  const datumSpalten = infos.filter((x) => x.daten >= mind).sort((a, b) => a.i - b.i);
  if (datumSpalten.length > 0) {
    let [erst, zweit] = datumSpalten;
    if (zweit) {
      // Die Fälligkeit liegt nach dem Rechnungsdatum — in der Mehrzahl der Zeilen.
      let spaeter = 0;
      for (const r of rows) {
        const a = isoTagAus(zelleVon(r, erst.i));
        const b = isoTagAus(zelleVon(r, zweit.i));
        if (a && b && b < a) spaeter--;
        else if (a && b && b > a) spaeter++;
      }
      if (spaeter < 0) [erst, zweit] = [zweit, erst];
      zuordnung.faellig = zweit.i;
    }
    zuordnung.datum = erst.i;
  }

  const betragSpalten = infos
    .filter((x) => x.betraege >= mind && x.i !== zuordnung.datum && x.i !== zuordnung.faellig)
    .sort((a, b) => b.summe - a.summe);
  if (betragSpalten.length > 0) zuordnung.betrag = betragSpalten[0].i;

  const belegt = new Set(Object.values(zuordnung));
  const textSpalten = infos
    .filter((x) => !belegt.has(x.i) && x.textLaenge > 0)
    .sort((a, b) => b.textLaenge - a.textLaenge);
  const nummer = textSpalten.find((x) => x.nummerhaft >= mind);
  if (nummer) {
    zuordnung.nummer = nummer.i;
    belegt.add(nummer.i);
  }
  // Gläubiger: die Spalte, die nach Firma aussieht (GmbH, Stadtwerke …).
  // Sonst: die Bezeichnung hat die meisten Wörter, bei Gleichstand die
  // linke Spalte — so steht es auch in der Vorlage.
  const rest = textSpalten.filter((x) => !belegt.has(x.i));
  const firma = [...rest].sort((a, b) => b.firmenhaft - a.firmenhaft || a.i - b.i)[0];
  if (firma && firma.firmenhaft > 0) {
    zuordnung.glaeubiger = firma.i;
    belegt.add(firma.i);
  }
  const uebrig = rest.filter((x) => !belegt.has(x.i)).sort((a, b) => b.woerter - a.woerter || a.i - b.i);
  if (uebrig[0]) zuordnung.bezeichnung = uebrig[0].i;
  if (uebrig[1] && zuordnung.glaeubiger === undefined) zuordnung.glaeubiger = uebrig[1].i;
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

  // Ohne Kopfzeile am Inhalt raten — die Vorschau zeigt, was geraten wurde.
  const geraten = !parsed.hasHeader;
  const spalten = geraten ? rateSpaltenAusInhalt(parsed.rows) : erkenneSpalten(parsed.header);
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
  const zuordnung = (Object.entries(spalten) as [Spalte, number][])
    .sort((a, b) => a[1] - b[1])
    .map(([feld, i]) => ({
      feld: SPALTEN_NAMEN[feld],
      spalte: geraten ? `Spalte ${i + 1}` : parsed.header[i] ?? `Spalte ${i + 1}`,
    }));
  return { ok: true, zeilen, zuordnung, geraten };
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
