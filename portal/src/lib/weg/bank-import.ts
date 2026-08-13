// CSV-Bankimport (manueller Adapter, Zero-Key): Zeichensatz-Erkennung, Parser,
// Spalten-Mapping über Kopfzeile **und** Inhalt, Duplikat-Hash. Pure Funktionen —
// das eigentliche Schreiben in die DB übernimmt die Server Action.
// Adapter-Prinzip: ein späterer Open-Banking-Adapter liefert dieselben
// ParsedBooking-Objekte und dockt an derselben Stelle an.
//
// Die Erkennung darf **nichts** voraussetzen, was eine echte Bankdatei nicht
// hält. Eine Volksbank-Datei aus dem Internet-Banking hat weder eine Kopfzeile
// noch UTF-8; ein Sparkassen-Export stellt der Kopfzeile Titel- und
// Zeitraumzeilen voran. Wer die erste Zeile kompromisslos als Kopfzeile nimmt,
// verliert im ersten Fall still die erste Buchung des Jahres — und das fällt
// niemandem auf.
import crypto from "crypto";
import type { BookingKind } from "@/generated/prisma/client";

export type RawRow = string[];

export type ColumnMapping = {
  date: number;
  /**
   * Spalte mit vorzeichenbehaftetem Betrag. Entfällt bei getrennten
   * Soll-/Haben-Spalten — dann tragen `debit`/`credit` das Vorzeichen.
   */
  amount?: number;
  /** Getrennte Soll-Spalte (Belastung; der Betrag steht dort ohne Vorzeichen). */
  debit?: number;
  /** Getrennte Haben-Spalte (Gutschrift). */
  credit?: number;
  purpose: number;
  counterparty?: number;
};

/** Trägt das Mapping alles, was `mapRows` braucht? */
export function mappingComplete(m: Partial<ColumnMapping>): m is ColumnMapping {
  if (m.date === undefined || m.purpose === undefined) return false;
  return m.amount !== undefined || m.debit !== undefined || m.credit !== undefined;
}

// ── Zeichensatz ──────────────────────────────────────────────────────────────
//
// Bankdateien kommen in drei Kodierungen: UTF-8 (mit oder ohne BOM), UTF-16
// (aus Excel-Umwegen, immer mit BOM) und Windows-1252 (der Normalfall bei
// älteren Online-Banking-Exporten). Fest UTF-8 zu dekodieren zerstört jede
// Datei der dritten Gruppe: Aus „Augenärzte" wird „Augen<?>rzte", und das
// trifft ausgerechnet Zahlungspartner und Verwendungszweck — die beiden
// Felder, über die später die Einheiten-Zuordnung läuft.
//
// Windows-1252, nicht ISO-8859-1: Nur CP1252 belegt 0x80–0x9F, und dort liegt
// unter anderem das Euro-Zeichen (0x80). In UTF-8 ist dieses Byte überhaupt
// nicht gültig — es ist damit zugleich das verlässlichste Erkennungsmerkmal.

export type Zeichensatz = "utf-8" | "utf-8-bom" | "utf-16le" | "utf-16be" | "windows-1252";

export const ZEICHENSATZ_LABEL: Record<Zeichensatz, string> = {
  "utf-8": "UTF-8",
  "utf-8-bom": "UTF-8 (mit BOM)",
  "utf-16le": "UTF-16 LE",
  "utf-16be": "UTF-16 BE",
  "windows-1252": "Windows-1252",
};

// 0x80–0x9F: der Bereich, in dem sich CP1252 und ISO-8859-1 unterscheiden.
// 0xFFFD steht für die fünf in CP1252 nicht belegten Stellen.
const CP1252_HIGH = [
  0x20ac, 0xfffd, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021,
  0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0xfffd, 0x017d, 0xfffd,
  0xfffd, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
  0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0xfffd, 0x017e, 0x0178,
];

function decodeCp1252(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) {
    out += b >= 0x80 && b <= 0x9f ? String.fromCharCode(CP1252_HIGH[b - 0x80]) : String.fromCharCode(b);
  }
  return out;
}

