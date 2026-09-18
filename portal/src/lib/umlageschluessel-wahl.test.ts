import { describe, expect, it } from "vitest";
import { distributionKeyLabels, waehlbareDistributionKeyLabels } from "./labels";

// FESTBETRAG und INDIVIDUELL waren im Code immer dasselbe. Seit 18.09.2026
// gibt es an der Kostenart nur noch INDIVIDUELL; FESTBETRAG bleibt im Enum für
// alte Snapshots. Dieser Test hält fest, dass der alte Wert in keiner
// Auswahlliste mehr auftaucht — und dass beide gleich beschriftet sind, damit
// eine fertige Abrechnung von damals denselben Namen zeigt wie eine von heute.
describe("Umlageschlüssel-Auswahl", () => {
  it("bietet FESTBETRAG nicht mehr an, alle anderen Schlüssel schon", () => {
    const wahl = Object.keys(waehlbareDistributionKeyLabels);
    expect(wahl).not.toContain("FESTBETRAG");
    expect(wahl).toContain("INDIVIDUELL");
    expect(wahl.length).toBe(Object.keys(distributionKeyLabels).length - 1);
  });

  it("beschriftet FESTBETRAG und INDIVIDUELL gleich", () => {
    expect(distributionKeyLabels.FESTBETRAG).toBe(distributionKeyLabels.INDIVIDUELL);
  });
});
