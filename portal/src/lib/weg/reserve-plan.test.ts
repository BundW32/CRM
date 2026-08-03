import { describe, expect, it } from "vitest";
import { projectReserve } from "./reserve-plan";

describe("projectReserve", () => {
  it("summiert den Gesamtbedarf und die Deckungslücke", () => {
    const p = projectReserve({
      currentReserveCents: 1_000_000, // 10.000 €
      annualContributionCents: 0,
      currentYear: 2026,
      measures: [
        { targetYear: 2028, estimatedCents: 500_000 },
        { targetYear: 2030, estimatedCents: 800_000 },
      ],
    });
    expect(p.totalPlannedCents).toBe(1_300_000);
    expect(p.coverageGapCents).toBe(300_000); // Bedarf 13.000 − Rücklage 10.000
  });

  it("prognostiziert den Rücklagenstand mit jährlicher Zuführung", () => {
    const p = projectReserve({
      currentReserveCents: 1_000_000,
      annualContributionCents: 200_000, // 2.000 €/Jahr
      currentYear: 2026,
      measures: [{ targetYear: 2028, estimatedCents: 1_500_000 }],
    });
    // 2026: 1.000.000 + 200.000 = 1.200.000
    // 2027: + 200.000 = 1.400.000
    // 2028: + 200.000 − 1.500.000 = 100.000
    expect(p.rows.map((r) => r.projectedReserveCents)).toEqual([1_200_000, 1_400_000, 100_000]);
    expect(p.firstShortfallYear).toBeNull();
  });

  it("erkennt das erste Jahr der Unterdeckung", () => {
    const p = projectReserve({
      currentReserveCents: 300_000,
      annualContributionCents: 100_000,
      currentYear: 2026,
      measures: [{ targetYear: 2027, estimatedCents: 800_000 }],
    });
    // 2026: 300.000 + 100.000 = 400.000
    // 2027: 400.000 + 100.000 − 800.000 = -300.000  → Unterdeckung
    expect(p.firstShortfallYear).toBe(2027);
    expect(p.rows[1].shortfall).toBe(true);
  });

  it("zieht überfällige Maßnahmen ins laufende Jahr", () => {
    const p = projectReserve({
      currentReserveCents: 0,
      annualContributionCents: 0,
      currentYear: 2026,
      measures: [{ targetYear: 2024, estimatedCents: 100_000 }],
    });
    expect(p.rows).toHaveLength(1);
    expect(p.rows[0].year).toBe(2026);
    expect(p.rows[0].plannedCents).toBe(100_000);
  });

  it("liefert bei fehlenden Maßnahmen leere Prognose", () => {
    const p = projectReserve({
      currentReserveCents: 500_000,
      annualContributionCents: 100_000,
      currentYear: 2026,
      measures: [],
    });
    expect(p.rows).toEqual([]);
    expect(p.totalPlannedCents).toBe(0);
    expect(p.firstShortfallYear).toBeNull();
  });
});
