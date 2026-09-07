import { describe, expect, it } from "vitest";
import { mitFreitext, sonstigesFreitext } from "./sonstiges";

describe("sonstigesFreitext", () => {
  it("nimmt den Freitext nur bei „Sonstiges“ an", () => {
    expect(sonstigesFreitext("SONSTIGES", "Zisterne")).toBe("Zisterne");
    expect(sonstigesFreitext("STROM", "Zisterne")).toBeNull();
  });

  it("verwirft den Rest eines ausgeblendeten Felds", () => {
    // Das Freitextfeld bleibt beim Zurückschalten im Formular stehen (sonst
    // verschiebt sich die Feldreihenfolge in Zeilen-Formularen) und sendet
    // seinen alten Inhalt weiter mit. Genau der darf nicht in die Datenbank.
    expect(sonstigesFreitext("GAS", "versehentlich stehengeblieben")).toBeNull();
  });

  it("behandelt leer und nur Leerzeichen wie nicht ausgefüllt", () => {
    expect(sonstigesFreitext("SONSTIGES", "")).toBeNull();
    expect(sonstigesFreitext("SONSTIGES", "   ")).toBeNull();
    expect(sonstigesFreitext("SONSTIGES", null)).toBeNull();
  });

  it("kürzt auf die Höchstlänge und schneidet Leerraum ab", () => {
    expect(sonstigesFreitext("SONSTIGES", "  Zisterne  ")).toBe("Zisterne");
    expect(sonstigesFreitext("SONSTIGES", "x".repeat(200))).toHaveLength(120);
  });

  it("erlaubt einen abweichenden „Sonstiges“-Wert", () => {
    expect(sonstigesFreitext("ANDERES", "Duplexparker", "ANDERES")).toBe("Duplexparker");
  });
});

describe("mitFreitext", () => {
  it("stellt den Freitext voran und behält die Einordnung", () => {
    expect(mitFreitext("Sonstiges", "Zisterne")).toBe("Zisterne (Sonstiges)");
  });

  it("bleibt bei der Kategorie, wenn kein Freitext hinterlegt ist", () => {
    expect(mitFreitext("Strom", null)).toBe("Strom");
    expect(mitFreitext("Strom", "   ")).toBe("Strom");
  });
});
