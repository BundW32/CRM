import { describe, expect, it } from "vitest";
import { distributeByWeight, weightsForKey, type Share, type UnitForDistribution } from "./distribution";

const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);

describe("distributeByWeight", () => {
  it("verteilt gleichmäßige Gewichte exakt", () => {
    const r = distributeByWeight(30000, [
      { unitId: "a", weight: 1 },
      { unitId: "b", weight: 1 },
      { unitId: "c", weight: 1 },
    ]);
    expect(r.get("a")).toBe(10000);
    expect(r.get("b")).toBe(10000);
    expect(r.get("c")).toBe(10000);
  });

  it("Restcent-Regel: 100 Cent auf 3 gleiche → Summe exakt, Abweichung max. 1 Cent", () => {
    const r = distributeByWeight(100, [
      { unitId: "a", weight: 1 },
      { unitId: "b", weight: 1 },
      { unitId: "c", weight: 1 },
    ]);
    expect(sum(r)).toBe(100);
    const values = [...r.values()].sort();
    expect(values).toEqual([33, 33, 34]);
  });

  it("ungleiche Gewichte (MEA 500/300/200 von 1000)", () => {
    const r = distributeByWeight(123456, [
      { unitId: "a", weight: 500 },
      { unitId: "b", weight: 300 },
      { unitId: "c", weight: 200 },
    ]);
    expect(sum(r)).toBe(123456);
    expect(r.get("a")).toBe(61728);
    expect(r.get("b")).toBe(37037);
    expect(r.get("c")).toBe(24691);
  });

  it("Summe == total auch bei krummen Gewichten (Fuzz light)", () => {
    const shares: Share[] = [
      { unitId: "a", weight: 763800 }, // 76,38 m² in cm²
      { unitId: "b", weight: 545100 },
      { unitId: "c", weight: 1021700 },
      { unitId: "d", weight: 333333 },
      { unitId: "e", weight: 1 },
    ];
    for (const total of [1, 7, 99, 100001, 123457, 999999999]) {
      expect(sum(distributeByWeight(total, shares))).toBe(total);
    }
  });

  it("0-Gewicht: Einheit erhält nichts, Rest stimmt", () => {
    const r = distributeByWeight(999, [
      { unitId: "a", weight: 0 },
      { unitId: "b", weight: 1 },
    ]);
    expect(r.get("a")).toBe(0);
    expect(r.get("b")).toBe(999);
  });

  it("Einzeleinheit erhält alles", () => {
    const r = distributeByWeight(4711, [{ unitId: "solo", weight: 42 }]);
    expect(r.get("solo")).toBe(4711);
  });

  it("total == 0 → alle 0", () => {
    const r = distributeByWeight(0, [
      { unitId: "a", weight: 1 },
      { unitId: "b", weight: 2 },
    ]);
    expect(r.get("a")).toBe(0);
    expect(r.get("b")).toBe(0);
  });

  it("negatives total / kein Gewicht / keine Einheiten → Fehler", () => {
    expect(() => distributeByWeight(-1, [{ unitId: "a", weight: 1 }])).toThrow();
    expect(() =>
      distributeByWeight(100, [
        { unitId: "a", weight: 0 },
        { unitId: "b", weight: 0 },
      ]),
    ).toThrow();
    expect(() => distributeByWeight(100, [])).toThrow();
    expect(() => distributeByWeight(100.5, [{ unitId: "a", weight: 1 }])).toThrow();
    expect(() => distributeByWeight(100, [{ unitId: "a", weight: -3 }])).toThrow();
  });

  it("deterministisch bei Gleichstand der Reste (frühere Position gewinnt)", () => {
    const r1 = distributeByWeight(101, [
      { unitId: "a", weight: 1 },
      { unitId: "b", weight: 1 },
    ]);
    const r2 = distributeByWeight(101, [
      { unitId: "a", weight: 1 },
      { unitId: "b", weight: 1 },
    ]);
    expect(r1.get("a")).toBe(r2.get("a"));
    expect(sum(r1)).toBe(101);
  });
});

describe("weightsForKey", () => {
  const units: UnitForDistribution[] = [
    { id: "a", label: "a", mea: 500, livingArea: 76.38, personCount: 2, unitType: "WOHNUNG" as const },
    { id: "b", label: "b", mea: 300, livingArea: 54.51, personCount: 1, unitType: "WOHNUNG" as const },
    { id: "c", label: "c", mea: 200, livingArea: 102.17, personCount: 4, unitType: "WOHNUNG" as const },
  ];

  it("MEA nutzt Miteigentumsanteile", () => {
    expect(weightsForKey(units, "MEA")).toEqual([
      { unitId: "a", weight: 500 },
      { unitId: "b", weight: 300 },
      { unitId: "c", weight: 200 },
    ]);
  });

  it("FLAECHE nutzt cm²-Ganzzahlen (keine Float-Artefakte)", () => {
    const w = weightsForKey(units, "FLAECHE");
    expect(w.map((s) => s.weight)).toEqual([763800, 545100, 1021700]);
    expect(w.every((s) => Number.isInteger(s.weight))).toBe(true);
  });

  it("EINHEITEN gewichtet alle gleich", () => {
    expect(weightsForKey(units, "EINHEITEN").every((s) => s.weight === 1)).toBe(true);
  });

  it("PERSONEN nutzt Personenzahl", () => {
    expect(weightsForKey(units, "PERSONEN").map((s) => s.weight)).toEqual([2, 1, 4]);
  });

  it("fehlende Stammdaten → verständlicher Fehler", () => {
    const broken: UnitForDistribution[] = [{ id: "x", label: "x", mea: null, livingArea: null, personCount: null, unitType: "WOHNUNG" as const }];
    expect(() => weightsForKey(broken, "MEA")).toThrow(/MEA/);
    expect(() => weightsForKey(broken, "FLAECHE")).toThrow(/Wohnfläche/);
    expect(() => weightsForKey(broken, "PERSONEN")).toThrow(/Personenzahl/);
  });

  it("VERBRAUCH u. a. sind (noch) nicht über diesen Weg verteilbar", () => {
    expect(() => weightsForKey(units, "VERBRAUCH")).toThrow();
    expect(() => weightsForKey(units, "FESTBETRAG")).toThrow();
    expect(() => weightsForKey(units, "INDIVIDUELL")).toThrow();
  });
});

