import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { encodeWinAnsi, fitText, wrapText } from "./pdf-text";

describe("encodeWinAnsi", () => {
  it("normalisiert CRLF/CR/Tab, damit widthOfTextAtSize nicht crasht", () => {
    expect(encodeWinAnsi("a\r\nb")).toBe("a\nb");
    expect(encodeWinAnsi("a\rb")).toBe("a\nb");
    expect(encodeWinAnsi("a\tb")).toBe("a b");
    // Kein rohes CR/Tab mehr enthalten.
    expect(encodeWinAnsi("x\r\ny\t z")).not.toMatch(/[\r\t]/);
  });

  it("erhält von Helvetica kodierbare CP1252-Sonderbuchstaben", () => {
    expect(encodeWinAnsi("Šimon Žák")).toBe("Šimon Žák");
    expect(encodeWinAnsi("Œuvre œ Ÿ ƒ")).toBe("Œuvre œ Ÿ ƒ");
  });

  it("bildet Typografie auf ASCII ab", () => {
    expect(encodeWinAnsi("„Test“")).toBe('"Test"');
    expect(encodeWinAnsi("‚x‘")).toBe("'x'");
    expect(encodeWinAnsi("a–b—c")).toBe("a-b-c");
    expect(encodeWinAnsi("x…")).toBe("x...");
    expect(encodeWinAnsi("A→B")).toBe("A->B");
  });

  it("ersetzt echt unkodierbare Zeichen (Emoji, nicht-latein) durch ?", () => {
    expect(encodeWinAnsi("Hallo \u{1f600}")).toBe("Hallo ?");
    expect(encodeWinAnsi("日本語")).toBe("???");
  });

  it("wandelt geschütztes Leerzeichen in normales Leerzeichen", () => {
    expect(encodeWinAnsi("a b")).toBe("a b");
    expect(encodeWinAnsi("a b")).toBe("a b");
  });

  it("behandelt null/undefined als leeren String", () => {
    expect(encodeWinAnsi(null)).toBe("");
    expect(encodeWinAnsi(undefined)).toBe("");
  });

  it("liefert ausschließlich WinAnsi-kodierbaren Text (kein Crash in pdf-lib)", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const nasty = "Zeile1\r\nZeile2\tTab \u{1f600} 日本語 Š €";
    // Darf NICHT werfen:
    expect(() => font.widthOfTextAtSize(encodeWinAnsi(nasty).replace(/\n/g, " "), 10)).not.toThrow();
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
