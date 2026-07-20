// Verbrauchsabhängige Verteilung aus Zählerständen (Notiz 4, Etappe 2).
// Reine Funktionen — kein UI, keine DB. Der Verbrauch je Einheit im
// Wirtschaftsjahr ergibt sich aus Endstand − Anfangsstand der Ablesungen.

export type Reading = { value: number; date: Date };
export type UnitReadings = { unitId: string; readings: Reading[] };
export type ConsumptionShare = { unitId: string; consumption: number };

// Verbrauch einer Einheit im Zeitraum [start, end):
//   Endstand   = letzte Ablesung mit Datum ≤ end
//   Anfangsstand = letzte Ablesung mit Datum ≤ start (Stand zu Jahresbeginn);
//                 fehlt sie, wird die erste vorhandene Ablesung genähert.
// Zähler sind kumulativ steigend → Verbrauch = Endstand − Anfangsstand (≥ 0).
export function consumptionInPeriod(readings: Reading[], start: Date, end: Date): number {
  if (readings.length === 0) return 0;
  const sorted = [...readings].sort((a, b) => a.date.getTime() - b.date.getTime());
  const s = start.getTime();
  const e = end.getTime();

  const upToEnd = sorted.filter((r) => r.date.getTime() <= e);
  if (upToEnd.length === 0) return 0;
  const endValue = upToEnd[upToEnd.length - 1].value;

  const upToStart = sorted.filter((r) => r.date.getTime() <= s);
  const startValue = upToStart.length > 0 ? upToStart[upToStart.length - 1].value : sorted[0].value;

  return Math.max(0, endValue - startValue);
}

// Verbrauchs-Gewichte je Einheit für den Zeitraum. Einheiten ohne Verbrauch
// erhalten 0.
export function meterConsumptionWeights(
  units: UnitReadings[],
  start: Date,
  end: Date,
): ConsumptionShare[] {
  return units.map((u) => ({
    unitId: u.unitId,
    consumption: consumptionInPeriod(u.readings, start, end),
  }));
}