describe("weightsForKey: JE_STELLPLATZ", () => {
  const wohnungen: UnitForDistribution[] = [
    { id: "a", label: "a", mea: 500, livingArea: 76.38, personCount: 2, unitType: "WOHNUNG" },
    { id: "b", label: "b", mea: 300, livingArea: 54.51, personCount: 1, unitType: "WOHNUNG" },
  ];
  const stellplaetze: UnitForDistribution[] = [
    { id: "st1", label: "st1", mea: 10, livingArea: null, personCount: null, unitType: "STELLPLATZ" },
    { id: "st2", label: "st2", mea: 10, livingArea: null, personCount: null, unitType: "STELLPLATZ" },
  ];

  it("gewichtet nur Einheiten vom Typ Stellplatz — Wohnungen tragen 0", () => {
    expect(weightsForKey([...wohnungen, ...stellplaetze], "JE_STELLPLATZ")).toEqual([
      { unitId: "a", weight: 0 },
      { unitId: "b", weight: 0 },
      { unitId: "st1", weight: 1 },
      { unitId: "st2", weight: 1 },
    ]);
  });

  it("verteilt damit centgenau ausschließlich auf die Stellplätze", () => {
    const shares = distributeByWeight(
      10001,
      weightsForKey([...wohnungen, ...stellplaetze], "JE_STELLPLATZ"),
    );
    expect(shares.get("a")).toBe(0);
    expect(shares.get("b")).toBe(0);
    expect((shares.get("st1") ?? 0) + (shares.get("st2") ?? 0)).toBe(10001);
  });

  it("ohne Stellplatz-Einheit → verständlicher Fehler statt Gewichts-Mathematik", () => {
    expect(() => weightsForKey(wohnungen, "JE_STELLPLATZ")).toThrow(/Stellplatz/);
  });
});

describe("weightsForKey: Stellplätze bei den übrigen Schlüsseln", () => {
  const wohnungen: UnitForDistribution[] = [
    { id: "a", label: "WE 01", mea: 500, livingArea: 76.38, personCount: 2, unitType: "WOHNUNG" },
    { id: "b", label: "WE 02", mea: 300, livingArea: 54.51, personCount: 1, unitType: "WOHNUNG" },
  ];
  const stellplatz: UnitForDistribution = {
    id: "st1",
    label: "TG 01",
    mea: 10,
    livingArea: null,
    personCount: null,
    unitType: "STELLPLATZ",
  };

  it("FLAECHE: Stellplatz ohne Wohnfläche trägt 0 statt die Abrechnung zu blockieren", () => {
    const w = weightsForKey([...wohnungen, stellplatz], "FLAECHE");
    expect(w).toEqual([
      { unitId: "a", weight: 763800 },
      { unitId: "b", weight: 545100 },
      { unitId: "st1", weight: 0 },
    ]);
  });

  it("PERSONEN: Stellplatz ohne Personenzahl trägt 0", () => {
    const w = weightsForKey([...wohnungen, stellplatz], "PERSONEN");
    expect(w.map((s) => s.weight)).toEqual([2, 1, 0]);
  });

  it("EINHEITEN: Stellplätze zählen nicht als Einheit", () => {
    const w = weightsForKey([...wohnungen, stellplatz], "EINHEITEN");
    expect(w).toEqual([
      { unitId: "a", weight: 1 },
      { unitId: "b", weight: 1 },
      { unitId: "st1", weight: 0 },
    ]);
  });

  it("EINHEITEN: nur Stellplätze → verständlicher Fehler", () => {
    expect(() => weightsForKey([stellplatz], "EINHEITEN")).toThrow(/Wohn- oder Gewerbeeinheit/);
  });

  it("Wohneinheit ohne Fläche/Personen bleibt ein Fehler — mit Namen der Einheit", () => {
    const kaputt: UnitForDistribution[] = [
      ...wohnungen,
      { id: "x", label: "WE 03", mea: 200, livingArea: null, personCount: null, unitType: "WOHNUNG" },
    ];
    expect(() => weightsForKey(kaputt, "FLAECHE")).toThrow(/WE 03/);
    expect(() => weightsForKey(kaputt, "PERSONEN")).toThrow(/WE 03/);
    expect(() => weightsForKey([{ ...stellplatz, mea: null }], "MEA")).toThrow(/TG 01/);
  });

  it("Stellplatz mit gepflegter Fläche zählt mit — ausdrückliche Daten gewinnen", () => {
    const mitFlaeche = { ...stellplatz, livingArea: 12.5 };
    const w = weightsForKey([...wohnungen, mitFlaeche], "FLAECHE");
    expect(w[2]).toEqual({ unitId: "st1", weight: 125000 });
  });
});
