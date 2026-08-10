// Wächter gegen den Doppellisten-Fehler: „je Stellplatz" war in der
// Server-Action erlaubt, im Formular aber nicht wählbar — der Schlüssel galt
// als umgesetzt und war es für den Nutzer nicht. Formular und Action lesen
// jetzt dieselbe Konstante; dieser Test hält fest, was sie enthalten muss.
import { describe, expect, it } from "vitest";
import { SONDERUMLAGE_KEYS } from "./keys";

describe("SONDERUMLAGE_KEYS", () => {
  it("enthält die strikten Schlüssel inklusive „je Stellplatz“", () => {
    expect([...SONDERUMLAGE_KEYS]).toEqual([
      "MEA",
      "FLAECHE",
      "EINHEITEN",
      "PERSONEN",
      "JE_STELLPLATZ",
    ]);
  });

  it("enthält keine manuellen Schlüssel — die sind bei Sonderumlagen nicht sinnvoll", () => {
    for (const manuell of ["VERBRAUCH", "FESTBETRAG", "INDIVIDUELL"]) {
      expect(SONDERUMLAGE_KEYS).not.toContain(manuell);
    }
  });
});
