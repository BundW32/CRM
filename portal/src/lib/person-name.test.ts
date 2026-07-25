import { describe, expect, it } from "vitest";
import { splitName } from "./person-name";

describe("splitName", () => {
  it("trennt den üblichen Fall Vorname + Nachname", () => {
    expect(splitName("Hakki Gür")).toEqual({ firstName: "Hakki", lastName: "Gür" });
  });

  it("hält mehrteilige Vornamen zusammen", () => {
    expect(splitName("Anna Maria Schmidt")).toEqual({
      firstName: "Anna Maria",
      lastName: "Schmidt",
    });
  });

  it("führt einen einzelnen Namen als Nachnamen", () => {
    expect(splitName("Hausmeisterservice")).toEqual({ firstName: "", lastName: "Hausmeisterservice" });
  });

  it("verträgt mehrfache und umschließende Leerzeichen", () => {
    expect(splitName("  Klaus   Peter  Meier ")).toEqual({
      firstName: "Klaus Peter",
      lastName: "Meier",
    });
  });

  it("liefert bei leerer Eingabe leere Felder", () => {
    expect(splitName("   ")).toEqual({ firstName: "", lastName: "" });
  });
});
