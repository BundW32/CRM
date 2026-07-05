// CSV-Helfer: RFC-4180-Quoting + Schutz vor Formel-Injection (Excel/LibreOffice
// führen Zellen aus, die mit =,+,-,@ oder Steuerzeichen beginnen). Reine Zahlen
// (auch negativ / mit Dezimalkomma) bleiben unentwertet, damit sie Zahl bleiben.
function isPlainNumber(v: string): boolean {
  return /^-?\d+(?:[.,]\d+)?$/.test(v);
}

export function csvEscape(value: unknown): string {
  const v = value == null ? "" : String(value);
  const safe = !isPlainNumber(v) && /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
}

// Baut ein CSV (Semikolon-getrennt, CRLF, UTF-8-BOM für Excel-DE).
export function buildCsv(rows: unknown[][]): string {
  const body = rows.map((r) => r.map(csvEscape).join(";")).join("\r\n");
  return "﻿" + body;
}
