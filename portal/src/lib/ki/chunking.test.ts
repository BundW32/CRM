import { describe, expect, it } from "vitest";
import { istUeberschrift, zerlegeText } from "./chunking";

describe("zerlegeText", () => {
  it("liefert kurze Texte als genau einen unveränderten Chunk", () => {
    const text = "Die Erhaltungsrücklage wird auf 12.000 € festgesetzt.";
    const chunks = zerlegeText(text);
    expect(chunks).toEqual([{ text, abschnitt: null, reihenfolge: 0 }]);
  });

  it("liefert für leeren Text keine Chunks", () => {
    expect(zerlegeText("   \n  ")).toEqual([]);
  });

  it("hält lange Texte unter der Obergrenze und nummeriert fortlaufend", () => {
    const satz = "Die Gemeinschaft hat über die Sanierung der Tiefgarage ausführlich beraten. ";
    const chunks = zerlegeText(satz.repeat(200)); // ≈ 15.600 Zeichen
    expect(chunks.length).toBeGreaterThan(2);
    for (const [i, c] of chunks.entries()) {
      expect(c.text.length).toBeLessThanOrEqual(3200);
      expect(c.reihenfolge).toBe(i);
    }
  });

  it("überlappt aufeinanderfolgende Chunks desselben Abschnitts", () => {
    const satz = "Der Verwalter erläutert die Angebote der drei Fachfirmen im Einzelnen. ";
    const chunks = zerlegeText(satz.repeat(120));
    expect(chunks.length).toBeGreaterThan(1);
    // Der zweite Chunk beginnt mit dem Auslassungszeichen-Anlauf aus dem ersten.
    expect(chunks[1].text.startsWith("… ")).toBe(true);
    const anlauf = chunks[1].text.slice(2, 40);
    expect(chunks[0].text).toContain(anlauf.split("\n")[0]);
  });

  it("trennt an TOP-Überschriften und trägt sie als Abschnitt ein", () => {
    const fueller = "Es folgt eine ausführliche Erörterung mit allen Anwesenden. ".repeat(60);
    const text = `TOP 1 Begrüßung\n\n${fueller}\n\nTOP 2 Wirtschaftsplan 2027\n\n${fueller}`;
    const chunks = zerlegeText(text);
    expect(chunks.some((c) => c.abschnitt === "TOP 1 Begrüßung")).toBe(true);
    expect(chunks.some((c) => c.abschnitt === "TOP 2 Wirtschaftsplan 2027")).toBe(true);
    // Kein Chunk mischt beide TOPs: Wer zu TOP 2 sucht, bekommt nicht TOP 1 zitiert.
    for (const c of chunks) {
      if (c.abschnitt === "TOP 1 Begrüßung") expect(c.text).not.toContain("TOP 2");
    }
  });

  it("erkennt Paragraphen-Überschriften für die Gesetzes-Indexierung (Schicht 1)", () => {
    expect(istUeberschrift("§ 28 Wirtschaftsplan, Jahresabrechnung")).toBe(true);
    expect(istUeberschrift("TOP 4 Sonderumlage")).toBe(true);
    expect(istUeberschrift("## Beschlussvorschlag")).toBe(true);
    expect(istUeberschrift("Die Kosten trägt gemäß § 16 WEG die Gemeinschaft.")).toBe(false);
  });
});
