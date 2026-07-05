// Pure Helfer für die Plattform-Auswertungen (Monats-Buckets, Formatierung).
// Bewusst ohne DB/Env-Zugriff → gut unit-testbar.

export type MonthBucket = { key: string; label: string };

// Schlüssel "YYYY-MM" eines Datums.
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const MONTHS_DE = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

// Die letzten `n` Monate (inkl. aktuellem), älteste zuerst.
export function lastNMonths(now: Date, n: number): MonthBucket[] {
  const out: MonthBucket[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ key: monthKey(d), label: `${MONTHS_DE[d.getMonth()]} ${String(d.getFullYear()).slice(2)}` });
  }
  return out;
}

// Summiert Werte je Monat und richtet sie an den vorgegebenen Buckets aus.
export function bucketByMonth(
  items: { date: Date; value: number }[],
  months: MonthBucket[],
): number[] {
  const sums = new Map<string, number>();
  for (const it of items) {
    const k = monthKey(it.date);
    sums.set(k, (sums.get(k) ?? 0) + it.value);
  }
  return months.map((m) => sums.get(m.key) ?? 0);
}
