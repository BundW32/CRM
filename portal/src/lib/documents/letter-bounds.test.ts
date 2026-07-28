// Misst die erzeugten Briefe: kein Textstück darf den Satzspiegel verlassen,
// und nichts darf unter den Blattrand rutschen.
//
// Hintergrund: Beides ist im Bestand passiert und fiel monatelang nicht auf,
// weil ein fehlplatziertes drawText weder Fehler wirft noch im Normalfall
// sichtbar wird — erst bei langen Objektnamen oder vielen Positionen. Der Test
// prüft deshalb jeden Brief zweimal: mit normalen und mit absichtlich
// überlangen Daten.
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { generateMahnung } from "./mahnung";
import { generateBetriebskosten } from "./betriebskosten";
// Gemeinsamer Prüfhelfer: liest über pdf.js zurück und kommt damit sowohl mit
// den eingebetteten Schriften des Kits als auch mit den noch nicht umgestellten
// Standard-Schriften zurecht.
import { drawnTexts, type DrawnText } from "./test-helpers/pdf-inspect";

const MM = 841.89 / 297;
const PAGE_W = 595.28;
// Auf das Kit umgestellte Briefe setzen links 20 mm (DIN 5008); die noch nicht
// umgestellten stehen weiterhin auf 25 mm. Rechts sind es überall 20 mm.
const LEFT_KIT = 20 * MM;
const LEFT_ALT = 25 * MM;
const RIGHT = PAGE_W - 20 * MM;
const TOLERANCE = 0.5; // Punkt

function assertInsideMargins(items: DrawnText[], left = LEFT_ALT) {
  expect(items.length).toBeGreaterThan(0);
  for (const it of items) {
    const where = `Seite ${it.page}: "${it.text.slice(0, 60)}"`;
    expect(it.x, where).toBeGreaterThanOrEqual(left - TOLERANCE);
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
// Das Kit nimmt die Absenderangaben zeilenweise statt als eine Kontaktzeile.
const kitIssuer = { legalName: issuer.legalName, lines: [issuer.contactLine] };
const langerKitIssuer = { legalName: langerIssuer.legalName, lines: [langerIssuer.contactLine] };

describe("Mahnung: Satzspiegel", () => {
  it("hält die Ränder bei normalen Daten", async () => {
    const pdf = await generateMahnung({
      issuer: kitIssuer,
      propertyName: "WEG Lindenhof",
      unitLabel: "WE 07",
      level: 2,
      recipient: { name: "Ayşe Şahin-Grünewald", salutation: "Frau", lastName: "Şahin-Grünewald" },
      recipientAddress: "Lindenstraße 14\n45964 Gladbeck",
      arrearsCents: 148750,
      paymentDeadline: new Date(2026, 7, 14),
      iban: "DE02 4265 0150 0000 1234 56",
      accountHolder: "WEG Lindenhof",
      createdAt: new Date(2026, 6, 28),
      city: "Gladbeck",
    });
    assertInsideMargins(await drawnTexts(pdf), LEFT_KIT);
  });

  it("hält die Ränder auch bei überlangen Namen", async () => {
    const pdf = await generateMahnung({
      issuer: langerKitIssuer,
      propertyName:
        "WEG Lindenhof-Nord, Lindenstraße 12–16 und Rosenweg 3a–3f, 45964 Gladbeck-Zweckel",
      unitLabel:
        "WE 07, 2. Obergeschoss rechts, nebst Kellerraum K7 und Tiefgaragenstellplatz TG-14",
      level: 3,
      recipient: {
        name: "Dr. Ayşe Şahin-Grünewald von Hohenlohe-Langenburg",
        salutation: "Frau",
        lastName: "Şahin-Grünewald von Hohenlohe-Langenburg",
      },
      recipientAddress: "Lindenstraße 14, Hinterhaus, 3. Obergeschoss\n45964 Gladbeck-Zweckel",
      positions: Array.from({ length: 26 }, (_, i) => ({
        label: `Hausgeld ${String((i % 12) + 1).padStart(2, "0")}/${2024 + Math.floor(i / 12)} inkl. Erhaltungsrücklage`,
        cents: 49583,
      })),
      arrearsCents: 1487500,
      paymentDeadline: new Date(2026, 7, 14),
      iban: "DE02 4265 0150 0000 1234 56",
      accountHolder: "Wohnungseigentümergemeinschaft Lindenhof-Nord",
      createdAt: new Date(2026, 6, 28),
      city: "Gladbeck-Zweckel",
    });
    assertInsideMargins(await drawnTexts(pdf), LEFT_KIT);
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
