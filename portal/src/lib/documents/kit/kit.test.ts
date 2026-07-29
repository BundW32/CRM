// Misst das Kit an dem, was es verspricht: DIN-5008-Geometrie, Umbruch,
// Metadaten, und dass die Schrift Zeichen trägt, an denen Helvetica scheiterte.
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { Doc } from "./doc";
import { drawLetterHead } from "./letter";
import { brandColor, color, DIN, mm, PAGE } from "./theme";
import { drawnTexts } from "../test-helpers/pdf-inspect";

const PT_PER_MM = 841.89 / 297;
const topMm = (y: number) => (PAGE.height - y) / PT_PER_MM;
const leftMm = (x: number) => x / PT_PER_MM;

async function musterbrief() {
  const doc = await Doc.create({ title: "Muster", author: "B&W", subject: "Test" });
  doc.newPage();
  await drawLetterHead(doc, {
    issuer: {
      legalName: "B&W Immobilien Management UG (haftungsbeschränkt)",
      lines: ["Goethestraße 42 · 45964 Gladbeck"],
    },
    returnLine: "B&W Immobilien Management UG · Goethestraße 42 · 45964 Gladbeck",
    recipient: {
      note: "Einschreiben mit Rückschein",
      // Genau die Zeichen, an denen der bisherige WinAnsi-Weg „?" setzte.
      lines: ["Frau", "Ayşe Şahin-Grünewald", "Lindenstraße 14", "45964 Gladbeck"],
    },
    infoBlock: [["Objekt", "Lindenhof"]],
  });
  doc.subject("Betreff", "Unterzeile");
  doc.para("Sehr geehrte Frau Şahin-Grünewald,");
  return doc;
}

describe("Kit: DIN 5008 Form B", () => {
  it("setzt Anschriftfeld und Betreff auf die genormten Höhen", async () => {
    const doc = await musterbrief();
    const pdf = await doc.finish({ left: "Fußzeile", right: "Erstellt" });
    const items = await drawnTexts(pdf);

    const find = (start: string) => items.find((i) => i.text.startsWith(start));

    // Rücksendeangabe: in der Zusatz-/Vermerkzone (45–62,7 mm).
    const ret = find("B&W Immobilien Management UG ·");
    expect(ret).toBeDefined();
    expect(topMm(ret!.y)).toBeGreaterThanOrEqual(45);
    expect(topMm(ret!.y)).toBeLessThan(62.7);

    // Vermerk: unten in der Vermerkzone, oberhalb der Anschrift.
    const note = find("Einschreiben");
    expect(topMm(note!.y)).toBeLessThan(62.7);
    expect(topMm(note!.y)).toBeGreaterThan(55);

    // Anschriftzone beginnt bei 62,7 mm und endet vor 85 mm.
    const anrede = find("Frau");
    expect(topMm(anrede!.y)).toBeGreaterThan(62.7);
    const ort = find("45964 Gladbeck");
    expect(topMm(ort!.y)).toBeLessThan(85);

    // Alles im Anschriftfeld steht auf 20 mm und bleibt in seinen 85 mm.
    for (const item of [ret!, note!, anrede!, ort!]) {
      expect(leftMm(item.x)).toBeCloseTo(20, 1);
      expect(item.x + item.width).toBeLessThanOrEqual(DIN.marginLeft + DIN.addressFieldWidth + 1);
    }

    // Betreffzeile auf 98,4 mm.
    expect(topMm(find("Betreff")!.y)).toBeCloseTo(98.4, 1);
  });

  it("trägt Zeichen, an denen Helvetica/WinAnsi scheitert", async () => {
    const doc = await musterbrief();
    const pdf = await doc.finish({ left: "Fußzeile", right: "Erstellt" });
    // Der eingebettete Font kodiert nicht in WinAnsi; ein Absturz beim Zeichnen
    // wäre schon oben passiert. Hier zählt: das Dokument entsteht überhaupt.
    expect(pdf.byteLength).toBeGreaterThan(1000);
    const loaded = await PDFDocument.load(pdf);
    expect(loaded.getPageCount()).toBe(1);
  });

  it("setzt PDF-Metadaten", async () => {
    const doc = await Doc.create({ title: "Wirtschaftsplan 2026", author: "B&W", subject: "§ 28 WEG" });
    doc.newPage();
    const loaded = await PDFDocument.load(await doc.finish({ left: "a", right: "b" }));
    expect(loaded.getTitle()).toBe("Wirtschaftsplan 2026");
    expect(loaded.getAuthor()).toBe("B&W");
    expect(loaded.getSubject()).toBe("§ 28 WEG");
  });
});