/**
 * Dekodiert die hochgeladenen Bytes und meldet, welcher Zeichensatz erkannt
 * wurde. Die Angabe wandert bis in die Oberfläche: Wer sieht, dass
 * „Windows-1252" gelesen wurde, kann eine Fehldeutung erkennen — sonst rät er.
 */
export function decodeBankFile(bytes: Uint8Array): { text: string; encoding: Zeichensatz } {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { text: new TextDecoder("utf-8").decode(bytes.subarray(3)), encoding: "utf-8-bom" };
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { text: new TextDecoder("utf-16le").decode(bytes.subarray(2)), encoding: "utf-16le" };
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    // UTF-16BE: Node kennt den Decoder nicht durchgängig — Bytepaare tauschen
    // und als LE lesen ist gleichwertig und hängt an keiner ICU-Ausbaustufe.
    const rest = bytes.subarray(2);
    const swapped = new Uint8Array(rest.length - (rest.length % 2));
    for (let i = 0; i + 1 < rest.length; i += 2) {
      swapped[i] = rest[i + 1];
      swapped[i + 1] = rest[i];
    }
    return { text: new TextDecoder("utf-16le").decode(swapped), encoding: "utf-16be" };
  }
  try {
    // `fatal` ist der Punkt: Ohne ihn ersetzt der Decoder ungültige Bytes still
    // durch U+FFFD, und die Datei sieht danach gelesen aus.
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (!text.includes("�")) return { text, encoding: "utf-8" };
  } catch {
    // fällt auf CP1252 durch
  }
  return { text: decodeCp1252(bytes), encoding: "windows-1252" };
}

// ── Parser ───────────────────────────────────────────────────────────────────

export type ParsedCsv = {
  /** Spaltennamen. Ohne Kopfzeile synthetisch: „Spalte 1" … „Spalte n". */
  header: string[];
  /** Nur Datensätze. Ohne Kopfzeile sind das **alle** Zeilen der Datei. */
  rows: RawRow[];
  /** Stand in der Datei wirklich eine Kopfzeile? */
  hasHeader: boolean;
  delimiter: string;
  /** Übersprungene Zeilen vor der Kopfzeile (Titel, Zeitraum, Konto). */
  skippedBefore: number;
  /** Die ersten Rohzeilen, unverändert — Grundlage der Anzeige im Assistenten. */
  rawLines: string[];
};

const DELIMITERS = [";", ",", "\t", "|"];

// RFC-4180-naher CSV-Parser: Anführungszeichen mit "" -Escaping, \r\n und \n.
// Keine externe Dependency nötig — Bank-CSVs sind flach und klein.
function splitRows(text: string, delimiter: string): RawRow[] {
  const rows: RawRow[] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field.trim());
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field.trim());
      field = "";
      if (row.some((c) => c !== "")) rows.push(row); // Leerzeilen überspringen
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field.trim());
  if (row.some((c) => c !== "")) rows.push(row);
  return rows;
}

/** Häufigste Feldanzahl und ihr Anteil — das Maß für „passt dieses Trennzeichen". */
function modalFieldCount(rows: RawRow[]): { fields: number; share: number } {
  const counts = new Map<number, number>();
  for (const r of rows) counts.set(r.length, (counts.get(r.length) ?? 0) + 1);
  let fields = 0;
  let best = 0;
  for (const [len, n] of counts) {
    if (n > best || (n === best && len > fields)) {
      fields = len;
      best = n;
    }
  }
  return { fields, share: rows.length === 0 ? 0 : best / rows.length };
}

function firstLines(text: string, count: number): string {
  let idx = -1;
  for (let n = 0; n < count; n++) {
    const next = text.indexOf("\n", idx + 1);
    if (next === -1) return text;
    idx = next;
  }
  return text.slice(0, idx);
}

/**
 * Trennzeichen über **mehrere** Zeilen bestimmen, nicht über die erste.
 *
 * Eine vorangestellte Titelzeile („Umsatzanzeige") enthält kein Semikolon.
 * Wer nur sie befragt, kippt auf das Komma — und danach ist die ganze Datei
 * eine einzige Spalte, in der nichts mehr zu erkennen ist.
 */
