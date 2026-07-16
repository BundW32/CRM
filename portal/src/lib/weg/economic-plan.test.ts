import { describe, expect, it } from "vitest";
import {
  advanceWeightsForKey,
  computeUnitAdvances,
  fiscalYearMonths,
  fiscalYearRange,
  monthlyInstallments,
} from "./economic-plan";
import type { UnitForDistribution } from "./distribution";

// Demo-WEG: 5 Wohnungen + 1 Stellplatz (ohne Fläche/Personen), MEA-Summe 1000
const units: UnitForDistribution[] = [
  { id: "we1", mea: 180, livingArea: 72.5, personCount: 2 },
  { id: "we2", mea: 175, livingArea: 70.2, personCount: 1 },
  { id: "we3", mea: 180, livingArea: 72.5, personCount: 3 },
  { id: "we4", mea: 175, livingArea: 70.2, personCount: 2 },
  { id: "we5", mea: 240, livingArea: 96.4, personCount: 4 },
  { id: "te6", mea: 50, livingArea: null, personCount: null },
];

describe("fiscalYearMonths / fiscalYearRange", () => {
  it("Kalenderjahr (Start Januar)", () => {
    const months = fiscalYearMonths(2026, 1);
    expect(months[0]).toEqual({ year: 2026, month: 1 });
    expect(months[11]).toEqual({ year: 2026, month: 12 });
    const { start, end } = fiscalYearRange(2026, 1);
    expect(start.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(end.toISOString().slice(0, 10)).toBe("2027-01-01");
  });

  it("abweichendes Wirtschaftsjahr (Start Juli) läuft über den Jahreswechsel", () => {
    const months = fiscalYearMonths(2026, 7);
    expect(months[0]).toEqual({ year: 2026, month: 7 });
    expect(months[5]).toEqual({ year: 2026, month: 12 });
    expect(months[6]).toEqual({ year: 2027, month: 1 });
    expect(months[11]).toEqual({ year: 2027, month: 6 });
  });

  it("ungültiger Startmonat → Fehler", () => {
    expect(() => fiscalYearMonths(2026, 0)).toThrow();
    expect(() => fiscalYearRange(2026, 13)).toThrow();
  });
});

describe("advanceWeightsForKey", () => {
  it("VERBRAUCH/FESTBETRAG/INDIVIDUELL fallen auf MEA zurück", () => {
    for (const key of ["VERBRAUCH", "FESTBETRAG", "INDIVIDUELL"] as const) {
      const w = advanceWeightsForKey(units, key);
      expect(w.find((s) => s.unitId === "we5")?.weight).toBe(240);
      expect(w.find((s) => s.unitId === "te6")?.weight).toBe(50);
    }
  });

  it("FLAECHE: fehlende Fläche zählt als 0 (Stellplatz trägt nicht mit)", () => {
    const w = advanceWeightsForKey(units, "FLAECHE");
    expect(w.find((s) => s.unitId === "te6")?.weight).toBe(0);
    expect(w.find((s) => s.unitId === "we1")?.weight).toBe(725000);
  });

  it("PERSONEN: fehlende Personenzahl zählt als 0", () => {
    const w = advanceWeightsForKey(units, "PERSONEN");
    expect(w.find((s) => s.unitId === "te6")?.weight).toBe(0);
  });

  it("MEA bleibt strikt (null → Fehler)", () => {
    const broken = [...units, { id: "x", mea: null, livingArea: 10, personCount: 1 }];
    expect(() => advanceWeightsForKey(broken, "MEA")).toThrow(/MEA/);
  });
});

describe("computeUnitAdvances", () => {
  it("Summe je Einheit == Summe aller Planwerte (centgenau)", () => {
    const items = [
      { costTypeId: "hausmeister", distributionKey: "MEA" as const, amountCents: 480_000 },
      { costTypeId: "heizung", distributionKey: "VERBRAUCH" as const, amountCents: 1_234_567 },
      { costTypeId: "reinigung", distributionKey: "FLAECHE" as const, amountCents: 240_000 },
      { costTypeId: "muell", distributionKey: "PERSONEN" as const, amountCents: 96_000 },
      { costTypeId: "konto", distributionKey: "EINHEITEN" as const, amountCents: 12_001 },
    ];
    const { perUnit, perItem, totalCents } = computeUnitAdvances(items, units);
    expect(totalCents).toBe(2_062_568);
    const sum = [...perUnit.values()].reduce((a, b) => a + b, 0);
    expect(sum).toBe(totalCents);
    // Stellplatz: kein Flächen-/Personenanteil, aber MEA- und Einheiten-Anteile
    const te6Flaeche = perItem.get("reinigung")?.get("te6");
    expect(te6Flaeche).toBe(0);
    expect(perItem.get("konto")?.get("te6")).toBeGreaterThan(0);
  });

  it("Positionen mit 0 € werden ignoriert, negative abgelehnt", () => {
    const { totalCents } = computeUnitAdvances(
      [{ costTypeId: "a", distributionKey: "MEA", amountCents: 0 }],
      units,
    );
    expect(totalCents).toBe(0);
    expect(() =>
      computeUnitAdvances([{ costTypeId: "a", distributionKey: "MEA", amountCents: -1 }], units),
    ).toThrow();
  });
});

describe("monthlyInstallments", () => {
  it("12 Raten summieren centgenau auf den Jahresbetrag", () => {
    for (const annual of [120_000, 120_005, 1, 11, 999_999]) {
      const rates = monthlyInstallments(annual);
      expect(rates).toHaveLength(12);
      expect(rates.reduce((a, b) => a + b, 0)).toBe(annual);
      // Raten unterscheiden sich höchstens um 1 Cent
      expect(Math.max(...rates) - Math.min(...rates)).toBeLessThanOrEqual(1);
    }
  });

  it("0 € → zwölf Nullraten", () => {
    expect(monthlyInstallments(0)).toEqual(Array(12).fill(0));
  });
});
