import { describe, expect, it } from "vitest";
import { ankerFuer, gliederung, leseInline, leseMarkdown, nurText } from "./markdown";

describe("leseInline", () => {
  it("erkennt fett, kursiv, Code und Links", () => {
    const t = leseInline('Klicken Sie **„Speichern"**, dann *warten*, `code` und [Konto](/konto).');
    expect(t.map((k) => k.art)).toEqual([
      "text", "fett", "text", "kursiv", "text", "code", "text", "link", "text",
    ]);
    const link = t.find((k) => k.art === "link");
    expect(link && link.art === "link" ? link.href : null).toBe("/konto");
  });

  it("lässt unbekannte Zeichen als Text stehen — auch HTML", () => {
    const t = leseInline("<script>alert(1)</script> & 3 < 4");
    expect(t).toEqual([{ art: "text", text: "<script>alert(1)</script> & 3 < 4" }]);
  });
});

describe("leseMarkdown", () => {
  it("liest Überschriften mit Ankern, Absätze und Listen", () => {
    const b = leseMarkdown(`## Rechnung schon bezahlt

Erster Absatz
über zwei Zeilen.

- Punkt eins
- Punkt **zwei**

1. Schritt
2. Schritt
`);
    expect(b[0]).toMatchObject({ art: "ueberschrift", ebene: 2, id: "rechnung-schon-bezahlt" });
    expect(b[1]).toMatchObject({ art: "absatz" });
    expect(b[1].art === "absatz" ? nurText(b[1].kinder) : null).toBe("Erster Absatz über zwei Zeilen.");
    expect(b[2]).toMatchObject({ art: "liste", nummeriert: false });
    expect(b[3]).toMatchObject({ art: "liste", nummeriert: true });
    expect((b[3] as { punkte: unknown[] }).punkte).toHaveLength(2);
  });

  it("liest Tabellen und Zitate", () => {
    const b = leseMarkdown(`| Schlüssel | Bedeutung |
|---|---|
| MEA | Anteil |
| Fläche | m² |

> Hinweis: nur ein Satz.
`);
    expect(b[0]).toMatchObject({ art: "tabelle" });
    const tab = b[0] as { kopf: unknown[]; zeilen: unknown[][] };
    expect(tab.kopf).toHaveLength(2);
    expect(tab.zeilen).toHaveLength(2);
    expect(b[1]).toMatchObject({ art: "zitat" });
  });

  it("liefert die Gliederung aus den Zwischenüberschriften", () => {
    const g = gliederung(leseMarkdown("## Eins\n\ntext\n\n### Eins a\n\n## Zwei"));
    expect(g).toEqual([
      { id: "eins", titel: "Eins", ebene: 2 },
      { id: "eins-a", titel: "Eins a", ebene: 3 },
      { id: "zwei", titel: "Zwei", ebene: 2 },
    ]);
  });
});

describe("ankerFuer", () => {
  it("ersetzt Umlaute und Sonderzeichen", () => {
    expect(ankerFuer("Beschlüsse & Versammlungen (§ 23)")).toBe("beschluesse-versammlungen-23");
  });
});
