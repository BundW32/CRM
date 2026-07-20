// Datei-Import der Heizkostenabrechnung eines Messdienstes (ista/Techem/Minol/
// Brunata …) als CSV (M-H). Anbieter-unabhängig, Zero-Key: die vom Messdienst
// gelieferte Datei wird eingelesen und die Beträge je Einheit den WEG-Einheiten
// zugeordnet (fließt als StatementUnitAmount in die Jahresabrechnung). Nicht
// zuordenbare Zeilen werden gemeldet, nie stillschweigend verworfen.
import { parseCsv, parseSignedEuroToCents } from "./bank-import";

// Normalisiert eine Bezeichnung für den Abgleich (Kleinbuchstaben, ohne
// Mehrfach-Leerzeichen/Satzzeichen an den Rändern).
export function normalizeLabel(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

// Erste Zahl aus einer Bezeichnung (z. B. "WE 01, EG links" → 1). Für den
// Abgleich, wenn der Messdienst nur Nummern statt voller Labels liefert.
export function leadingNumber(s: string): number | null {
  const m = s.match(/\d+/);
  return m ? Number.parseInt(m[0], 10) : null;
}

// Spaltenerkennung anhand des Headers.
export function guessHeatingColumns(header: string[]): { unitCol: number; amountCol: number } | null {
  const norm = header.map((h) => normalizeLabel(h));
  const unitCol = norm.findIndex((h) => /einheit|wohnung|nutzer|whg|nr\.?|nummer|lage/.test(h));
  const amountCol = norm.findIndex((h) => /betrag|kosten|summe|eur|gesamt|anteil/.test(h));
  if (unitCol < 0 || amountCol < 0) return null;
  return { unitCol, amountCol };
}

export type HeatingRow = { unitLabel: string; amountCents: number };

// Liest den CSV-Inhalt und liefert die Roh-Zeilen (Einheit + Betrag) sowie die
// erkannten Spalten. Gibt einen Fehlercode zurück, wenn die Spalten nicht
// erkennbar sind oder keine Datenzeile brauchbar ist.
export function parseHeatingCsv(content: string):
  | { ok: true; rows: HeatingRow[]; header: string[]; unitCol: number; amountCol: number }
  | { ok: false; error: "spalten" | "leer"; header: string[] } {
  const { header, rows } = parseCsv(content);
  const cols = guessHeatingColumns(header);
  if (!cols) return { ok: false, error: "spalten", header };
  const out: HeatingRow[] = [];
  for (const r of rows) {
    const label = (r[cols.unitCol] ?? "").trim();
    const cents = parseSignedEuroToCents(r[cols.amountCol] ?? "");
    if (!label || cents === null) continue;
    out.push({ unitLabel: label, amountCents: Math.abs(cents) });
  }
  if (out.length === 0) return { ok: false, error: "leer", header };
  return { ok: true, rows: out, header, unitCol: cols.unitCol, amountCol: cols.amountCol };
}

export type HeatingMatch = {
  matched: { unitId: string; unitLabel: string; amountCents: number }[];
  unmatchedRows: HeatingRow[]; // CSV-Zeilen ohne eindeutige Einheit
  unmatchedUnits: { id: string; label: string }[]; // WEG-Einheiten ohne Zeile
};

// Ordnet die CSV-Zeilen den WEG-Einheiten zu: zuerst exakter (normalisierter)
// Label-Abgleich, dann eindeutiger Nummern-Abgleich. Mehrdeutige oder fehlende
// Treffer bleiben „unmatched".
export function matchHeatingRows(
  units: { id: string; label: string }[],
  rows: HeatingRow[],
): HeatingMatch {
  const byLabel = new Map<string, { id: string; label: string }>();
  const byNumber = new Map<number, { id: string; label: string } | null>(); // null = mehrdeutig
  for (const u of units) {
    byLabel.set(normalizeLabel(u.label), u);
    const n = leadingNumber(u.label);
    if (n !== null) byNumber.set(n, byNumber.has(n) ? null : u);
  }

  const usedUnitIds = new Set<string>();
  const matched: HeatingMatch["matched"] = [];
  const unmatchedRows: HeatingRow[] = [];

  for (const row of rows) {
    let unit = byLabel.get(normalizeLabel(row.unitLabel));
    if (!unit) {
      const n = leadingNumber(row.unitLabel);
      if (n !== null) unit = byNumber.get(n) ?? undefined;
    }
    if (unit && !usedUnitIds.has(unit.id)) {
      usedUnitIds.add(unit.id);
      matched.push({ unitId: unit.id, unitLabel: unit.label, amountCents: row.amountCents });
    } else {
      unmatchedRows.push(row);
    }
  }

  const unmatchedUnits = units.filter((u) => !usedUnitIds.has(u.id));
  return { matched, unmatchedRows, unmatchedUnits };
}
