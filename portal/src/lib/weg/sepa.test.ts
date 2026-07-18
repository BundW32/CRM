import { describe, expect, it } from "vitest";
import { buildPain008, formatAmount, xmlEscape, type SepaPayment } from "./sepa";

const basePayment = (over: Partial<SepaPayment> = {}): SepaPayment => ({
  endToEndId: "E2E-1",
  mandateRef: "MND-1",
  signedDate: new Date(2025, 0, 15),
  sequence: "RCUR",
  debtorName: "Erika Eigentümerin",
  debtorIban: "DE02 1203 0000 0000 2020 51",
  debtorBic: null,
  amountCents: 22498,
  remittance: "Hausgeld WE 01",
  ...over,
});

const baseInput = (payments: SepaPayment[]) => ({
  msgId: "MSG-2026-0001",
  creationDateTime: new Date(2026, 6, 18, 10, 30, 0),
  creditorName: "WEG Musterstraße 12",
  creditorIban: "DE02120300000000202051",
  creditorBic: null,
  creditorId: "DE98ZZZ09999999999",
  collectionDate: new Date(2026, 6, 25),
  payments,
});

describe("formatAmount", () => {
  it("formatiert Cent als Dezimalbetrag mit Punkt", () => {
    expect(formatAmount(22498)).toBe("224.98");
    expect(formatAmount(100)).toBe("1.00");
    expect(formatAmount(5)).toBe("0.05");
  });
});

describe("xmlEscape", () => {
  it("maskiert XML-Sonderzeichen", () => {
    expect(xmlEscape("Meier & Co <GmbH>")).toBe("Meier &amp; Co &lt;GmbH&gt;");
  });
});

describe("buildPain008", () => {
  it("erzeugt gültiges pain.008.001.02 mit korrekten Summen", () => {
    const xml = buildPain008(baseInput([basePayment(), basePayment({ endToEndId: "E2E-2", amountCents: 21156 })]));
    expect(xml).toContain('xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02"');
    expect(xml).toContain("<NbOfTxs>2</NbOfTxs>");
    // Gesamtsumme 224.98 + 211.56 = 436.54
    expect(xml).toContain("<CtrlSum>436.54</CtrlSum>");
    expect(xml).toContain("<InstdAmt Ccy=\"EUR\">224.98</InstdAmt>");
    expect(xml).toContain("<MndtId>MND-1</MndtId>");
    expect(xml).toContain("<DtOfSgntr>2025-01-15</DtOfSgntr>");
    expect(xml).toContain("<ReqdColltnDt>2026-07-25</ReqdColltnDt>");
    // Gläubiger-ID
    expect(xml).toContain("<Id>DE98ZZZ09999999999</Id>");
  });

  it("entfernt Leerzeichen aus IBAN und setzt NOTPROVIDED ohne BIC", () => {
    const xml = buildPain008(baseInput([basePayment()]));
    expect(xml).toContain("<IBAN>DE02120300000000202051</IBAN>");
    expect(xml).toContain("<Othr><Id>NOTPROVIDED</Id></Othr>");
  });

  it("gruppiert nach Sequenz in getrennte PmtInf-Blöcke", () => {
    const xml = buildPain008(
      baseInput([
        basePayment({ sequence: "FRST", endToEndId: "A" }),
        basePayment({ sequence: "RCUR", endToEndId: "B" }),
        basePayment({ sequence: "RCUR", endToEndId: "C" }),
      ]),
    );
    const pmtInfCount = (xml.match(/<PmtInf>/g) ?? []).length;
    expect(pmtInfCount).toBe(2); // FRST + RCUR
    expect(xml).toContain("<SeqTp>FRST</SeqTp>");
    expect(xml).toContain("<SeqTp>RCUR</SeqTp>");
    // Gesamt-NbOfTxs bleibt 3
    expect(xml).toContain("<NbOfTxs>3</NbOfTxs>");
  });

  it("maskiert Sonderzeichen in Namen/Verwendungszweck", () => {
    const xml = buildPain008(baseInput([basePayment({ debtorName: "Meier & Sohn" })]));
    expect(xml).toContain("<Nm>Meier &amp; Sohn</Nm>");
  });
});