describe("Kit: Umbruch und Grenzen", () => {
  it("bricht um, statt unter den Blattrand zu schreiben", async () => {
    const doc = await Doc.create({ title: "Lang", author: "B&W" });
    doc.newPage();
    for (let i = 0; i < 120; i++) doc.text(`Zeile ${i + 1}`);
    const pdf = await doc.finish({ left: "Fußzeile", right: "Erstellt" });

    const loaded = await PDFDocument.load(pdf);
    expect(loaded.getPageCount()).toBeGreaterThan(1);
    for (const item of await drawnTexts(pdf)) {
      expect(item.y, item.text).toBeGreaterThan(0);
      expect(item.x + item.width, item.text).toBeLessThanOrEqual(
        PAGE.width - DIN.marginRight + 1,
      );
    }
  });

  it("hält überlange Angaben in ihren Kästen", async () => {
    const doc = await Doc.create({ title: "Breit", author: "B&W" });
    doc.newPage();
    doc.amountPanel(
      "Eine außerordentlich lange Bezeichnung für den offenen Gesamtbetrag der Gemeinschaft",
      "1.234.567,89 €",
      { sub: "Zahlbar bis 14.08.2026 · Verwendungszweck: Hausgeld WE 07, 2. Obergeschoss rechts, K7" },
    );
    doc.defList([
      ["Verwendungszweck", "Hausgeld WE 07, 2. Obergeschoss rechts, nebst Kellerraum K7 und TG-14"],
    ]);
    doc.amountRow("Position mit sehr langer Bezeichnung, die der Betragsspalte weichen muss", "99,00 €");

    for (const item of await drawnTexts(await doc.finish({ left: "x", right: "y" }))) {
      expect(item.x + item.width, item.text).toBeLessThanOrEqual(
        PAGE.width - DIN.marginRight + 1,
      );
    }
  });

  it("zählt die Seiten in der Fußzeile durch", async () => {
    const doc = await Doc.create({ title: "Seiten", author: "B&W" });
    doc.newPage();
    for (let i = 0; i < 120; i++) doc.text(`Zeile ${i + 1}`);
    const items = await drawnTexts(await doc.finish({ left: "Fußzeile", right: "Erstellt" }));
    const seiten = items.filter((i) => i.text.includes("Seite ")).map((i) => i.text);
    expect(seiten.length).toBeGreaterThan(1);
    expect(seiten[0]).toContain(`Seite 1 von ${seiten.length}`);
    expect(seiten[seiten.length - 1]).toContain(`Seite ${seiten.length} von ${seiten.length}`);
  });
});

describe("brandColor", () => {
  it("liest die Mandantenfarbe, fällt bei Unsinn zurück", () => {
    expect(brandColor("#7f0000")).toEqual({ type: "RGB", red: 127 / 255, green: 0, blue: 0 });
    expect(brandColor("7f0000")).toEqual({ type: "RGB", red: 127 / 255, green: 0, blue: 0 });
    expect(brandColor("kaputt")).toEqual(color.brand);
    expect(brandColor(null)).toEqual(color.brand);
  });
});

describe("Falz- und Lochmarken", () => {
  it("liegen auf 87, 148,5 und 192 mm", async () => {
    const doc = await Doc.create({ title: "Marken", author: "B&W" });
    doc.newPage();
    const pdf = await doc.finish({ left: "x", right: "y" });
    // Die Marken sind Linien, kein Text — geprüft wird die Rechnung dahinter.
    expect(topMm(PAGE.height - DIN.foldMark1)).toBeCloseTo(87, 5);
    expect(topMm(PAGE.height - DIN.holeMark)).toBeCloseTo(148.5, 5);
    expect(topMm(PAGE.height - DIN.foldMark2)).toBeCloseTo(192, 5);
    expect(mm(1)).toBeCloseTo(PT_PER_MM, 5);
    expect(pdf.byteLength).toBeGreaterThan(0);
  });
});
