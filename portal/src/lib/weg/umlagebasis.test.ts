import { describe, expect, it } from "vitest";
import type { UnitForDistribution } from "./distribution";
import { anteilVon, baueUmlagebasis, schluesselMitAnteil, umlagebasisZeilen } from "./umlagebasis";

const units: UnitForDistribution[] = [
  { id: "we1", label: "WE 1", mea: 205, livingArea: 90, personCount: 2, unitType: "WOHNUNG" },
  { id: "we2", label: "WE 2", mea: 395, livingArea: 160.5, personCount: 4, unitType: "WOHNUNG" },
  { id: "we3", label: "WE 3", mea: 380, livingArea: 249.5, personCount: 6, unitType: "TEILEIGENTUM" },
  // Stellplatz: MEA ja, Fläche und Personen nein — genau wie in `weightsForKey`.
  { id: "st1", label: "TG 1", mea: 20, livingArea: null, personCount: null, unitType: "STELLPLATZ" },
];

describe("baueUmlagebasis", () => {
  it("summiert dieselben Nenner, mit denen die Verteilung rechnet", () => {
    const b = baueUmlagebasis(units);
    expect(b.meaSumme).toBe(1000);
    expect(b.flaecheSumme).toBeCloseTo(500);
    expect(b.personenSumme).toBe(12);
    // Stellplätze zählen beim Schlüssel „je Einheit" nicht mit.
    expect(b.einheitenSumme).toBe(3);
    expect(b.stellplaetzeSumme).toBe(1);
  });
});

describe("anteilVon", () => {
  const b = baueUmlagebasis(units);

  it("nennt Zähler und Nenner in deutscher Schreibweise", () => {
    expect(anteilVon("MEA", b, "we1")).toEqual({ einheit: "205", gesamt: "1.000" });
    expect(anteilVon("FLAECHE", b, "we1")).toEqual({ einheit: "90,00 m²", gesamt: "500,00 m²" });
    expect(anteilVon("EINHEITEN", b, "we1")).toEqual({ einheit: "1", gesamt: "3" });
    expect(anteilVon("PERSONEN", b, "we2")).toEqual({ einheit: "4", gesamt: "12" });
    expect(anteilVon("JE_STELLPLATZ", b, "st1")).toEqual({ einheit: "1", gesamt: "1" });
  });

  it("behauptet nichts, wo die Einheit keinen Wert trägt", () => {
    expect(anteilVon("FLAECHE", b, "st1")).toBeNull();
    expect(anteilVon("EINHEITEN", b, "st1")).toBeNull();
    expect(anteilVon("JE_STELLPLATZ", b, "we1")).toBeNull();
    expect(anteilVon("VERBRAUCH", b, "we1")).toBeNull();
    expect(anteilVon("FESTBETRAG", b, "we1")).toBeNull();
    expect(anteilVon("MEA", b, "unbekannt")).toBeNull();
  });
});

describe("schluesselMitAnteil", () => {
  const b = baueUmlagebasis(units);

  it("hängt den Anteil an den Schlüsselnamen", () => {
    expect(schluesselMitAnteil("Wohn-/Nutzfläche", { distributionKey: "FLAECHE" }, b, "we1")).toBe(
      "Wohn-/Nutzfläche (90,00 m² / 500,00 m²)",
    );
    expect(schluesselMitAnteil("Miteigentumsanteile (MEA)", { distributionKey: "MEA" }, b, "we2")).toBe(
      "Miteigentumsanteile (MEA) (395 / 1.000)",
    );
  });

  it("lässt Heizkosten und unbekannte Basis unverändert", () => {
    const heiz = { distributionKey: "VERBRAUCH" as const, heatingCost: true };
    expect(schluesselMitAnteil("70 % Verbrauch, 30 % Wohnfläche", heiz, b, "we1")).toBe(
      "70 % Verbrauch, 30 % Wohnfläche",
    );
    expect(schluesselMitAnteil("Wohn-/Nutzfläche", { distributionKey: "FLAECHE" }, null, "we1")).toBe(
      "Wohn-/Nutzfläche",
    );
  });
});

describe("umlagebasisZeilen", () => {
  const b = baueUmlagebasis(units);

  it("nennt nur die Schlüssel, die in der Abrechnung vorkommen", () => {
    const zeilen = umlagebasisZeilen(
      [{ distributionKey: "MEA" }, { distributionKey: "EINHEITEN" }, { distributionKey: "MEA" }],
      b,
      "we1",
    );
    expect(zeilen).toEqual([
      { schluessel: "Miteigentumsanteile", einheit: "205", gesamt: "1.000" },
      { schluessel: "Einheiten", einheit: "1", gesamt: "3" },
    ]);
  });

  it("bringt bei Heizkosten die Flächenzeile mit (Grundkosten nach HeizkostenV)", () => {
    const zeilen = umlagebasisZeilen(
      [{ distributionKey: "VERBRAUCH", heatingCost: true }],
      b,
      "we1",
    );
    expect(zeilen).toEqual([{ schluessel: "Wohn-/Nutzfläche", einheit: "90,00 m²", gesamt: "500,00 m²" }]);
  });

  it("ist leer ohne Basis (ältere Snapshots)", () => {
    expect(umlagebasisZeilen([{ distributionKey: "MEA" }], undefined, "we1")).toEqual([]);
  });
});
