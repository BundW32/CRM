import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";
import { erkenneBelegLokal, leseERechnung, leseRechnungAusText } from "./beleg-lokal";

vi.setConfig({ testTimeout: 30_000 });

const CII = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocument>
    <ram:ID>2026-114</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime><udt:DateTimeString format="102">20260314</udt:DateTimeString></ram:IssueDateTime>
    <ram:IncludedNote><ram:Content>Dachreparatur nach Sturmschaden</ram:Content></ram:IncludedNote>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty><ram:Name>Dachdeckerei M&amp;uuml;ller GmbH</ram:Name></ram:SellerTradeParty>
      <ram:BuyerTradeParty><ram:Name>WEG Lindenhof</ram:Name></ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:SpecifiedTradePaymentTerms>
        <ram:DueDateDateTime><udt:DateTimeString format="102">20260328</udt:DateTimeString></ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>1050.42</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>1050.42</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">199.58</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>1250.00</ram:GrandTotalAmount>
        <ram:DuePayableAmount>1250.00</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;

const UBL = `<?xml version="1.0" encoding="UTF-8"?>
<ubl:Invoice xmlns:ubl="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ID>R-4711</cbc:ID>
  <cbc:IssueDate>2026-04-01</cbc:IssueDate>
  <cbc:DueDate>2026-04-15</cbc:DueDate>
  <cbc:Note>Wartung Aufzug 1. Quartal</cbc:Note>
  <cac:AccountingSupplierParty><cac:Party>
    <cac:PartyName><cbc:Name>Schindler</cbc:Name></cac:PartyName>
    <cac:PartyLegalEntity><cbc:RegistrationName>Schindler Aufzüge GmbH</cbc:RegistrationName></cac:PartyLegalEntity>
  </cac:Party></cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty><cac:Party>
    <cac:PartyName><cbc:Name>WEG Lindenhof</cbc:Name></cac:PartyName>
  </cac:Party></cac:AccountingCustomerParty>
  <cac:LegalMonetaryTotal>
    <cbc:TaxExclusiveAmount currencyID="EUR">403.36</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">480.00</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">480.00</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
</ubl:Invoice>`;

describe("leseERechnung", () => {
  it("liest ZUGFeRD/CII: Nummer, Daten, Verkäufer, zu zahlender Betrag", () => {
    expect(leseERechnung(CII)).toEqual({
      creditor: "Dachdeckerei M&uuml;ller GmbH",
      invoiceNumber: "2026-114",
      invoiceDate: "2026-03-14",
      dueDate: "2026-03-28",
      grossCents: 125000,
      description: "Dachreparatur nach Sturmschaden",
    });
  });

  it("liest XRechnung/UBL und nimmt den eingetragenen Firmennamen", () => {
    expect(leseERechnung(UBL)).toEqual({
      creditor: "Schindler Aufzüge GmbH",
      invoiceNumber: "R-4711",
      invoiceDate: "2026-04-01",
      dueDate: "2026-04-15",
      grossCents: 48000,
      description: "Wartung Aufzug 1. Quartal",
    });
  });

  it("lehnt XML ab, das keine Rechnung ist", () => {
    expect(leseERechnung("<Document><Ntry/></Document>")).toBeNull();
  });
});

