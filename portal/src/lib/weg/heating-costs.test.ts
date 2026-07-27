import { describe, expect, it } from "vitest";
import {
  HEATING_CONSUMPTION_DEFAULT,
  isValidHeatingPercent,
  splitHeatingCosts,
} from "./heating-costs";

// Drei Einheiten mit sehr unterschiedlichem Verbrauch — genau der Fall, in dem
// die reine Zählerverteilung und die HeizkostenV weit auseinanderlaufen.
const consumptionWeights = [
  { unitId: "we1", weight: 1000 },
  { unitId: "we2", weight: 500 },
  { unitId: "we3", weight: 0 }, // leerstehend, verbraucht nichts
];
const areaWeights = [
  { unitId: "we1", weight: 700_000 }, // 70 m² in cm²
  { unitId: "we2", weight: 700_000 },
  { unitId: "we3", weight: 700_000 },
];

describe("splitHeatingCosts (§§ 7, 8 HeizkostenV)", () => {
  it("teilt in Grundkosten nach Fläche und Verbrauchskosten nach Zählern", () => {
    const r = splitHeatingCosts({
      totalCents: 300_000,
      consumptionPercent: 70,
      consumptionWeights,
      areaWeights,
    });
    expect(r.consumptionCents).toBe(210_000);
    expect(r.baseCents).toBe(90_000);
    // we1: 2/3 von 210.000 = 140.000 + 30.000 Grundkosten
    expect(r.perUnit.get("we1")).toBe(170_000);
    expect(r.perUnit.get("we2")).toBe(100_000); // 70.000 + 30.000
    // Der eigentliche Punkt: Die leerstehende Wohnung zahlt Grundkosten.
    expect(r.perUnit.get("we3")).toBe(30_000);
  });

  it("verteilt centgenau — Σ Einheiten == Gesamtbetrag", () => {
    for (const total of [100_001, 333_333, 1, 7]) {
      const r = splitHeatingCosts({
        totalCents: total,
        consumptionPercent: 55,
        consumptionWeights,
        areaWeights,
      });
      const summe = [...r.perUnit.values()].reduce((a, b) => a + b, 0);
      expect(summe).toBe(total);
      expect(r.baseCents + r.consumptionCents).toBe(total);
    }
  });

  it("lehnt einen Verbrauchsanteil außerhalb 50–70 % ab, statt zu runden", () => {
    // 100 % war das bisherige Verhalten und ist genau der Verstoß.
    for (const pct of [0, 49, 71, 100, 65.5]) {
      expect(isValidHeatingPercent(pct)).toBe(false);
      expect(() =>
        splitHeatingCosts({
          totalCents: 100_000,
          consumptionPercent: pct,
          consumptionWeights,
          areaWeights,
        }),
      ).toThrow(/50 und 70/);
    }
  });

  it("lässt die Grenzwerte 50 und 70 zu", () => {
    expect(isValidHeatingPercent(50)).toBe(true);
    expect(isValidHeatingPercent(70)).toBe(true);
    expect(isValidHeatingPercent(HEATING_CONSUMPTION_DEFAULT)).toBe(true);
  });
});
