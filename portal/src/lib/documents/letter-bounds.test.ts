// Misst die erzeugten Briefe: kein Textstück darf den Satzspiegel verlassen,
// und nichts darf unter den Blattrand rutschen.
//
// Hintergrund: Beides ist im Bestand passiert und fiel monatelang nicht auf,
// weil ein fehlplatziertes drawText weder Fehler wirft noch im Normalfall
// sichtbar wird — erst bei langen Objektnamen oder vielen Positionen. Der Test
// prüft deshalb jeden Brief zweimal: mit normalen und mit absichtlich
// überlangen Daten.
import { describe, expect, it } from "vitest";
import { inflateSync } from "node:zlib";
import { PDFArray, PDFDocument, PDFRawStream, StandardFonts } from "pdf-lib";
import { generateMahnung } from "./mahnung";
import { generateBetriebskosten } from "./betriebskosten";

const MM = 841.89 / 297;
const PAGE_W = 595.28;
// Die Briefe setzen links 25 mm, rechts 20 mm.
const LEFT = 25 * MM;
const RIGHT = PAGE_W - 20 * MM;
const TOLERANCE = 0.5; // Punkt

type Drawn = { page: number; x: number; y: number; width: number; text: string };

// Die Briefe schreiben WinAnsi (CP1252). 0x80–0x9F weicht dort von Latin-1 ab –
// ohne diese Tabelle stolpert die Breitenmessung über „€" und die Anführungen.
const CP1252_HIGH =
  "\u20AC\u0081\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u008D\u017D\u008F" +
  "\u0090\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u009D\u017E\u0178";

function fromWinAnsi(bytes: Buffer): string {
  let out = "";
  for (const b of bytes) {
    out += b >= 0x80 && b <= 0x9f ? CP1252_HIGH[b - 0x80] : String.fromCharCode(b);
  }
  return out;
}

// Liest die gezeichneten Textstücke samt Position UND Breite aus dem
// Inhaltsstrom. pdf-lib setzt Text als "1 0 0 1 x y Tm" gefolgt von "<hex> Tj";
// die Schriftgröße steht im vorangehenden "Tf". Damit lässt sich die rechte
// Kante jedes Textstücks ausrechnen — nur die Start-x-Position zu prüfen würde
// genau den Fehler verfehlen, um den es geht.
async function drawnTexts(bytes: Uint8Array): Promise<Drawn[]> {
  const pdf = await PDFDocument.load(bytes);
  const metrics = await PDFDocument.create();
  const regular = await metrics.embedFont(StandardFonts.Helvetica);
  const boldFont = await metrics.embedFont(StandardFonts.HelveticaBold);

  const out: Drawn[] = [];
  pdf.getPages().forEach((page, index) => {
    const contents = page.node.Contents();
    if (!contents) return;
    const refs = contents instanceof PDFArray ? contents.asArray() : [];
    const streams = refs.length
      ? refs.map((ref) => pdf.context.lookup(ref) as PDFRawStream)
      : [contents as unknown as PDFRawStream];

    for (const stream of streams) {
      if (!(stream instanceof PDFRawStream)) continue;
      const raw = Buffer.from(stream.getContents());
      // pdf-lib komprimiert Inhaltsströme beim Speichern.
      const body = (
        stream.dict.toString().includes("FlateDecode") ? inflateSync(raw) : raw
      ).toString("latin1");

      let size = 10;
      let bold = false;
      let x = 0;
      let y = 0;
      for (const line of body.split("\n")) {
        const tf = line.match(/^\/(\S+)\s+([\d.]+)\s+Tf$/);
        if (tf) {
          bold = tf[1].includes("Bold");
          size = Number(tf[2]);
          continue;
        }
        const tm = line.match(/^1 0 0 1 ([\d.-]+) ([\d.-]+) Tm$/);
        if (tm) {
          x = Number(tm[1]);
          y = Number(tm[2]);
          continue;
        }
        const tj = line.match(/^<([0-9A-Fa-f]*)>\s+Tj$/);
        if (tj) {
          const text = fromWinAnsi(Buffer.from(tj[1], "hex"));
          if (!text.trim()) continue;
          const font = bold ? boldFont : regular;
          out.push({ page: index + 1, x, y, width: font.widthOfTextAtSize(text, size), text });
        }
      }
    }
  });
  return out;
}