describe("leseRechnungAusText", () => {
  const rechnung = [
    "Dachdeckerei Müller GmbH · Hauptstraße 5 · 45964 Gladbeck",
    "Wohnungseigentümergemeinschaft Lindenhof",
    "c/o Hausverwaltung Schulz",
    "Lindenstraße 12",
    "45964 Gladbeck",
    "Rechnung",
    "Rechnungs-Nr.: 2026-114 Rechnungsdatum: 14.03.2026 Kundennr.: 883",
    "Bauvorhaben: Dachreparatur nach Sturmschaden, Lindenstraße 12",
    "Pos. Bezeichnung Menge Einzelpreis Gesamt",
    "1 Dachziegel austauschen 12 Std. 65,00 780,00",
    "2 Material 270,42",
    "Nettobetrag 1.050,42",
    "zzgl. 19 % MwSt. 199,58",
    "Gesamtbetrag 1.250,00 €",
    "Zahlbar innerhalb von 14 Tagen ohne Abzug.",
    "IBAN DE89 3704 0044 0532 0130 00",
  ];

  it("findet Nummer, Daten, Bruttobetrag und Rechnungssteller", () => {
    expect(leseRechnungAusText(rechnung)).toEqual({
      creditor: "Dachdeckerei Müller GmbH · Hauptstraße 5 · 45964 Gladbeck",
      invoiceNumber: "2026-114",
      invoiceDate: "2026-03-14",
      dueDate: "2026-03-28",
      grossCents: 125000,
      description: "Dachreparatur nach Sturmschaden, Lindenstraße 12",
    });
  });

  it("nimmt nie den Nettobetrag und liest ein ausdrückliches Fälligkeitsdatum", () => {
    const zeilen = [
      "Stadtwerke Gladbeck",
      "Rechnungsnummer 4711 vom 01.02.2026",
      "Netto 100,00",
      "Brutto 119,00",
      "Fällig am 15.02.2026",
    ];
    const r = leseRechnungAusText(zeilen);
    expect(r?.grossCents).toBe(11900);
    expect(r?.invoiceDate).toBe("2026-02-01");
    expect(r?.dueDate).toBe("2026-02-15");
    expect(r?.creditor).toBe("Stadtwerke Gladbeck");
  });

  it("gibt null zurück, wenn nichts nach Rechnung aussieht", () => {
    expect(leseRechnungAusText(["Hallo", "Welt"])).toBeNull();
  });
});

describe("erkenneBelegLokal", () => {
  async function textPdf(zeilen: string[], anhang?: { name: string; xml: string }) {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([595, 842]);
    zeilen.forEach((z, i) => page.drawText(z, { x: 50, y: 790 - i * 16, size: 10, font }));
    if (anhang) {
      await doc.attach(new TextEncoder().encode(anhang.xml), anhang.name, {
        mimeType: "application/xml",
      });
    }
    return doc.save();
  }

  it("liest ein Text-PDF Zeile für Zeile", async () => {
    const pdf = await textPdf([
      "Dachdeckerei Mueller GmbH",
      "Rechnungs-Nr.: 2026-114 Rechnungsdatum: 14.03.2026",
      "Gesamtbetrag 1.250,00 EUR",
      "Zahlbar innerhalb von 14 Tagen.",
    ]);
    const res = await erkenneBelegLokal(pdf, "application/pdf");
    expect(res?.quelle).toBe("text");
    expect(res?.daten).toMatchObject({
      creditor: "Dachdeckerei Mueller GmbH",
      invoiceNumber: "2026-114",
      invoiceDate: "2026-03-14",
      dueDate: "2026-03-28",
      grossCents: 125000,
    });
  });

  it("zieht das eingebettete ZUGFeRD-XML dem Text vor", async () => {
    const pdf = await textPdf(["Irgendein Text Gesamtbetrag 9,99"], { name: "factur-x.xml", xml: CII });
    const res = await erkenneBelegLokal(pdf, "application/pdf");
    expect(res?.quelle).toBe("e-rechnung");
    expect(res?.daten.grossCents).toBe(125000);
  });

  it("liest eine XRechnung als XML-Datei", async () => {
    const res = await erkenneBelegLokal(new TextEncoder().encode(UBL), "text/xml");
    expect(res?.quelle).toBe("e-rechnung");
    expect(res?.daten.invoiceNumber).toBe("R-4711");
  });

  it("gibt bei einem PDF ohne Textebene und bei Fotos null zurück", async () => {
    const leer = await textPdf([]);
    expect(await erkenneBelegLokal(leer, "application/pdf")).toBeNull();
    expect(await erkenneBelegLokal(new Uint8Array([0xff, 0xd8]), "image/jpeg")).toBeNull();
  });
});
