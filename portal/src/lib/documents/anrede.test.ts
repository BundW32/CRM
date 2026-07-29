import { describe, expect, it } from "vitest";
import { anschriftZeilen, briefAnrede } from "./anrede";

describe("briefAnrede", () => {
  it("bildet die richtige Anrede aus Anrede und Nachname", () => {
    expect(briefAnrede({ salutation: "Frau", lastName: "Şahin-Grünewald", name: "Ayşe Şahin-Grünewald" }))
      .toBe("Sehr geehrte Frau Şahin-Grünewald,");
    expect(briefAnrede({ salutation: "Herr", lastName: "Müller", name: "Jonas Müller" }))
      .toBe("Sehr geehrter Herr Müller,");
  });

  it("nimmt den vollen Namen, wenn kein Nachname hinterlegt ist", () => {
    expect(briefAnrede({ salutation: "Herr", name: "Jonas Müller" }))
      .toBe("Sehr geehrter Herr Jonas Müller,");
  });

  it("unterstellt kein Geschlecht, wenn die Anrede fehlt", () => {
    expect(briefAnrede({ name: "Kim Berger" })).toBe("Guten Tag Kim Berger,");
    expect(briefAnrede({ salutation: "", name: "Kim Berger" })).toBe("Guten Tag Kim Berger,");
  });

  it("bleibt bei mehreren Empfängern allgemein", () => {
    // Eheleute oder Erbengemeinschaft: jede Einzelanrede wäre falsch.
    expect(briefAnrede({ salutation: "Herr", lastName: "Müller", name: "Jonas Müller, Lea Müller" }))
      .toBe("Sehr geehrte Damen und Herren,");
  });

  it("fällt ohne Angaben auf die allgemeine Form zurück", () => {
    expect(briefAnrede(null)).toBe("Sehr geehrte Damen und Herren,");
    expect(briefAnrede({ name: "   " })).toBe("Sehr geehrte Damen und Herren,");
  });
});

describe("anschriftZeilen", () => {
  it("setzt die Anrede auf eine eigene Zeile über den Namen", () => {
    expect(
      anschriftZeilen(
        { salutation: "Frau", name: "Ayşe Şahin-Grünewald" },
        "Lindenstraße 14\n45964 Gladbeck",
      ),
    ).toEqual(["Frau", "Ayşe Şahin-Grünewald", "Lindenstraße 14", "45964 Gladbeck"]);
  });

  it("nutzt den Dativ für Herren, wie die Post ihn erwartet", () => {
    expect(anschriftZeilen({ salutation: "Herr", name: "Jonas Müller" }, null)[0]).toBe("Herrn");
  });

  it("lässt die Anredezeile weg, wenn nichts hinterlegt ist", () => {
    expect(anschriftZeilen({ name: "Kim Berger" }, "Weg 1\n45964 Gladbeck"))
      .toEqual(["Kim Berger", "Weg 1", "45964 Gladbeck"]);
  });

  it("überspringt leere Adresszeilen", () => {
    expect(anschriftZeilen({ name: "Kim Berger" }, "Weg 1\n\n  \n45964 Gladbeck"))
      .toEqual(["Kim Berger", "Weg 1", "45964 Gladbeck"]);
  });
});
