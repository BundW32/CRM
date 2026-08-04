import { describe, expect, it } from "vitest";
import { consumptionInPeriod, meterConsumptionWeights } from "./meter-distribution";
import { distributeByWeight } from "./distribution";

const d = (s: string) => new Date(s);
const start = d("2026-01-01");
const end = d("2027-01-01");

describe("consumptionInPeriod", () => {
  it("berechnet Endstand − Anfangsstand über das Jahr", () => {
    const readings = [
      { value: 100, date: d("2025-12-31") }, // Anfangsstand (letzte ≤ start)
      { value: 250, date: d("2026-12-31") }, // Endstand (letzte ≤ end)
    ];
    expect(consumptionInPeriod(readings, start, end)).toBe(150);
  });

  it("nähert den Anfangsstand über die erste Ablesung, wenn keine vor Jahresbeginn liegt", () => {
    const readings = [
      { value: 40, date: d("2026-02-01") },
      { value: 90, date: d("2026-11-01") },
    ];
    expect(consumptionInPeriod(readings, start, end)).toBe(50);
  });

  it("ist 0 ohne Ablesungen im Zeitraum oder ohne Daten", () => {
    expect(consumptionInPeriod([], start, end)).toBe(0);
    expect(consumptionInPeriod([{ value: 10, date: d("2028-01-01") }], start, end)).toBe(0);
  });

  it("verhindert negative Werte bei Zählertausch (Rücksprung)", () => {
    const readings = [
      { value: 900, date: d("2025-12-31") },
      { value: 20, date: d("2026-12-31") }, // neuer Zähler, kleinerer Stand
    ];
    expect(consumptionInPeriod(readings, start, end)).toBe(0);
  });
});

describe("meterConsumptionWeights + distributeByWeight", () => {
  it("verteilt Kosten centgenau nach Verbrauch", () => {
    const units = [
      { unitId: "a", readings: [{ value: 0, date: d("2025-12-31") }, { value: 30, date: d("2026-12-31") }] },
      { unitId: "b", readings: [{ value: 0, date: d("2025-12-31") }, { value: 10, date: d("2026-12-31") }] },
    ];
    const weights = meterConsumptionWeights(units, start, end);
    expect(weights).toEqual([
      { unitId: "a", consumption: 30 },
      { unitId: "b", consumption: 10 },
    ]);
    const dist = distributeByWeight(10000, weights.map((w) => ({ unitId: w.unitId, weight: w.consumption })));
    expect(dist.get("a")).toBe(7500);
    expect(dist.get("b")).toBe(2500);
    expect((dist.get("a") ?? 0) + (dist.get("b") ?? 0)).toBe(10000);
  });
});
