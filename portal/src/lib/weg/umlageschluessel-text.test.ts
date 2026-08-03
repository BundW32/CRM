import { describe, expect, it } from "vitest";
import { umlageschluesselText } from "./umlageschluessel-text";

describe("umlageschluesselText", () => {
  it("gibt gewöhnliche Schlüssel im Klartext zurück", () => {
    expect(umlageschluesselText({ distributionKey: "FLAECHE" })).toBe("Wohn-/Nutzfläche");
    expect(umlageschluesselText({ distributionKey: "PERSONEN" })).toBe("Personenzahl");
    expect(umlageschluesselText({ distributionKey: "MEA" })).toBe("Miteigentumsanteile (MEA)");
  });

  it("benennt bei Heizkosten beide Teile der HeizkostenV-Aufteilung", () => {
    // Nur „Verbrauch" läse sich wie eine Verteilung zu 100 % nach Verbrauch —
    // also wie ein Verstoß gegen §§ 7, 8 HeizkostenV, obwohl korrekt gerechnet
    // wurde. Das gäbe dem Mieter das Kürzungsrecht von 15 % (§ 12 Abs. 1).
    expect(
      umlageschluesselText({
        distributionKey: "VERBRAUCH",
        heatingCost: true,
        heatingConsumptionPercent: 70,
      }),
    ).toBe("70 % Verbrauch, 30 % Wohnfläche");

    expect(
      umlageschluesselText({
        distributionKey: "VERBRAUCH",
        heatingCost: true,
        heatingConsumptionPercent: 50,
      }),
    ).toBe("50 % Verbrauch, 50 % Wohnfläche");
  });

  it("behauptet keine Zahl, wenn der Anteil nicht festgehalten wurde", () => {
    // Abrechnungen aus der Zeit vor der Erfassung des Prozentsatzes.
    expect(
      umlageschluesselText({ distributionKey: "VERBRAUCH", heatingCost: true }),
    ).toBe("Verbrauch und Wohnfläche (HeizkostenV)");
    expect(
      umlageschluesselText({
        distributionKey: "VERBRAUCH",
        heatingCost: true,
        heatingConsumptionPercent: null,
      }),
    ).toBe("Verbrauch und Wohnfläche (HeizkostenV)");
  });

  it("lässt Verbrauchszähler ohne HeizkostenV-Kennzeichen unverändert", () => {
    // Kaltwasser oder Allgemeinstrom werden zu Recht rein nach Zähler verteilt.
    expect(umlageschluesselText({ distributionKey: "VERBRAUCH", heatingCost: false })).toBe(
      "Verbrauch",
    );
  });
});
