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
import { generateMeetingInvitation } from "./meeting-invitation";
import { renderPlatformInvoicePdf } from "./platform-invoice";
import { generateWirtschaftsplan } from "./wirtschaftsplan";
import { generateEinzelwirtschaftsplaene } from "./einzelwirtschaftsplan";
import {
  generateMietbescheinigung,
  generateWohnungsgeberbescheinigung,
} from "./bescheinigungen";
// Gemeinsamer Prüfhelfer: liest über pdf.js zurück und kommt damit sowohl mit
// den eingebetteten Schriften des Kits als auch mit den noch nicht umgestellten
// Standard-Schriften zurecht.
import { drawnTexts, type DrawnText } from "./test-helpers/pdf-inspect";

const MM = 841.89 / 297;
const PAGE_W = 595.28;
// Satzspiegel des Kits: 20 mm links (DIN 5008), 20 mm rechts.
const LEFT = 20 * MM;
const RIGHT = PAGE_W - 20 * MM;
const TOLERANCE = 0.5; // Punkt

function assertInsideMargins(items: DrawnText[]) {
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
    assertInsideMargins(await drawnTexts(pdf));
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
    assertInsideMargins(await drawnTexts(pdf));
  });
});

describe("Betriebskostenabrechnung: Satzspiegel", () => {
  const basis = {
    issuer: kitIssuer,
    propertyName: "WEG Lindenhof",
    unitLabel: "WE 07",
    tenant: { name: "Ayşe Şahin-Grünewald", salutation: "Frau", lastName: "Şahin-Grünewald" },
    tenantAddress: "Lindenstraße 14\n45964 Gladbeck",
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
        { name: "Heizung und Warmwasser", cents: 90000, totalCents: 900000, keyLabel: "Verbrauch" },
        { name: "Grundsteuer", cents: 30000, totalCents: 300000, keyLabel: "Miteigentumsanteile" },
        { name: "Müllentsorgung", cents: 60000, totalCents: 600000, keyLabel: "Personenzahl" },
      ],
      nonRecoverableRows: [
        { name: "Verwaltervergütung", cents: 30000, totalCents: 300000, keyLabel: "Einheiten" },
      ],
    });
    assertInsideMargins(await drawnTexts(pdf));
  });

  it("bricht bei vielen Positionen um, statt unter den Blattrand zu schreiben", async () => {
    const viele = Array.from({ length: 60 }, (_, i) => ({
      name: `Position ${i + 1}: Betriebskosten nach BetrKV inklusive Nebenleistungen und Zuschlägen`,
      cents: 3000,
      totalCents: 30000,
      keyLabel: "Wohnfläche nach Quadratmetern",
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

describe("Versammlungseinladung: Satzspiegel", () => {
  const basis = {
    issuer: kitIssuer,
    propertyName: "WEG Lindenhof",
    meetingTitle: "Ordentliche Eigentümerversammlung 2026",
    scheduledAt: new Date(2026, 8, 17, 18, 30),
    location: "Gemeindesaal St. Marien, Kirchplatz 3, 45964 Gladbeck",
    videoLink: null,
    city: "Gladbeck",
    createdAt: new Date(2026, 6, 28),
  };

  it("hält die Ränder mit Empfänger", async () => {
    const pdf = await generateMeetingInvitation({
      ...basis,
      recipient: { name: "Ayşe Şahin-Grünewald", salutation: "Frau", lastName: "Şahin-Grünewald" },
      recipientAddress: "Lindenstraße 14\n45964 Gladbeck",
      agenda: [
        { index: 1, title: "Begrüßung", description: null, type: "INFO" as const },
        { index: 2, title: "Jahresabrechnung 2025", description: "Mit Bericht des Beirats.", type: "BESCHLUSS" as const },
      ],
    });
    assertInsideMargins(await drawnTexts(pdf));
  });

  it("hält die Ränder als Vorlagendruck ohne Empfänger", async () => {
    const pdf = await generateMeetingInvitation({ ...basis, agenda: [] });
    assertInsideMargins(await drawnTexts(pdf));
  });

  it("bricht bei langer Tagesordnung um, ohne einen Punkt zu verlieren", async () => {
    const pdf = await generateMeetingInvitation({
      ...basis,
      issuer: langerKitIssuer,
      videoLink: "https://meet.bw-immobilien-management-gladbeck.de/lindenhof-eigentuemerversammlung-2026",
      agenda: Array.from({ length: 40 }, (_, i) => ({
        index: i + 1,
        title: `Beschluss über die Vergabe der Arbeiten am Bauteil ${i + 1} nebst Finanzierung`,
        description:
          "Drei Angebote liegen vor. Die Finanzierung erfolgt aus der Erhaltungsrücklage " +
          "sowie einer Sonderumlage, fällig in zwei Raten.",
        type: "BESCHLUSS" as const,
      })),
    });
    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBeGreaterThan(1);
    const items = await drawnTexts(pdf);
    assertInsideMargins(items);
    // Kein Punkt darf beim Umbruch verlorengehen.
    for (let i = 1; i <= 40; i++) {
      expect(items.some((it) => it.text.startsWith(`TOP ${i}:`)), `TOP ${i} fehlt`).toBe(true);
    }
  });
});

describe("Plattform-Rechnung: Satzspiegel", () => {
  const basis = {
    year: 2026,
    number: 148,
    title: "Portalnutzung Jahresbeitrag 2026",
    vatRate: 19,
    issuedAt: new Date(2026, 6, 28),
    dueAt: new Date(2026, 7, 11),
    createdAt: new Date(2026, 6, 28),
    recipient: {
      name: "Hausverwaltung Kiefer",
      legalName: "Hausverwaltung Kiefer GmbH",
      street: "Rosenweg 3a",
      zip: "45879",
      city: "Gelsenkirchen",
    },
    issuer: {
      legalName: "B&W Immobilien Management UG (haftungsbeschränkt)",
      contactLine: "Goethestraße 42 · 45964 Gladbeck · abrechnung@bw-immobilien.de",
      iban: "DE02 4265 0150 0000 1234 56",
      bank: "Sparkasse Gladbeck",
      vatId: "DE123456789",
    },
  };

  it("hält die Ränder bei üblichen Positionen", async () => {
    const pdf = await renderPlatformInvoicePdf({
      ...basis,
      status: "OFFEN" as const,
      items: [
        { description: "Portalnutzung Grundgebühr (12 Monate)", quantity: 12, unitPriceCents: 4900 },
        { description: "Verwaltete Einheiten über Kontingent", quantity: 34, unitPriceCents: 120 },
      ],
    });
    assertInsideMargins(await drawnTexts(pdf));
  });

  it("bricht bei vielen Positionen um und behält die Summen", async () => {
    const pdf = await renderPlatformInvoicePdf({
      ...basis,
      status: "STORNIERT" as const,
      items: Array.from({ length: 60 }, (_, i) => ({
        description: `Position ${i + 1}: Zusatzleistung mit ausführlicher Bezeichnung im Vertrag`,
        quantity: 3,
        unitPriceCents: 12345,
      })),
    });
    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBeGreaterThan(1);
    const items = await drawnTexts(pdf);
    assertInsideMargins(items);
    expect(items.some((it) => it.text.startsWith("Gesamtbetrag"))).toBe(true);
    // Der Storno-Hinweis darf nicht untergehen.
    expect(items.some((it) => it.text.includes("storniert"))).toBe(true);
  });
});

describe("Bescheinigungen: Satzspiegel", () => {
  const basis = {
    ort: "Gladbeck",
    ausstellungsdatum: new Date(2026, 6, 29),
    unterzeichner: "i. A. B&W Immobilien Management UG für Ayşe Şahin-Grünewald",
    signature: null,
  };

  it("Mietbescheinigung hält die Ränder", async () => {
    const pdf = await generateMietbescheinigung({
      ...basis,
      mieterNamen: ["Ayşe Şahin-Grünewald", "Krzysztof Wiśniewski-Öztürk"],
      wohnungAnschrift: "Lindenstraße 14, 3. Obergeschoss rechts\n45964 Gladbeck",
      mietbeginn: new Date(2021, 3, 1),
      vermieterName: "Wohnungseigentümergemeinschaft Lindenhof-Gladbeck Verwaltungs- und Betreuungsgesellschaft mbH & Co. KG",
      issuer: langerIssuer,
    });
    assertInsideMargins(await drawnTexts(pdf));
  });

  it("Wohnungsgeberbestätigung hält die Ränder", async () => {
    const pdf = await generateWohnungsgeberbescheinigung({
      ...basis,
      wohnungsgeberName: "Wohnungseigentümergemeinschaft Lindenhof-Gladbeck Verwaltungs- und Betreuungsgesellschaft mbH & Co. KG",
      wohnungsgeberStrasse: "Goethestraße 42, Hinterhaus, Aufgang C",
      wohnungsgeberPlzOrt: "45964 Gladbeck-Zweckel",
      wohnungStrasse: "Lindenstraße 14",
      wohnungPlzOrt: "45964 Gladbeck",
      wohnungZusatz: "WE 07, 3. OG rechts",
      mieterNamen: ["Ayşe Şahin-Grünewald", "Krzysztof Wiśniewski-Öztürk"],
      einzugsdatum: new Date(2021, 3, 1),
    });
    assertInsideMargins(await drawnTexts(pdf));
  });

  it("legt überzählige Personen auf eine Anlage, statt sie wegzulassen", async () => {
    const namen = Array.from({ length: 11 }, (_, i) => `Vorname${i + 1} Nachname${i + 1}`);
    const pdf = await generateWohnungsgeberbescheinigung({
      ...basis,
      wohnungsgeberName: "B&W Immobilien Management UG (haftungsbeschränkt)",
      wohnungsgeberStrasse: "Goethestraße 42",
      wohnungsgeberPlzOrt: "45964 Gladbeck",
      wohnungStrasse: "Lindenstraße 14",
      wohnungPlzOrt: "45964 Gladbeck",
      wohnungZusatz: "WE 07",
      mieterNamen: namen,
      einzugsdatum: new Date(2026, 0, 15),
    });
    const items = await drawnTexts(pdf);
    assertInsideMargins(items);
    const alle = items.map((it) => it.text).join(" ");
    for (const name of namen) {
      expect(alle, `Person fehlt: ${name}`).toContain(name.split(" ")[1]);
    }
  });
});

describe("Wirtschaftsplan: Satzspiegel", () => {
  const positionen = Array.from({ length: 24 }, (_, i) => ({
    name: `Kostenart ${i + 1}: Bewirtschaftung, Wartung und Instandhaltung der Gemeinschaftsanlagen`,
    keyLabel: "70 % Verbrauch, 30 % Wohnfläche (HeizkostenV)",
    amountCents: 123456 + i * 1000,
  }));

  it("hält die Ränder und behält alle Positionen", async () => {
    const pdf = await generateWirtschaftsplan({
      propertyName: "Wohnungseigentümergemeinschaft Lindenhof, Lindenstraße 12–16, 45964 Gladbeck-Zweckel",
      issuer: langerKitIssuer,
      year: 2027,
      resolved: null,
      positions: positionen,
      totalCents: positionen.reduce((sum, p) => sum + p.amountCents, 0),
      units: Array.from({ length: 30 }, (_, i) => ({
        label: `WE ${String(i + 1).padStart(2, "0")} · Dachgeschoss links, Stellplatz 3`,
        annualCents: 445000,
        monthlyMinCents: 37083,
        monthlyMaxCents: 37090,
      })),
      generatedAt: new Date(2026, 6, 29),
    });
    const items = await drawnTexts(pdf);
    assertInsideMargins(items);
    const alle = items.map((it) => it.text).join(" ");
    expect(alle).toContain("Beschlussvorlage");
    expect(alle).toContain("Kostenart 24");
    expect(alle).toContain("WE 30");
  });

  it("Einzelwirtschaftsplan hält die Ränder", async () => {
    const pdf = await generateEinzelwirtschaftsplaene({
      propertyName: "Wohnungseigentümergemeinschaft Lindenhof, Lindenstraße 12–16, 45964 Gladbeck-Zweckel",
      issuer: langerKitIssuer,
      year: 2027,
      resolved: { date: new Date(2026, 10, 14), note: "TOP 5 der Versammlung vom 14.11.2026" },
      units: [
        {
          label: "WE 07 · 3. OG rechts",
          ownerNames: ["Ayşe Şahin-Grünewald", "Krzysztof Wiśniewski-Öztürk"],
          positions: positionen.map((p) => ({
            name: p.name,
            keyLabel: p.keyLabel,
            totalCents: p.amountCents,
            shareCents: Math.round(p.amountCents / 12),
          })),
          annualCents: 445750,
          monthlyCents: Array.from({ length: 12 }, () => 37146),
        },
      ],
      generatedAt: new Date(2026, 6, 29),
    });
    assertInsideMargins(await drawnTexts(pdf));
  });
});
