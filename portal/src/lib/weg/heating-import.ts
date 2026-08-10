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

type UnitForHeatingMatch = { id: string; label: string; unitType?: string };

// Ordnet die CSV-Zeilen den WEG-Einheiten zu: zuerst exakter (normalisierter)
// Label-Abgleich, dann eindeutiger Nummern-Abgleich. Mehrdeutige oder fehlende
// Treffer bleiben „unmatched".
//
// Stellplätze sind vom Abgleich ausgenommen: Ein Stellplatz wird nicht beheizt
// und steht in keiner Messdienst-Abrechnung. Ohne die Ausnahme zöge der
// Nummern-Abgleich eine Zeile „6" auf „TE 06, Stellplatz", wenn keine Wohnung
// dieselbe Nummer trägt — Heizkosten auf einem unbeheizten Stellplatz. Und
// jeder Import meldete sämtliche Stellplätze als „Einheiten ohne Zeile",
// obwohl genau das der Normalfall ist.
export function matchHeatingRows(
  units: UnitForHeatingMatch[],
  rows: HeatingRow[],
): HeatingMatch {
  const beheizbar = units.filter((u) => u.unitType !== "STELLPLATZ");
  const byLabel = new Map<string, UnitForHeatingMatch>();
  const byNumber = new Map<number, UnitForHeatingMatch | null>(); // null = mehrdeutig
  for (const u of beheizbar) {
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

  const unmatchedUnits = beheizbar
    .filter((u) => !usedUnitIds.has(u.id))
    .map((u) => ({ id: u.id, label: u.label }));
  return { matched, unmatchedRows, unmatchedUnits };
}