export function detectDelimiter(text: string): string {
  const probe = firstLines(text, 30);
  let best = ";";
  let bestScore = -1;
  for (const d of DELIMITERS) {
    const rows = splitRows(probe, d);
    if (rows.length === 0) continue;
    const { fields, share } = modalFieldCount(rows);
    if (fields < 2) continue;
    const score = fields * share;
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

export function parseCsv(content: string): ParsedCsv {
  // BOM entfernen (bleibt stehen, wenn der Text nicht über decodeBankFile kam)
  const text = content.replace(/^﻿/, "");
  const delimiter = detectDelimiter(text);
  const rawLines = firstLines(text, 3).split(/\r?\n/).filter((l) => l !== "").slice(0, 3);
  const all = splitRows(text, delimiter);
  if (all.length === 0) {
    return { header: [], rows: [], hasHeader: false, delimiter, skippedBefore: 0, rawLines };
  }

  const headerIndex = findHeaderIndex(all);
  if (headerIndex === -1) {
    const { fields } = modalFieldCount(all);
    const spalten = Math.max(fields, ...all.map((r) => r.length));
    return {
      header: Array.from({ length: spalten }, (_, i) => `Spalte ${i + 1}`),
      rows: all,
      hasHeader: false,
      delimiter,
      skippedBefore: 0,
      rawLines,
    };
  }
  return {
    header: all[headerIndex],
    rows: all.slice(headerIndex + 1),
    hasHeader: true,
    delimiter,
    skippedBefore: headerIndex,
    rawLines,
  };
}

const HEADER_SUCHTIEFE = 15;

/**
 * Sucht die Kopfzeile, statt sie anzunehmen.
 *
 * Zwei Fälle, die beide vorkommen und beide bisher schiefgingen:
 * - **Kopfzeile nicht in Zeile 1.** Sparkassen-Internetbanking stellt Titel-
 *   und Zeitraumzeilen voran. Gesucht wird deshalb in den ersten Zeilen die
 *   mit den meisten bekannten Spaltennamen.
 * - **Gar keine Kopfzeile.** Trifft keine Zeile einen bekannten Spaltennamen
 *   und lässt sich die erste zugleich als Datensatz lesen (Datum **und**
 *   Betrag parsen), dann ist sie keine Kopfzeile, sondern die erste Buchung.
 *
 * Rückgabe −1 heißt: keine Kopfzeile, alle Zeilen sind Daten.
 */
export function findHeaderIndex(rows: RawRow[]): number {
  let best = -1;
  let bestScore = 0;
  const tiefe = Math.min(rows.length, HEADER_SUCHTIEFE);
  for (let i = 0; i < tiefe; i++) {
    const score = headerScore(rows[i]);
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  if (bestScore > 0) return best;
  // Kein bekannter Spaltenname in Sicht: Nur wenn die erste Zeile als Datensatz
  // durchgeht, ist „ohne Kopfzeile" belegt. Sonst bleibt es beim Bisherigen —
  // eine unbekannte Kopfzeile ist wahrscheinlicher als eine unlesbare Buchung.
  return leseBarAlsDatensatz(rows[0]) ? -1 : 0;
}

/** Wie viele Zellen dieser Zeile sehen aus wie bekannte Spaltennamen? */
export function headerScore(row: RawRow): number {
  let score = 0;
  for (const cell of row) {
    if (!cell || cell.length > 40) continue;
    // Ein Wert ist kein Spaltenname: „02.01.2023" und „-583,10" zählen nie mit.
    if (parseGermanDate(cell) !== null || parseSignedEuroToCents(cell) !== null) continue;
    const n = normHeader(cell);
    if (ALLE_MUSTER.some((p) => p.test(n))) score++;
  }
  return score;
}

function leseBarAlsDatensatz(row: RawRow | undefined): boolean {
  if (!row || row.length < 2) return false;
  const hatDatum = row.some((c) => parseGermanDate(c) !== null);
  const hatBetrag = row.some((c) => parseSignedEuroToCents(c) !== null && /[,.]\d{2}$/.test(c.trim()));
  return hatDatum && hatBetrag;
}

// ── Spalten raten ────────────────────────────────────────────────────────────

/**
 * Normalisiert einen Spaltennamen: Kleinschreibung, Umlaute ausgeschrieben
 * (ä/ae, ö/oe, ü/ue, ß/ss), Trennzeichen zu Leerraum. Erst dadurch trifft
 * dasselbe Muster „Begünstigter" und „Beguenstigter" — beide Schreibweisen
 * kommen in echten Exporten vor, je nach Zeichensatz sogar in derselben Bank.
 */
export function normHeader(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[._\-/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Reihenfolge = Vorrang. „Buchungstag" schlägt „Valutadatum", „Verwendungszweck"
// schlägt „Buchungstext" — beides steht in Sparkassen-Exporten nebeneinander.
const SPALTEN_MUSTER: Record<"date" | "amount" | "debit" | "credit" | "purpose" | "counterparty", RegExp[]> = {
  date: [
    /^buchungstag$/,
    /buchungstag/,
    /buchungsdatum/,
    // ING nennt die Spalte schlicht „Buchung" und daneben „Valuta". Ohne diese
    // Zeile gewinnt die Valuta — ein Datum, das ein bis zwei Tage danebenliegt.
    /^buchung$/,
    /^datum$/,
    /^belegdatum$/,
    /^valuta( ?datum)?$/,
    /valutadatum/,
    /wertstellung/,
  ],
  amount: [
    /^betrag$/,
    /^betrag in eur/,
    /^umsatz in eur/,
    /^umsatz$/,
    /^wert$/,
    /^betrag/,
    /betrag \(/,
    /betrag/,
  ],
  debit: [/^soll$/, /^soll /, /^belastung/, /^abgang/],
  credit: [/^haben$/, /^gutschrift/, /^zugang/],
  // Kein bloßes /^vorgang/: Bei comdirect ist „Vorgang" die *Umsatzart*
  // („Übertrag", „Lastschrift"), der Zweck steht in „Buchungstext". Die
  // zusammengesetzte Sparkassen-Spalte „Vorgang/Verwendungszweck" trifft
  // ohnehin schon das erste Muster.
  purpose: [/verwendungszweck/, /^vwz/, /^verwendung/, /buchungstext/, /umsatzart/],
  counterparty: [
    /beguenstigter/,
    /zahlungsempfaenger/,
    /zahlungspflichtiger/,
    /zahlungsbeteiligter/,
    /zahlungspartner/,
    // „Auftraggeberkonto" ist das *eigene* Konto, nicht die Gegenseite — die
    // Commerzbank führt es gleich zweimal. Ein konstanter Wert als
    // Zahlungspartner macht jeden Vorschlag daraus wertlos.
    /auftraggeber(?!konto)/,
    /empfaenger(?!konto)/,
    /^name/,
  ],
};

const ALLE_MUSTER = Object.values(SPALTEN_MUSTER).flat();

/**
 * Rät das Spalten-Mapping anhand typischer deutscher Bank-Header (Sparkasse
 * CSV-CAMT, Volksbank/VR, DATEV-nahe und generische Exporte).
 */
export function guessMapping(header: string[]): Partial<ColumnMapping> {
  const norm = header.map(normHeader);
  const find = (patterns: RegExp[]) => {
    for (const p of patterns) {
      const idx = norm.findIndex((h) => p.test(h));
      if (idx !== -1) return idx;
    }
    return undefined;
  };
  const mapping: Partial<ColumnMapping> = {};
  const date = find(SPALTEN_MUSTER.date);
  const amount = find(SPALTEN_MUSTER.amount);
  const purpose = find(SPALTEN_MUSTER.purpose);
  const counterparty = find(SPALTEN_MUSTER.counterparty);
  if (date !== undefined) mapping.date = date;
  if (purpose !== undefined) mapping.purpose = purpose;
  if (counterparty !== undefined) mapping.counterparty = counterparty;
  if (amount !== undefined) {
    mapping.amount = amount;
    return mapping;
  }
  // Kein Feld „Betrag": manche Volksbank- und DATEV-nahen Exporte führen
  // stattdessen „Soll" und „Haben". Beide Spalten zusammen ergeben denselben
  // vorzeichenbehafteten Betrag — die Spalte selbst ist das Vorzeichen.
  const debit = find(SPALTEN_MUSTER.debit);
  const credit = find(SPALTEN_MUSTER.credit);
  if (debit !== undefined) mapping.debit = debit;
  if (credit !== undefined) mapping.credit = credit;
  return mapping;
}

type SpaltenStatistik = {
  nonEmpty: number;
  datumTreffer: number;
  betragTreffer: number;
  dezimal: number;
  mitLeerzeichen: number;
  laengeSumme: number;
  datumSumme: number;
};

/**
 * Rät das Mapping aus dem **Inhalt** der ersten Datenzeilen.
 *
 * Kein Notnagel, sondern der gleichwertige zweite Weg: Eine Datei ohne
 * Kopfzeile hat keine Spaltennamen, und eine mit unbekannten Namen ist nicht
 * besser dran. Abgetastet wird, welche Spalte durchgängig als Datum parst
 * (bei zweien ist die frühere der Buchungstag, die zweite die Valuta), welche
 * durchgängig als vorzeichenbehafteter Betrag, und welche die längste
 * Textspalte ist — das ist der Verwendungszweck, die zweitlängste der
 * Zahlungspartner.
 */
export function guessMappingFromRows(rows: RawRow[], sampleSize = 20): Partial<ColumnMapping> {
  const probe = rows.slice(0, sampleSize).filter((r) => r.length > 1);
  if (probe.length === 0) return {};
  const spalten = Math.max(...probe.map((r) => r.length));
  const stats: SpaltenStatistik[] = Array.from({ length: spalten }, () => ({
    nonEmpty: 0,
    datumTreffer: 0,
    betragTreffer: 0,
    dezimal: 0,
    mitLeerzeichen: 0,
    laengeSumme: 0,
    datumSumme: 0,
  }));

  for (const row of probe) {
    for (let c = 0; c < spalten; c++) {
      const cell = (row[c] ?? "").trim();
      if (cell === "") continue;
      const s = stats[c];
      s.nonEmpty++;
      s.laengeSumme += cell.length;
      if (/\s/.test(cell)) s.mitLeerzeichen++;
      const datum = parseGermanDate(cell);
      if (datum) {
        s.datumTreffer++;
        s.datumSumme += datum.getTime();
        continue;
      }
      if (parseSignedEuroToCents(cell) !== null) {
        s.betragTreffer++;
        if (/[,.]\d{2}$/.test(cell) || /^[+\-−]/.test(cell)) s.dezimal++;
      }
    }
  }

  const genug = Math.max(1, Math.ceil(probe.length * 0.8));
  const istDatum = (s: SpaltenStatistik) => s.nonEmpty >= genug && s.datumTreffer === s.nonEmpty;
  const istBetrag = (s: SpaltenStatistik) =>
    s.nonEmpty >= genug && s.betragTreffer === s.nonEmpty && s.dezimal >= s.nonEmpty * 0.5;

  const mapping: Partial<ColumnMapping> = {};

  // Datum: bei zwei Datumsspalten ist die im Mittel frühere der Buchungstag,
  // die spätere die Wertstellung.
  const datumsSpalten = stats
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => istDatum(s))
    .sort((a, b) => a.s.datumSumme - b.s.datumSumme || a.i - b.i);
  if (datumsSpalten.length > 0) mapping.date = datumsSpalten[0].i;

  const betragsSpalten = stats
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => istBetrag(s))
    .sort((a, b) => b.s.dezimal / b.s.nonEmpty - a.s.dezimal / a.s.nonEmpty || a.i - b.i);
  if (betragsSpalten.length > 0) mapping.amount = betragsSpalten[0].i;

  // Textspalten: erst die mit echtem Fließtext (Leerzeichen), dann nach Länge.
  // Ohne die erste Stufe gewinnt eine Referenznummer konstanter Länge gegen den
  // Zahlungspartner — sie ist im Zweifel länger und trägt trotzdem nichts.
  const belegt = new Set<number>([
    ...datumsSpalten.map((d) => d.i),
    ...betragsSpalten.map((b) => b.i),
  ]);
  const textSpalten = stats
    .map((s, i) => ({ s, i }))
    .filter(
      ({ s, i }) =>
        !belegt.has(i) &&
        // Eine Spalte, in der überhaupt Beträge oder Daten stehen, ist kein
        // Text — auch wenn sie zu dünn besetzt ist, um als Betragsspalte zu
        // gelten (eine Haben-Spalte ist in der Hälfte der Zeilen leer).
        s.betragTreffer === 0 &&
        s.datumTreffer === 0 &&
        s.nonEmpty >= probe.length * 0.5 &&
        s.laengeSumme / s.nonEmpty >= 3,
    )
    .sort((a, b) => {
      const wortA = a.s.mitLeerzeichen / a.s.nonEmpty >= 0.5 ? 1 : 0;
      const wortB = b.s.mitLeerzeichen / b.s.nonEmpty >= 0.5 ? 1 : 0;
      if (wortA !== wortB) return wortB - wortA;
      return b.s.laengeSumme / b.s.nonEmpty - a.s.laengeSumme / a.s.nonEmpty || a.i - b.i;
    });
  if (textSpalten.length > 0) mapping.purpose = textSpalten[0].i;
  if (textSpalten.length > 1) mapping.counterparty = textSpalten[1].i;
  return mapping;
}

/**
 * Das Mapping für eine geparste Datei: Kopfzeile zuerst, Inhalt füllt die
 * Lücken. Beide Wege zusammen decken auch die Datei ab, die eine Kopfzeile hat,
 * aber mit unbekannten Namen — dort trägt die Kopfzeile, was sie kann, und der
 * Rest kommt aus den Werten.
 */
export function detectMapping(parsed: ParsedCsv): Partial<ColumnMapping> {
  const ausKopf = parsed.hasHeader ? guessMapping(parsed.header) : {};
  const ausInhalt = guessMappingFromRows(parsed.rows);
  const roh: Partial<ColumnMapping> = { ...ausInhalt, ...ausKopf };
  // Ein Betrag aus der Kopfzeile schlägt die Soll/Haben-Vermutung des Inhalts
  // und umgekehrt — beides zusammen wäre doppelt gezählt.
  if (roh.amount !== undefined) {
    delete roh.debit;
    delete roh.credit;
  }
  // Keine Spalte zweimal: Die Reihenfolge ist die Rangfolge. Ohne diese Stufe
  // wandert eine halb gefüllte Haben-Spalte zusätzlich in den Zahlungspartner,
  // und im Vorschlag steht ein Betrag, wo ein Name stehen müsste.
  const mapping: Partial<ColumnMapping> = {};
  const belegt = new Set<number>();
  for (const rolle of ["date", "amount", "debit", "credit", "purpose", "counterparty"] as const) {
    const idx = roh[rolle];
    if (idx === undefined || belegt.has(idx)) continue;
    mapping[rolle] = idx;
    belegt.add(idx);
  }
  return mapping;
}

export type ParsedBooking = {
  bookingDate: Date;
  amountCents: number; // immer positiv
  kind: BookingKind; // EINNAHME | AUSGABE (Vorzeichen des CSV-Betrags)
  text: string;
  counterparty?: string;
  reference: string;
  dedupeHash: string;
};

// Deutsches Datum: dd.mm.yyyy / dd.mm.yy; zusätzlich ISO yyyy-mm-dd.
// Als UTC-Mitternacht konstruiert — stabil unabhängig von der Server-Zeitzone.
export function parseGermanDate(input: string): Date | null {
  const trimmed = input.trim();
  let m = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    let year = Number(m[3]);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    const date = new Date(Date.UTC(year, month - 1, day));
    // Plausibilität (verhindert 32.13. → Datumsüberlauf)
    if (date.getUTCDate() !== day || date.getUTCMonth() !== month - 1) return null;
    return date;
  }
  m = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    if (date.getUTCDate() !== Number(m[3])) return null;
    return date;
  }
  return null;
}

// Vorzeichenbehafteter deutscher Betrag ("−1.234,56", "-480,00", "+8880,46",
// "1234.56") in Cent. Anders als parseEuroToCents (Eingabe-Helfer, nur positiv)
// müssen Bank-CSV-Beträge negativ sein dürfen.
export function parseSignedEuroToCents(input: string): number | null {
  let trimmed = input.trim();
  if (!trimmed) return null;
  // Unicode-Minus / Klammern für Soll-Beträge normalisieren
  trimmed = trimmed.replace(/−/g, "-");
  let negative = false;
  if (/^\(.*\)$/.test(trimmed)) {
    negative = true;
    trimmed = trimmed.slice(1, -1);
  }
  let normalized = trimmed.replace(/\s|€|EUR/gi, "");
  if (normalized.startsWith("-")) {
    negative = true;
    normalized = normalized.slice(1);
  } else if (normalized.startsWith("+")) {
    normalized = normalized.slice(1);
  }
  // Welches Zeichen trennt die Nachkommastellen? Das **letzte** von beiden.
  // „1.234,56" ist deutsch, „1,234.56" englisch (so exportieren manche Banken
  // und jeder Excel-Umweg mit englischem Gebietsschema). Wer stets den Punkt
  // als Tausendertrenner wegwirft, macht aus 1.234,56 € eben mal 1,23 €.
  const letztesKomma = normalized.lastIndexOf(",");
  const letzterPunkt = normalized.lastIndexOf(".");
  if (letztesKomma >= 0 && letztesKomma > letzterPunkt) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (letzterPunkt >= 0 && letztesKomma >= 0) {
    normalized = normalized.replace(/,/g, "");
  } else if (letztesKomma >= 0) {
    normalized = normalized.replace(",", ".");
  }
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value)) return null;
  const cents = Math.round(value * 100);
  return negative ? -cents : cents;
}

