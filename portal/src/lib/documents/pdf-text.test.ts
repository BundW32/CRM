import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { fitText, normalizeText, wrapText } from "./pdf-text";

describe("normalizeText", () => {
  it("normalisiert CRLF/CR/Tab, damit widthOfTextAtSize nicht crasht", () => {
    expect(normalizeText("a\r\nb")).toBe("a\nb");
    expect(normalizeText("a\rb")).toBe("a\nb");
    expect(normalizeText("a\tb")).toBe("a b");
    expect(normalizeText("x\r\ny\t z")).not.toMatch(/[\r\t]/);
  });

  it("erhält Zeichen, die die eingebettete Schrift darstellen kann", () => {
    expect(normalizeText("Ayşe Şahin-Grünewald")).toBe("Ayşe Şahin-Grünewald");
    expect(normalizeText("Krzysztof Wiśniewski")).toBe("Krzysztof Wiśniewski");
    expect(normalizeText("„Test“ – x…")).toBe("„Test“ – x…");
  });

  it("wandelt geschütztes Leerzeichen in normales Leerzeichen", () => {
    expect(normalizeText("a\u00a0b")).toBe("a b");
    expect(normalizeText("a\u202fb")).toBe("a b");
  });

  it("entfernt übrige Steuerzeichen", () => {
    expect(normalizeText("a\u0007b")).toBe("ab");
  });

  it("behandelt null/undefined als leeren String", () => {
    expect(normalizeText(null)).toBe("");
    expect(normalizeText(undefined)).toBe("");
  });
});

describe("wrapText", () => {
  it("bricht an vorhandenen Zeilenumbrüchen", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    expect(wrapText("a\nb\nc", font, 10, 500)).toEqual(["a", "b", "c"]);
  });

  it("wickelt auf Wortgrenzen um, wenn die Zeile zu breit wird", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const lines = wrapText("Wort Wort Wort Wort", font, 10, 30);
    expect(lines.length).toBeGreaterThan(1);
  });

  it("bricht ein einzelnes überlanges Wort hart um (nichts läuft über den Rand)", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const long = "A".repeat(200);
    const lines = wrapText(long, font, 10, 40);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) {
      expect(font.widthOfTextAtSize(l, 10)).toBeLessThanOrEqual(40);
    }
  });
});

describe("fitText", () => {
  it("lässt passenden Text unverändert", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    expect(fitText("kurz", font, 10, 500)).toBe("kurz");
  });

  it("kürzt nach gemessener Breite, nicht nach Zeichenzahl", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const long = "B&W Immobilien Management UG (haftungsbeschränkt) · Goethestraße 42 · 45964 Gladbeck";
    const max = 85 * (841.89 / 297); // 85 mm – Breite des Anschriftfelds
    const cut = fitText(long, font, 6.5, max);
    expect(cut.length).toBeLessThan(long.length);
    expect(cut.endsWith("...")).toBe(true);
    // Das Versprechen der Funktion: das Ergebnis passt wirklich.
    expect(font.widthOfTextAtSize(cut, 6.5)).toBeLessThanOrEqual(max);
  });

  it("hält die Zusage auch bei sehr schmalen Kästen", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    for (const max of [4, 12, 40, 120]) {
      const cut = fitText("Wohnungseigentümergemeinschaft Lindenhof", font, 10, max);
      expect(font.widthOfTextAtSize(cut, 10)).toBeLessThanOrEqual(max);
    }
  });
});
