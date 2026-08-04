import { describe, expect, it } from "vitest";
import { consumptionPeriods, latestConsumptionInfo } from "./consumption";

const d = (iso: string) => new Date(iso + "T00:00:00Z");

describe("consumptionPeriods", () => {
  it("bildet Verbrauch aus aufeinanderfolgenden Ständen", () => {
    const p = consumptionPeriods([
      { value: 100, date: d("2026-01-01") },
      { value: 130, date: d("2026-02-01") },
      { value: 175, date: d("2026-03-01") },
    ]);
    expect(p.map((x) => x.consumption)).toEqual([30, 45]);
  });

  it("sortiert unsortierte Eingaben nach Datum", () => {
    const p = consumptionPeriods([
      { value: 175, date: d("2026-03-01") },
      { value: 100, date: d("2026-01-01") },
      { value: 130, date: d("2026-02-01") },
    ]);
    expect(p.map((x) => x.consumption)).toEqual([30, 45]);
  });

  it("überspringt Zählerrücksprünge (Austausch/Reset)", () => {
    const p = consumptionPeriods([
      { value: 900, date: d("2026-01-01") },
      { value: 950, date: d("2026-02-01") },
      { value: 10, date: d("2026-03-01") }, // Austausch → negativ, überspringen
      { value: 40, date: d("2026-04-01") },
    ]);
    expect(p.map((x) => x.consumption)).toEqual([50, 30]);
  });
});

describe("latestConsumptionInfo", () => {
  it("vergleicht mit Vorperiode und Vorjahresperiode", () => {
    const readings = [
      { value: 0, date: d("2025-01-01") },
      { value: 100, date: d("2025-02-01") }, // Vorjahresperiode: 100
      { value: 300, date: d("2026-01-01") },
      { value: 380, date: d("2026-02-01") }, // Vorperiode: 80
      { value: 500, date: d("2026-03-01") }, // jüngste: 120
    ];
    const info = latestConsumptionInfo(readings)!;
    expect(info.latest.consumption).toBe(120);
    expect(info.previous?.consumption).toBe(80);
    expect(info.deltaPreviousPct).toBe(50); // 120 vs 80 → +50%
    // Vorjahresperiode endet ~2025-02-01 (≈ 393 Tage vor 2026-03-01, außerhalb
    // Toleranz) → hier liefert der Vergleich die nächste passende Periode.
    expect(info.sameLastYear).not.toBeNull();
  });

  it("liefert Vorjahresvergleich innerhalb der Toleranz", () => {
    const readings = [
      { value: 0, date: d("2025-02-15") },
      { value: 100, date: d("2025-03-15") }, // endet ~1 Jahr vor der jüngsten
      { value: 300, date: d("2026-02-15") },
      { value: 460, date: d("2026-03-15") }, // jüngste: 160
    ];
    const info = latestConsumptionInfo(readings)!;
    expect(info.latest.consumption).toBe(160);
    expect(info.sameLastYear?.consumption).toBe(100);
    expect(info.deltaYearPct).toBe(60); // 160 vs 100 → +60%
  });

  it("gibt null ohne verwertbare Perioden zurück", () => {
    expect(latestConsumptionInfo([{ value: 10, date: d("2026-01-01") }])).toBeNull();
    expect(latestConsumptionInfo([])).toBeNull();
  });
});
