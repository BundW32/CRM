import { describe, expect, it } from "vitest";
import {
  advanceWeightsForKey,
  computeUnitAdvances,
  fiscalYearMonths,
  fiscalYearRange,
  monthlyInstallments,
  PositionNichtVerteilbar,
} from "./economic-plan";
import type { UnitForDistribution } from "./distribution";

// Demo-WEG: 5 Wohnungen + 1 Stellplatz (ohne Fläche/Personen), MEA-Summe 1000
const units: UnitForDistribution[] = [
  { id: "we1", mea: 180, livingArea: 72.5, personCount: 2, unitType: "WOHNUNG" as const },
  { id: "we2", mea: 175, livingArea: 70.2, personCount: 1, unitType: "WOHNUNG" as const },
  { id: "we3", mea: 180, livingArea: 72.5, personCount: 3, unitType: "WOHNUNG" as const },
  { id: "we4", mea: 175, livingArea: 70.2, personCount: 2, unitType: "WOHNUNG" as const },
  { id: "we5", mea: 240, livingArea: 96.4, personCount: 4, unitType: "WOHNUNG" as const },
  { id: "te6", mea: 50, livingArea: null, personCount: null, unitType: "STELLPLATZ" as const },
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
    const broken = [...units, { id: "x", mea: null, livingArea: 10, personCount: 1, unitType: "WOHNUNG" as const }];
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

  /**
   * Der Fall, an dem eine frisch eingerichtete Gemeinschaft hängen blieb: Die
   * Einrichtung verlangt nur Miteigentumsanteile, der WEG-Standardkatalog
   * verteilt aber auch nach Personenzahl und Fläche. Ohne diese Angaben brach
   * die Verteilung mit „Gesamtgewicht muss größer als 0 sein" ab — einem Satz
   * aus der Rechenmaschine, der weder die Kostenart noch das fehlende Feld
   * nennt. Der Fehler muss beides mitbringen, sonst kann die Oberfläche nicht
   * sagen, wo anzusetzen ist.
   */
  const ohneZusatzdaten = [
    { id: "we1", mea: 400, livingArea: null, personCount: null, unitType: "WOHNUNG" as const },
    { id: "we2", mea: 600, livingArea: null, personCount: null, unitType: "WOHNUNG" as const },
  ];

  it("nennt Kostenart und fehlendes Feld, wenn die Personenzahl fehlt", () => {
    try {
      computeUnitAdvances(
        [{ costTypeId: "muell", distributionKey: "PERSONEN", amountCents: 96_000 }],
        ohneZusatzdaten,
      );
      throw new Error("hätte werfen müssen");
    } catch (e) {
      expect(e).toBeInstanceOf(PositionNichtVerteilbar);
      const f = e as PositionNichtVerteilbar;
      expect(f.costTypeId).toBe("muell");
      expect(f.fehlendesFeld).toBe("personen");
      expect(f.message).toMatch(/Personenzahl/);
    }
  });

  it("nennt die Fläche, wenn sie fehlt", () => {
    try {
      computeUnitAdvances(
        [{ costTypeId: "reinigung", distributionKey: "FLAECHE", amountCents: 240_000 }],
        ohneZusatzdaten,
      );
      throw new Error("hätte werfen müssen");
    } catch (e) {
      expect((e as PositionNichtVerteilbar).fehlendesFeld).toBe("flaeche");
      expect((e as PositionNichtVerteilbar).message).toMatch(/Wohn-\/Nutzfläche/);
    }
  });

  it("verteilt weiter, sobald eine einzige Einheit den Wert trägt", () => {
    const gemischt = [
      { id: "we1", mea: 400, livingArea: null, personCount: 2, unitType: "WOHNUNG" as const },
      { id: "we2", mea: 600, livingArea: null, personCount: null, unitType: "WOHNUNG" as const },
    ];
    const { perItem } = computeUnitAdvances(
      [{ costTypeId: "muell", distributionKey: "PERSONEN", amountCents: 96_000 }],
      gemischt,
    );
    // Fehlende Einzelwerte zählen als 0 – nur wenn ALLE fehlen, ist Schluss.
    expect(perItem.get("muell")?.get("we1")).toBe(96_000);
    expect(perItem.get("muell")?.get("we2")).toBe(0);
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

// ── Einnahmenseite (§ 28 Abs. 1 WEG, Befund B7a) ────────────────────────────

describe("Einnahmen im Wirtschaftsplan", () => {
  const ausgabe = (cents: number) => ({
    costTypeId: "hausmeister",
    distributionKey: "MEA" as const,
    amountCents: cents,
    category: "BETRIEBSKOSTEN" as const,
  });
  const ertrag = (cents: number, key: "MEA" | "FLAECHE" = "MEA") => ({
    costTypeId: "pv",
    distributionKey: key,
    amountCents: cents,
    category: "ERTRAG" as const,
  });

  it("mindern den Vorschussbedarf, statt ihn zu erhöhen", () => {
    const ohne = computeUnitAdvances([ausgabe(1_200_000)], units);
    const mit = computeUnitAdvances([ausgabe(1_200_000), ertrag(300_000)], units);
    expect(ohne.totalCents).toBe(1_200_000);
    expect(mit.totalCents).toBe(900_000);
    expect(mit.expenseCents).toBe(1_200_000);
    expect(mit.incomeCents).toBe(300_000);
  });

  it("verteilen sich centgenau und senken jeden Einzelplan", () => {
    const ohne = computeUnitAdvances([ausgabe(1_200_000)], units);
    const mit = computeUnitAdvances([ausgabe(1_200_000), ertrag(300_000)], units);
    const summe = [...mit.perUnit.values()].reduce((a, b) => a + b, 0);
    expect(summe).toBe(900_000);
    for (const [unitId, cents] of mit.perUnit) {
      expect(cents).toBeLessThan(ohne.perUnit.get(unitId)!);
    }
  });

  it("folgen ihrem eigenen Schlüssel", () => {
    // PV-Erlös nach Fläche: der Stellplatz ohne Wohnfläche bekommt nichts ab
    const r = computeUnitAdvances([ausgabe(1_200_000), ertrag(300_000, "FLAECHE")], units);
    const pv = r.perItem.get("pv")!;
    expect(pv.get("te6")).toBe(0);
    expect([...pv.values()].reduce((a, b) => a + b, 0)).toBe(-300_000);
  });

  it("weisen einen Plan ab, dessen Einnahmen die Ausgaben übersteigen", () => {
    expect(() => computeUnitAdvances([ausgabe(100_000), ertrag(150_000)], units)).toThrow(
      /Einnahmen übersteigen/,
    );
  });
});

describe("Umlageschlüssel JE_STELLPLATZ im Wirtschaftsplan", () => {
  it("verteilt Vorschüsse nur auf die Stellplätze — Wohnungen tragen 0", () => {
    // Die Demo-WEG oben hat genau einen Stellplatz (te6): Er trägt die
    // Position allein, centgenau.
    const { perUnit } = computeUnitAdvances(
      [{ costTypeId: "tor", distributionKey: "JE_STELLPLATZ", amountCents: 60_000 }],
      units,
    );
    expect(perUnit.get("te6")).toBe(60_000);
    expect(perUnit.get("we1")).toBe(0);
  });

  it("ohne Stellplatz-Einheit → PositionNichtVerteilbar mit klarer Meldung", () => {
    const ohneStellplatz = units.filter((u) => u.unitType !== "STELLPLATZ");
    expect(() =>
      computeUnitAdvances(
        [{ costTypeId: "tor", distributionKey: "JE_STELLPLATZ", amountCents: 60_000 }],
        ohneStellplatz,
      ),
    ).toThrow(PositionNichtVerteilbar);
    expect(() =>
      computeUnitAdvances(
        [{ costTypeId: "tor", distributionKey: "JE_STELLPLATZ", amountCents: 60_000 }],
        ohneStellplatz,
      ),
    ).toThrow(/Stellplatz/);
  });
});
