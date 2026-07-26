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
    const abgeleitet = ["objekt", "einheiten", "eigentuemer", "konten", "kostenarten"];
    for (const key of abgeleitet) {
      expect(MANUAL_SETUP_STEPS).not.toContain(key);
    }
  });

  // Der Wirtschaftsplan stand einmal als neunter Einrichtungsschritt hier. Er
  // gehört in den Jahresfahrplan: Die Einrichtung erfasst Stammdaten und ist
  // dann fertig, der Plan wiederholt sich jedes Jahr. Als Einrichtungsschritt
  // hätte er die Einrichtung nie enden lassen, solange eine Gemeinschaft ihn
  // noch gar nicht aufstellen kann (unterjährige Übernahme).
  it("führt den Wirtschaftsplan nicht mehr als Einrichtungsschritt", () => {
    expect(MANUAL_SETUP_STEPS).not.toContain("wirtschaftsplan");
  });
});
