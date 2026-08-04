// Reine Rechenlogik für die unterjährige Verbrauchsinformation (UVI) nach
// § 6a HeizkostenV. Aus den (kumulativen) Zählerständen werden Verbrauchs-
// perioden gebildet und die jüngste Periode mit der Vorperiode sowie mit der
// entsprechenden Periode des Vorjahres verglichen.

export type Reading = { value: number; date: Date };

export type ConsumptionPeriod = {
  from: Date;
  to: Date;
  consumption: number; // Verbrauch = Endstand − Anfangsstand
};

// Bildet aus aufeinanderfolgenden Ständen Verbrauchsperioden. Ständige (nach
// Datum sortiert). Zählerrücksprünge (Austausch/Reset) ergäben einen negativen
// Verbrauch — solche Perioden werden übersprungen (nicht sinnvoll vergleichbar).
export function consumptionPeriods(readings: Reading[]): ConsumptionPeriod[] {
  const sorted = [...readings].sort((a, b) => a.date.getTime() - b.date.getTime());
  const periods: ConsumptionPeriod[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    const consumption = cur.value - prev.value;
    if (consumption < 0) continue; // Zählerwechsel/Reset
    periods.push({ from: prev.date, to: cur.date, consumption });
  }
  return periods;
}

export type ConsumptionInfo = {
  latest: ConsumptionPeriod;
  previous: ConsumptionPeriod | null; // unmittelbare Vorperiode
  sameLastYear: ConsumptionPeriod | null; // Periode, die ~1 Jahr früher endete
  deltaPreviousPct: number | null; // Veränderung ggü. Vorperiode in %
  deltaYearPct: number | null; // Veränderung ggü. Vorjahresperiode in %
};

const DAY = 1000 * 60 * 60 * 24;

// Prozentuale Veränderung (auf ganze Prozent gerundet). Referenz 0 → null.
function pctChange(current: number, reference: number): number | null {
  if (reference === 0) return null;
  return Math.round(((current - reference) / reference) * 100);
}

// Liefert die UVI zur jüngsten abgeschlossenen Periode inkl. Vergleichen.
// Für den Vorjahresvergleich wird die Periode gesucht, deren Endstand dem
// jüngsten Ende minus ~365 Tage am nächsten liegt (±45 Tage Toleranz).
export function latestConsumptionInfo(readings: Reading[]): ConsumptionInfo | null {
  const periods = consumptionPeriods(readings);
  if (periods.length === 0) return null;

  const latest = periods[periods.length - 1];
  const previous = periods.length >= 2 ? periods[periods.length - 2] : null;

  const targetEnd = latest.to.getTime() - 365 * DAY;
  let sameLastYear: ConsumptionPeriod | null = null;
  let bestDiff = 46 * DAY; // Toleranzfenster
  for (const p of periods) {
    if (p === latest) continue;
    const diff = Math.abs(p.to.getTime() - targetEnd);
    if (diff <= bestDiff) {
      bestDiff = diff;
      sameLastYear = p;
    }
  }

  return {
    latest,
    previous,
    sameLastYear,
    deltaPreviousPct: previous ? pctChange(latest.consumption, previous.consumption) : null,
    deltaYearPct: sameLastYear ? pctChange(latest.consumption, sameLastYear.consumption) : null,
  };
}
