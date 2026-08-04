import { describe, expect, it } from "vitest";
import { mischeFahrplaene, type RoadmapItem } from "./roadmap";

// Der Fahrplan hing bis zum 03.08.2026 an `propIds[0]` — dem ersten Objekt in
// beliebiger Datenbankreihenfolge. Eine WEG mit Wohnhaus und Tiefgarage als
// eigenem Grundbuch sah die Fristen nur eines der beiden, und nicht verlässlich
// desselben. Der stillste Ausgang davon: Eine Frist läuft ab, und im Programm
// stand nie etwas davon.
//
// Diese Prüfung hält das Zusammenführen fest. Sie kommt ohne Datenbank aus,
// weil `mischeFahrplaene` genau dafür vom Laden getrennt ist.

const HAUS = { id: "p-haus", name: "Lindenhof 12" };
const GARAGE = { id: "p-garage", name: "Tiefgarage" };

function item(key: string, due: Date | null, vorrang?: boolean): RoadmapItem {
  return {
    key,
    title: key,
    hint: "",
    href: "/x",
    due,
    status: "soon",
    dueLabel: "",
    ...(vorrang ? { vorrang: true } : {}),
  };
}

describe("Fahrplan über mehrere Objekte", () => {
  it("sortiert nach Dringlichkeit, nicht objektweise", () => {
    const gemischt = mischeFahrplaene(
      [HAUS, GARAGE],
      [
        [item("spaet", new Date(2026, 11, 31))],
        [item("frueh", new Date(2026, 0, 31))],
      ],
    );
    // Ohne echtes Mischen stünde „spaet" oben, weil es zum ersten Objekt gehört.
    expect(gemischt.map((i) => i.propertyName)).toEqual(["Tiefgarage", "Lindenhof 12"]);
  });

  it("hält Vorrang über Objektgrenzen hinweg ganz oben", () => {
    const gemischt = mischeFahrplaene(
      [HAUS, GARAGE],
      [[item("mit-frist", new Date(2026, 0, 1))], [item("erster-plan", null, true)]],
    );
    expect(gemischt[0].key).toBe("p-garage:erster-plan");
  });

  it("macht gleichnamige Schlüssel je Objekt eindeutig", () => {
    // Beide Objekte brauchen eine Jahresabrechnung – ohne Präfix stünde
    // derselbe Schlüssel zweimal, und React zeigte eine der beiden Zeilen nicht.
    const gemischt = mischeFahrplaene(
      [HAUS, GARAGE],
      [[item("abrechnung", new Date(2026, 5, 30))], [item("abrechnung", new Date(2026, 5, 30))]],
    );
    expect(new Set(gemischt.map((i) => i.key)).size).toBe(2);
  });

  it("trägt jeden Eintrag mit seinem Objekt", () => {
    const gemischt = mischeFahrplaene([HAUS, GARAGE], [[item("a", null)], [item("b", null)]]);
    expect(gemischt.find((i) => i.key.endsWith(":a"))?.propertyId).toBe("p-haus");
    expect(gemischt.find((i) => i.key.endsWith(":b"))?.propertyName).toBe("Tiefgarage");
  });

  it("kommt mit einem Objekt ohne Aufgaben zurecht", () => {
    expect(mischeFahrplaene([HAUS, GARAGE], [[], []])).toEqual([]);
  });
});
