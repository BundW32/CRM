// CSV-Bankimport (manueller Adapter, Zero-Key): Parser, Spalten-Mapping mit
// Header-Erkennung (Sparkasse/Volksbank) und Duplikat-Hash. Pure Funktionen —
// das eigentliche Schreiben in die DB übernimmt die Server Action (AP3).
// Adapter-Prinzip: ein späterer Open-Banking-Adapter liefert dieselben
// ParsedBooking-Objekte und dockt an derselben Stelle an.
import crypto from "crypto";
import type { BookingKind } from "@/generated/prisma/client";

export type RawRow = string[];

export type ColumnMapping = {
  date: number;
  amount: number;
  purpose: number;
  counterparty?: number;
};

// RFC-4180-naher CSV-Parser: Trennzeichen ; oder , (Autodetect anhand der
// ersten Zeile), Anführungszeichen mit "" -Escaping, \r\n und \n.
// Keine externe Dependency nötig — Bank-CSVs sind flach und klein.
export function parseCsv(content: string): { header: string[]; rows: RawRow[] } {
  // BOM entfernen (Sparkassen-Exporte sind oft UTF-8 mit BOM oder Latin-1)
  const text = content.replace(/^﻿/, "");
  const firstLine = text.slice(0, text.indexOf("\n") === -1 ? text.length : text.indexOf("\n"));
  // Autodetect: Trennzeichen mit den meisten Vorkommen außerhalb von Quotes
  const delimiter = countOutsideQuotes(firstLine, ";") >= countOutsideQuotes(firstLine, ",") ? ";" : ",";

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

  if (rows.length === 0) return { header: [], rows: [] };
  const [header, ...body] = rows;
  return { header, rows: body };
}

function countOutsideQuotes(line: string, char: string): number {
  let count = 0;
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === char && !inQuotes) count++;
  }
  return count;
}

// Rät das Spalten-Mapping anhand typischer deutscher Bank-Header
// (Sparkasse CSV-CAMT, Volksbank/VR, generische Exporte).
export function guessMapping(header: string[]): Partial<ColumnMapping> {
  const norm = header.map((h) => h.toLowerCase());
  const find = (patterns: RegExp[]) => {
    for (const p of patterns) {
      const idx = norm.findIndex((h) => p.test(h));
      if (idx !== -1) return idx;
    }
    return undefined;
  };
  const mapping: Partial<ColumnMapping> = {};
  const date = find([/^buchungstag$/, /buchungstag/, /buchungsdatum/, /^datum$/, /^valuta(datum)?$/]);
  const amount = find([/^betrag/, /betrag \(/, /^umsatz$/, /umsatz in eur/, /betrag/]);
  const purpose = find([/verwendungszweck/, /^vwz/, /buchungstext/]);
  const counterparty = find([
    /beguenstigter|begünstigter/,
    /zahlungspflichtiger/,
    /zahlungsbeteiligter/,
    /auftraggeber|empf(ä|ae?)nger/,
    /^name/,
  ]);
  if (date !== undefined) mapping.date = date;
  if (amount !== undefined) mapping.amount = amount;
  if (purpose !== undefined) mapping.purpose = purpose;
  if (counterparty !== undefined) mapping.counterparty = counterparty;
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

// Vorzeichenbehafteter deutscher Betrag ("−1.234,56", "-480,00", "1234.56") in
// Cent. Anders als parseEuroToCents (Eingabe-Helfer, nur positiv) müssen
// Bank-CSV-Beträge negativ sein dürfen.
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
  if (normalized.includes(",")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  }
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value)) return null;
  const cents = Math.round(value * 100);
  return negative ? -cents : cents;
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
    const signedCents = parseSignedEuroToCents(row[mapping.amount] ?? "");
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
