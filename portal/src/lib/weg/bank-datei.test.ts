import { describe, expect, it } from "vitest";
import { erkenneFormat, leseBankdatei, zuBuchungen } from "./bank-datei";
import { parseCamt053 } from "./camt";
import { leseVerwendungszweck, parseMt940 } from "./mt940";

// Erfundener, aber formatgetreuer MT940-Auszug (Sparkassen-Schreibweise mit
// deutschen Feldschlüsseln in :86:).
const MT940 = [
  ":20:STARTUMSE",
  ":25:50050000/1234567890",
  ":28C:00003/001",
  ":60F:C260101EUR12345,67",
  ":61:2601020102CR245,50NTRFNONREF//SP0001",
  ":86:166?00SEPA-GUTSCHRIFT?20EREF+2026-01-HG?21SVWZ+Hausgeld WE 01 Ja",
  "?22nuar 2026?30BYLADEM1001?31DE02120300000000202051?32Mustermann, Eri",
  "?33ka",
  ":61:2601050105DR89,00NDDTNONREF//SP0002",
  ":86:105?00LASTSCHRIFT?20SVWZ+Abschlag Allgemeinstrom?21 Zaehler 4711?32Stadtwerke Gladbeck",
  // Storno einer Gutschrift: RC wirkt wie eine Belastung.
  ":61:2601070107RC50,00NRTINONREF//SP0003",
  ":86:109?00STORNO GUTSCHRIFT?20Rueckbuchung Doppelzahlung?32Mustermann, Erika",
  ":61:2601080108D1.234,56NMSCNONREF",
  ":86:177?00UEBERWEISUNG?20Jahresbeitrag Versicherung?32Versicherung AG",
  ":62F:C260131EUR12167,61",
].join("\r\n");

// Jahreswechsel: Valuta 02.01.2026, gebucht am 30.12. — also 2025.
const MT940_JAHRESWECHSEL = [
  ":20:STARTUMSE",
  ":25:50050000/1234567890",
  ":61:2601021230D1.234,56NMSCNONREF",
  ":86:177?00UEBERWEISUNG?20Jahresbeitrag Versicherung?32Versicherung AG",
  ":62F:C260131EUR100,00",
].join("\r\n");

const CAMT = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02">
  <BkToCstmrStmt>
    <Stmt>
      <Acct><Id><IBAN>DE11500105170000000001</IBAN></Id></Acct>
      <Ntry>
        <Amt Ccy="EUR">245.50</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <BookgDt><Dt>2026-01-02</Dt></BookgDt>
        <ValDt><Dt>2026-01-02</Dt></ValDt>
        <NtryDtls><TxDtls>
          <RltdPties>
            <Dbtr><Nm>Mustermann, Erika</Nm></Dbtr>
            <Cdtr><Nm>WEG Musterstr. 12</Nm></Cdtr>
          </RltdPties>
          <RmtInf><Ustrd>Hausgeld WE 01 Januar 2026</Ustrd></RmtInf>
        </TxDtls></NtryDtls>
      </Ntry>
      <Ntry>
        <Amt Ccy="EUR">1234.56</Amt>
        <CdtDbtInd>DBIT</CdtDbtInd>
        <BookgDt><Dt>2026-01-08</Dt></BookgDt>
        <NtryDtls><TxDtls>
          <RltdPties>
            <Dbtr><Nm>WEG Musterstr. 12</Nm></Dbtr>
            <Cdtr><Nm>Geb&#228;udeversicherung AG</Nm></Cdtr>
          </RltdPties>
          <RmtInf><Ustrd>Jahresbeitrag Police 4711</Ustrd><Ustrd>Objekt Gladbeck</Ustrd></RmtInf>
        </TxDtls></NtryDtls>
      </Ntry>
      <Ntry>
        <Amt Ccy="EUR">50.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <RvslInd>true</RvslInd>
        <BookgDt><Dt>2026-01-09</Dt></BookgDt>
        <AddtlNtryInf>Rueckbuchung Doppelzahlung</AddtlNtryInf>
      </Ntry>
      <Ntry>
        <Amt Ccy="EUR">443.50</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <BookgDt><Dt>2026-01-12</Dt></BookgDt>
        <NtryDtls>
          <TxDtls>
            <Amt Ccy="EUR">245.50</Amt>
            <RltdPties><Dbtr><Nm>Beispiel, Max</Nm></Dbtr></RltdPties>
            <RmtInf><Ustrd>Hausgeld WE 02 Januar 2026</Ustrd></RmtInf>
          </TxDtls>
          <TxDtls>
            <Amt Ccy="EUR">198.00</Amt>
            <RltdPties><Dbtr><Nm>Schulz, Anna</Nm></Dbtr></RltdPties>
            <RmtInf><Ustrd>Hausgeld WE 03 Januar 2026</Ustrd></RmtInf>
          </TxDtls>
        </NtryDtls>
      </Ntry>
    </Stmt>
  </BkToCstmrStmt>
