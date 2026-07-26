// Schreibsperre für abgeschlossene Wirtschaftsjahre.
//
// Eine fertiggestellte Jahresabrechnung (StatementStatus.FERTIG) hält ihr
// Ergebnis als Snapshot fest und ist Grundlage eines Eigentümerbeschlusses.
// Wenn danach noch Buchungen dieses Jahres verändert oder storniert werden
// könnten, würde der Snapshot von der Buchhaltung abweichen — genau die
// Abweichung, die eine Abrechnung angreifbar macht. Deshalb sind Buchungen
// eines abgeschlossenen Jahres unantastbar.
//
// Pure Funktionen + ein DB-Helfer; genutzt von der Kostenart-Zuordnung und vom
// Storno.
import { db } from "@/lib/db";

/**
 * Das Wirtschaftsjahr, zu dem ein Datum gehört. Bezeichner ist immer das
 * Kalenderjahr, in dem das Wirtschaftsjahr *beginnt* — bei einem Wirtschaftsjahr
 * ab Juli gehört der 15.03.2026 also zum Wirtschaftsjahr 2025.
 *
 * Rechnet in UTC, passend zu `fiscalYearRange` und `parseGermanDate`.
 */
export function fiscalYearOf(date: Date, startMonth: number): number {
  if (startMonth < 1 || startMonth > 12) throw new Error("Ungültiger Wirtschaftsjahr-Beginn.");
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  return month >= startMonth ? year : year - 1;
}

/** Fällt das Datum in eines der abgeschlossenen Wirtschaftsjahre? */
export function isDateLocked(date: Date, lockedYears: Set<number>, startMonth: number): boolean {
  return lockedYears.has(fiscalYearOf(date, startMonth));
}

/** Wirtschaftsjahre dieses Objekts mit fertiggestellter Jahresabrechnung. */
export async function lockedFiscalYears(propertyId: string): Promise<Set<number>> {
  const statements = await db.annualStatement.findMany({
    where: { propertyId, status: "FERTIG" },
    select: { year: true },
  });
  return new Set(statements.map((s) => s.year));
}

/**
 * Sind alle übergebenen Buchungsdaten noch änderbar? Liefert false, sobald eine
 * Buchung in ein abgeschlossenes Wirtschaftsjahr fällt.
 */
export async function allDatesEditable(
  property: { id: string; fiscalYearStartMonth: number },
  dates: Date[],
): Promise<boolean> {
  if (dates.length === 0) return true;
  const locked = await lockedFiscalYears(property.id);
  if (locked.size === 0) return true;
  return !dates.some((d) => isDateLocked(d, locked, property.fiscalYearStartMonth));
}
