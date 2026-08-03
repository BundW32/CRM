// Reine Rechenlogik der Erhaltungsplanung: leitet aus den geplanten Maßnahmen
// den Rücklagenbedarf her und stellt ihn (Jahr für Jahr) dem prognostizierten
// Rücklagenstand gegenüber. Prognose = aktueller Rücklagenstand + jährliche
// Zuführung (aus dem beschlossenen Wirtschaftsplan) − geplante Ausgaben.
// Alle Beträge in Integer-Cent.

export type ReserveMeasure = { targetYear: number; estimatedCents: number };

export type ReserveProjectionRow = {
  year: number;
  plannedCents: number; // Summe der Maßnahmen dieses Jahres
  contributionCents: number; // Rücklagenzuführung dieses Jahres
  cumulativePlannedCents: number; // kumulierter Bedarf bis einschließlich dieses Jahres
  projectedReserveCents: number; // prognostizierter Stand am Jahresende
  shortfall: boolean; // Prognose < 0 (Unterdeckung)
};

export type ReserveProjection = {
  rows: ReserveProjectionRow[];
  totalPlannedCents: number; // Bedarf gesamt (alle offenen Maßnahmen)
  currentReserveCents: number;
  coverageGapCents: number; // Bedarf − Rücklagenstand (>0 = Unterdeckung)
  firstShortfallYear: number | null; // erstes Jahr mit prognostizierter Unterdeckung
};

// Maßnahmen mit Zieljahr < currentYear werden dem laufenden Jahr zugeschlagen
// (überfällige Planung geht nicht verloren).
export function projectReserve(params: {
  currentReserveCents: number;
  annualContributionCents: number;
  measures: ReserveMeasure[];
  currentYear: number;
}): ReserveProjection {
  const { currentReserveCents, annualContributionCents, measures, currentYear } = params;

  const totalPlannedCents = measures.reduce((s, m) => s + m.estimatedCents, 0);
  const coverageGapCents = totalPlannedCents - currentReserveCents;

  // Geplante Ausgaben je Jahr (überfällige ins laufende Jahr ziehen).
  const plannedByYear = new Map<number, number>();
  for (const m of measures) {
    const year = Math.max(m.targetYear, currentYear);
    plannedByYear.set(year, (plannedByYear.get(year) ?? 0) + m.estimatedCents);
  }

  const rows: ReserveProjectionRow[] = [];
  let firstShortfallYear: number | null = null;
  if (plannedByYear.size > 0) {
    const maxYear = Math.max(...plannedByYear.keys());
    let reserve = currentReserveCents;
    let cumulativePlanned = 0;
    for (let year = currentYear; year <= maxYear; year++) {
      const planned = plannedByYear.get(year) ?? 0;
      cumulativePlanned += planned;
      reserve += annualContributionCents - planned;
      const shortfall = reserve < 0;
      if (shortfall && firstShortfallYear === null) firstShortfallYear = year;
      rows.push({
        year,
        plannedCents: planned,
        contributionCents: annualContributionCents,
        cumulativePlannedCents: cumulativePlanned,
        projectedReserveCents: reserve,
        shortfall,
      });
    }
  }

  return {
    rows,
    totalPlannedCents,
    currentReserveCents,
    coverageGapCents,
    firstShortfallYear,
  };
}
