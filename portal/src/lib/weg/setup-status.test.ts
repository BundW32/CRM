import { describe, expect, it } from "vitest";
import { MANUAL_SETUP_STEPS } from "./setup-status";

// Die Ableitung selbst braucht eine Datenbank und wird in der Preview geprüft.
// Testbar und wichtig ist hier die Liste der von Hand abhakbaren Schritte: Sie
// ist zugleich die Whitelist der Server-Action. Käme ein abgeleiteter Schritt
// darin vor, ließe sich die Einrichtung als fertig melden, obwohl die
// Buchhaltung leer ist.
describe("MANUAL_SETUP_STEPS", () => {
  it("enthält ausschließlich Schritte außerhalb des Systems", () => {
    expect([...MANUAL_SETUP_STEPS].sort()).toEqual(["bestellung", "konto", "unterlagen"]);
  });

  it("enthält keinen Schritt, der aus Daten abgeleitet wird", () => {
    const abgeleitet = [
      "objekt",
      "einheiten",
      "eigentuemer",
      "konten",
      "kostenarten",
      "wirtschaftsplan",
    ];
    for (const key of abgeleitet) {
      expect(MANUAL_SETUP_STEPS).not.toContain(key);
    }
  });
});