function assertInsideMargins(items: Drawn[]) {
  expect(items.length).toBeGreaterThan(0);
  for (const it of items) {
    const where = `Seite ${it.page}: "${it.text.slice(0, 60)}"`;
    expect(it.x, where).toBeGreaterThanOrEqual(LEFT - TOLERANCE);
    expect(it.x + it.width, where).toBeLessThanOrEqual(RIGHT + TOLERANCE);
    // Nichts unterhalb des Blattrands – genau das war der stille Datenverlust.
    expect(it.y, where).toBeGreaterThan(0);
  }
}

const issuer = {
  legalName: "B&W Immobilien Management UG (haftungsbeschränkt)",
  contactLine: "Goethestraße 42 · 45964 Gladbeck · verwaltung@bw-immobilien.de",
};
const langerIssuer = {
  legalName:
    "Wohnungseigentümergemeinschaft Lindenhof-Gladbeck Verwaltungs- und Betreuungsgesellschaft mbH & Co. KG",
  contactLine:
    "Goethestraße 42, Hinterhaus, 45964 Gladbeck-Zweckel · verwaltung@bw-immobilien-management-gladbeck.de",
};

describe("Mahnung: Satzspiegel", () => {
  it("hält die Ränder bei normalen Daten", async () => {
    const pdf = await generateMahnung({
      issuer,
      propertyName: "WEG Lindenhof",
      unitLabel: "WE 07",
      level: 2,
      recipientName: "Ayşe Şahin-Grünewald",
      recipientAddress: "Lindenstraße 14\n45964 Gladbeck",
      arrearsCents: 148750,
      paymentDeadline: new Date(2026, 7, 14),
      iban: "DE02 4265 0150 0000 1234 56",
      accountHolder: "WEG Lindenhof",
      createdAt: new Date(2026, 6, 28),
      city: "Gladbeck",
    });
    assertInsideMargins(await drawnTexts(pdf));
  });

  it("hält die Ränder auch bei überlangen Namen", async () => {
    const pdf = await generateMahnung({
      issuer: langerIssuer,
      propertyName:
        "WEG Lindenhof-Nord, Lindenstraße 12–16 und Rosenweg 3a–3f, 45964 Gladbeck-Zweckel",
      unitLabel:
        "WE 07, 2. Obergeschoss rechts, nebst Kellerraum K7 und Tiefgaragenstellplatz TG-14",
      level: 3,
      recipientName: "Dr. Ayşe Şahin-Grünewald von Hohenlohe-Langenburg",
      recipientAddress: "Lindenstraße 14, Hinterhaus, 3. Obergeschoss\n45964 Gladbeck-Zweckel",
      arrearsCents: 1487500,
      paymentDeadline: new Date(2026, 7, 14),
      iban: "DE02 4265 0150 0000 1234 56",
      accountHolder: "Wohnungseigentümergemeinschaft Lindenhof-Nord",
      createdAt: new Date(2026, 6, 28),
      city: "Gladbeck-Zweckel",
    });
    assertInsideMargins(await drawnTexts(pdf));
  });
});

describe("Betriebskostenabrechnung: Satzspiegel", () => {
  const basis = {
    issuer,
    propertyName: "WEG Lindenhof",
    unitLabel: "WE 07",
    tenantName: "Ayşe Şahin-Grünewald",
    year: 2025,
    recoverableSumCents: 180000,
    co2LandlordDeductionCents: 12000,
    tenantCostsCents: 168000,
    months: 12,
    prepaymentMonthlyCents: 12000,
    prepaymentCents: 144000,
    balanceCents: 24000,
    city: "Gladbeck",
    createdAt: new Date(2026, 6, 28),
  };

  it("hält die Ränder bei normalen Daten", async () => {
    const pdf = await generateBetriebskosten({
      ...basis,
      recoverableRows: [
        { name: "Heizung und Warmwasser", cents: 90000 },
        { name: "Grundsteuer", cents: 30000 },
        { name: "Müllentsorgung", cents: 60000 },
      ],
      nonRecoverableRows: [{ name: "Verwaltervergütung", cents: 30000 }],
    });
    assertInsideMargins(await drawnTexts(pdf));
  });

  it("bricht bei vielen Positionen um, statt unter den Blattrand zu schreiben", async () => {
    const viele = Array.from({ length: 60 }, (_, i) => ({
      name: `Position ${i + 1}: Betriebskosten nach BetrKV inklusive Nebenleistungen und Zuschlägen`,
      cents: 3000,
    }));
    const pdf = await generateBetriebskosten({
      ...basis,
      recoverableRows: viele,
      nonRecoverableRows: viele.slice(0, 20),
    });
    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBeGreaterThan(1);
    assertInsideMargins(await drawnTexts(pdf));
  });
});