</Document>`;

describe("erkenneFormat", () => {
  it("unterscheidet CSV, MT940 und CAMT am Inhalt", () => {
    expect(erkenneFormat(MT940)).toBe("mt940");
    expect(erkenneFormat(CAMT)).toBe("camt");
    expect(erkenneFormat("Buchungstag;Betrag;Verwendungszweck\n02.01.2026;1,00;Test")).toBe("csv");
    // Eine CSV-Zeile mit Doppelpunkten darf nicht als MT940 durchgehen.
    expect(erkenneFormat("Zeitraum: 01.01.2026;Konto: DE11;\nBuchungstag;Betrag\n02.01.2026;1,00")).toBe(
      "csv",
    );
  });

  it("erkennt CAMT auch mit Namensraum-Präfix", () => {
    expect(erkenneFormat('<ns2:Document xmlns:ns2="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08">')).toBe(
      "camt",
    );
  });
});

describe("MT940", () => {
  const zeilen = parseMt940(MT940);

  it("liest alle Umsätze, auch über Feldgrenzen hinweg", () => {
    expect(zeilen).toHaveLength(4);
  });

  it("Gutschrift: Betrag, Datum, Zweck und Gegenseite", () => {
    const z = zeilen[0];
    expect(z.amountCents).toBe(24550);
    expect(z.bookingDate.toISOString().slice(0, 10)).toBe("2026-01-02");
    // ?21/?22 gehören ohne Trennzeichen aneinander — sonst „Ja nuar".
    expect(z.purpose).toBe("Hausgeld WE 01 Januar 2026");
    expect(z.counterparty).toBe("Mustermann, Erika");
  });

  it("Lastschrift wird negativ", () => {
    expect(zeilen[1].amountCents).toBe(-8900);
    expect(zeilen[1].purpose).toBe("Abschlag Allgemeinstrom Zaehler 4711");
    expect(zeilen[1].counterparty).toBe("Stadtwerke Gladbeck");
  });

  it("RC ist die Stornierung einer Gutschrift und wirkt wie eine Belastung", () => {
    expect(zeilen[2].amountCents).toBe(-5000);
  });

  it("Buchungsdatum über den Jahreswechsel bekommt das richtige Jahr", () => {
    const [z] = parseMt940(MT940_JAHRESWECHSEL);
    // Valuta 02.01.2026, gebucht 30.12. → 2025, nicht 2026.
    expect(z.valueDate?.toISOString().slice(0, 10)).toBe("2026-01-02");
    expect(z.bookingDate.toISOString().slice(0, 10)).toBe("2025-12-30");
    expect(z.amountCents).toBe(-123456);
  });

  it("SEPA-Kennungen werden aufgelöst, Fließtext bleibt stehen", () => {
    expect(leseVerwendungszweck("166?00SEPA-GUTSCHRIFT?20EREF+X?21SVWZ+Miete Mai?32Meier").purpose).toBe(
      "Miete Mai",
    );
    expect(leseVerwendungszweck("051Dauerauftrag Hausgeld Januar").purpose).toBe(
      "Dauerauftrag Hausgeld Januar",
    );
    // Ohne Zweck bleibt der Buchungstext übrig statt einer leeren Zeile.
    expect(leseVerwendungszweck("166?00SEPA-GUTSCHRIFT?32Meier").purpose).toBe("SEPA-GUTSCHRIFT");
  });

  it("eine krumme Zeile macht die Datei nicht unbrauchbar", () => {
    const kaputt = [":20:X", ":61:UNSINN", ":86:egal", ":61:2601020102CR10,00NTRF", ":86:051Test"].join("\n");
    const gelesen = parseMt940(kaputt);
    expect(gelesen).toHaveLength(1);
    expect(gelesen[0].amountCents).toBe(1000);
  });
});

describe("CAMT.053", () => {
  const zeilen = parseCamt053(CAMT);

  it("liest Einträge samt Sammelbuchung", () => {
    // 3 Einzeleinträge + 2 Einzelzahlungen aus der Sammelgutschrift
    expect(zeilen).toHaveLength(5);
  });

  it("die Richtung steht in CdtDbtInd, nicht im Betrag", () => {
    expect(zeilen[0].amountCents).toBe(24550);
    expect(zeilen[1].amountCents).toBe(-123456);
  });

  it("die Gegenseite hängt an der Richtung", () => {
    expect(zeilen[0].counterparty).toBe("Mustermann, Erika"); // Gutschrift → Zahler
    expect(zeilen[1].counterparty).toBe("Gebäudeversicherung AG"); // Belastung → Empfänger
  });

  it("mehrere Ustrd-Zeilen werden zusammengefügt, Entities aufgelöst", () => {
    expect(zeilen[1].purpose).toBe("Jahresbeitrag Police 4711 Objekt Gladbeck");
  });

  it("RvslInd dreht die Richtung um", () => {
    expect(zeilen[2].amountCents).toBe(-5000);
    expect(zeilen[2].purpose).toBe("Rueckbuchung Doppelzahlung");
  });

  it("Sammelbuchung wird in ihre Einzelzahlungen zerlegt", () => {
    const sammel = zeilen.slice(3);
    expect(sammel.map((z) => z.amountCents)).toEqual([24550, 19800]);
    expect(sammel.map((z) => z.counterparty)).toEqual(["Beispiel, Max", "Schulz, Anna"]);
    // Die Summe muss der Sammelgutschrift entsprechen.
    expect(sammel.reduce((s, z) => s + z.amountCents, 0)).toBe(44350);
  });
});

describe("zuBuchungen", () => {
  it("erzeugt dieselben Buchungen und Duplikat-Hashes wie der CSV-Weg", () => {
    const ausMt940 = leseBankdatei("mt940", MT940, "acc1");
    expect(ausMt940).toHaveLength(4);
    expect(ausMt940[0].kind).toBe("EINNAHME");
    expect(ausMt940[0].text).toBe("Hausgeld WE 01 Januar 2026");
    expect(ausMt940[1].kind).toBe("AUSGABE");
    expect(ausMt940[1].amountCents).toBe(8900);

    // Derselbe Umsatz aus CAMT muss denselben Hash tragen wie aus MT940 —
    // sonst erzeugt ein zweiter Import in einem anderen Format Dubletten.
    const [ausCamt] = zuBuchungen(
      [
        {
          bookingDate: new Date(Date.UTC(2026, 0, 2)),
          amountCents: 24550,
          purpose: "Hausgeld WE 01 Januar 2026",
          counterparty: "Mustermann, Erika",
        },
      ],
      "acc1",
    );
    expect(ausCamt.dedupeHash).toBe(ausMt940[0].dedupeHash);
  });
});