/**
 * Der vorzeichenbehaftete Betrag einer Zeile — aus einer Betragsspalte oder
 * aus getrennten Soll-/Haben-Spalten.
 */
export function rowAmountCents(row: RawRow, mapping: ColumnMapping): number | null {
  if (mapping.amount !== undefined) return parseSignedEuroToCents(row[mapping.amount] ?? "");
  const soll = mapping.debit !== undefined ? parseSignedEuroToCents(row[mapping.debit] ?? "") : null;
  const haben = mapping.credit !== undefined ? parseSignedEuroToCents(row[mapping.credit] ?? "") : null;
  if (soll === null && haben === null) return null;
  // In getrennten Spalten steht der Betrag ohne Vorzeichen — die Spalte trägt
  // die Richtung. Ein dort trotzdem gesetztes Minus wird nicht doppelt gewertet.
  return (haben === null ? 0 : Math.abs(haben)) - (soll === null ? 0 : Math.abs(soll));
}

// Stabiler Duplikat-Hash: Konto + Datum (UTC) + Betrag + normalisierter
// Verwendungszweck. Gegenpartei bewusst NICHT enthalten (Banken liefern sie
// uneinheitlich); Datum+Betrag+Zweck identifiziert einen Umsatz hinreichend.
export function dedupeHash(accountId: string, date: Date, amountCents: number, reference: string): string {
  const normalizedRef = reference.replace(/\s+/g, " ").trim().toLowerCase();
  const day = date.toISOString().slice(0, 10);
  return crypto.createHash("sha256").update(`${accountId}|${day}|${amountCents}|${normalizedRef}`).digest("hex");
}

// Wandelt CSV-Zeilen in Buchungsvorschläge. Zeilen ohne parsebares Datum oder
// Betrag (Fußzeilen, Salden, Leerfelder) werden übersprungen — der Aufrufer
// zeigt die Anzahl übersprungener Zeilen an.
export function mapRows(rows: RawRow[], mapping: ColumnMapping, accountId: string): ParsedBooking[] {
  const result: ParsedBooking[] = [];
  for (const row of rows) {
    const date = parseGermanDate(row[mapping.date] ?? "");
    const signedCents = rowAmountCents(row, mapping);
    if (!date || signedCents === null || signedCents === 0) continue;
    const reference = (row[mapping.purpose] ?? "").trim();
    const counterparty =
      mapping.counterparty !== undefined ? (row[mapping.counterparty] ?? "").trim() || undefined : undefined;
    const kind: BookingKind = signedCents < 0 ? "AUSGABE" : "EINNAHME";
    const amountCents = Math.abs(signedCents);
    result.push({
      bookingDate: date,
      amountCents,
      kind,
      text: reference.slice(0, 200) || counterparty || "Bankumsatz",
      counterparty,
      reference,
      dedupeHash: dedupeHash(accountId, date, signedCents, reference),
    });
  }
  return result;
}
