import { describe, expect, it } from "vitest";
import {
  dedupeHash,
  guessMapping,
  mapRows,
  parseCsv,
  parseGermanDate,
  parseSignedEuroToCents,
} from "./bank-import";

// Sparkasse (CSV-CAMT-Format, Semikolon, deutsche Beträge)
const SPARKASSE = [
  '"Auftragskonto";"Buchungstag";"Valutadatum";"Buchungstext";"Verwendungszweck";"Beguenstigter/Zahlungspflichtiger";"Kontonummer/IBAN";"BIC (SWIFT-Code)";"Betrag";"Waehrung";"Info"',
  '"DE11500105170000000001";"02.01.2026";"02.01.2026";"GUTSCHR. UEBERWEISUNG";"Hausgeld WE 01 Januar";"Erika Mustermann";"DE02120300000000202051";"BYLADEM1001";"245,50";"EUR";"Umsatz gebucht"',
  '"DE11500105170000000001";"05.01.2026";"05.01.2026";"LASTSCHRIFT";"Stadtwerke Abschlag Allgemeinstrom";"Stadtwerke Gladbeck";"DE44100110012345678901";"NTSBDEB1XXX";"-89,00";"EUR";"Umsatz gebucht"',
].join("\r\n");

// Volksbank / VR-Bank (neueres Format)
const VOLKSBANK = [
  "Bezeichnung Auftragskonto;IBAN Auftragskonto;Buchungstag;Valutadatum;Name Zahlungsbeteiligter;IBAN Zahlungsbeteiligter;Verwendungszweck;Betrag;Waehrung",
  "WEG Musterstr. 12;DE33600501010000000002;03.01.2026;03.01.2026;Max Beispiel;DE21301204000000015228;Hausgeld WE 02 Januar 2026;198,00;EUR",
  "WEG Musterstr. 12;DE33600501010000000002;08.01.2026;08.01.2026;Gebaeudeversicherung AG;DE87200500001234567890;Jahresbeitrag Police 4711;-1.234,56;EUR",
].join("\n");

describe("parseCsv", () => {
  it("parst Sparkasse-CSV (Semikolon, Quotes, CRLF)", () => {
    const { header, rows } = parseCsv(SPARKASSE);
    expect(header[1]).toBe("Buchungstag");
    expect(rows).toHaveLength(2);
    expect(rows[0][4]).toBe("Hausgeld WE 01 Januar");
    expect(rows[1][8]).toBe("-89,00");
  });

  it("parst Volksbank-CSV (ohne Quotes, LF)", () => {
    const { header, rows } = parseCsv(VOLKSBANK);
    expect(header).toContain("Verwendungszweck");
    expect(rows).toHaveLength(2);
  });

  it("Komma-getrennt mit Autodetect", () => {
    const { header, rows } = parseCsv('Datum,Betrag,Zweck\n"02.01.2026","1,50",Test');
    expect(header).toEqual(["Datum", "Betrag", "Zweck"]);
    expect(rows[0]).toEqual(["02.01.2026", "1,50", "Test"]);
  });

  it("escaped Quotes und Leerzeilen", () => {
    const { rows } = parseCsv('A;B\n"Sagt ""Hallo""";x\n\n');
    expect(rows).toEqual([['Sagt "Hallo"', "x"]]);
  });
});

describe("guessMapping", () => {
  it("erkennt Sparkasse-Header", () => {
    const { header } = parseCsv(SPARKASSE);
    const m = guessMapping(header);
    expect(m.date).toBe(1); // Buchungstag
    expect(m.amount).toBe(8); // Betrag
    expect(m.purpose).toBe(4); // Verwendungszweck
    expect(m.counterparty).toBe(5); // Beguenstigter/Zahlungspflichtiger
  });

  it("erkennt Volksbank-Header", () => {
    const { header } = parseCsv(VOLKSBANK);
    const m = guessMapping(header);
    expect(m.date).toBe(2);
    expect(m.amount).toBe(7);
    expect(m.purpose).toBe(6);
    expect(m.counterparty).toBe(4); // Name Zahlungsbeteiligter
  });

  it("unbekannte Header → leere Vorschläge statt falscher Treffer", () => {
    const m = guessMapping(["Foo", "Bar"]);
    expect(m.date).toBeUndefined();
    expect(m.amount).toBeUndefined();
  });
});

describe("parseGermanDate / parseSignedEuroToCents", () => {
  it("dd.mm.yyyy, dd.mm.yy und ISO", () => {
    expect(parseGermanDate("02.01.2026")?.toISOString().slice(0, 10)).toBe("2026-01-02");
    expect(parseGermanDate("2.1.26")?.toISOString().slice(0, 10)).toBe("2026-01-02");
    expect(parseGermanDate("2026-01-02")?.toISOString().slice(0, 10)).toBe("2026-01-02");
    expect(parseGermanDate("32.13.2026")).toBeNull();
    expect(parseGermanDate("Anfangssaldo")).toBeNull();
  });

  it("negative Beträge → negative Cents", () => {
    expect(parseSignedEuroToCents("-1.234,56")).toBe(-123456);
    expect(parseSignedEuroToCents("245,50")).toBe(24550);
    expect(parseSignedEuroToCents("+89,00")).toBe(8900);
    expect(parseSignedEuroToCents("1234.56")).toBe(123456);
    expect(parseSignedEuroToCents("")).toBeNull();
    expect(parseSignedEuroToCents("abc")).toBeNull();
  });
});

describe("mapRows", () => {
  it("Sparkasse: Einnahme + Ausgabe korrekt gemappt", () => {
    const { header, rows } = parseCsv(SPARKASSE);
    const m = guessMapping(header);
    const parsed = mapRows(rows, { date: m.date!, amount: m.amount!, purpose: m.purpose!, counterparty: m.counterparty }, "acc1");
    expect(parsed).toHaveLength(2);
    expect(parsed[0].kind).toBe("EINNAHME");
    expect(parsed[0].amountCents).toBe(24550);
    expect(parsed[0].counterparty).toBe("Erika Mustermann");
    expect(parsed[1].kind).toBe("AUSGABE");
    expect(parsed[1].amountCents).toBe(8900);
    expect(parsed[1].reference).toBe("Stadtwerke Abschlag Allgemeinstrom");
  });

  it("Volksbank: 1.234,56-Ausgabe korrekt", () => {
    const { header, rows } = parseCsv(VOLKSBANK);
    const m = guessMapping(header);
    const parsed = mapRows(rows, { date: m.date!, amount: m.amount!, purpose: m.purpose!, counterparty: m.counterparty }, "acc1");
    expect(parsed[1].kind).toBe("AUSGABE");
    expect(parsed[1].amountCents).toBe(123456);
  });

  it("Fußzeilen/Saldozeilen werden übersprungen, nicht abgebrochen", () => {
    const rows = [
      ["02.01.2026", "10,00", "ok"],
      ["Anfangssaldo", "", ""],
      ["", "1.000,00", "Endsaldo"],
    ];
    const parsed = mapRows(rows, { date: 0, amount: 1, purpose: 2 }, "acc1");
    expect(parsed).toHaveLength(1);
    expect(parsed[0].text).toBe("ok");
  });

  it("Null-Beträge werden übersprungen", () => {
    const parsed = mapRows([["02.01.2026", "0,00", "storno"]], { date: 0, amount: 1, purpose: 2 }, "acc1");
    expect(parsed).toHaveLength(0);
  });
});

describe("dedupeHash", () => {
  const d = new Date(Date.UTC(2026, 0, 2));

  it("stabil: gleiche Eingaben → gleicher Hash (auch bei Whitespace/Case im Zweck)", () => {
    expect(dedupeHash("acc1", d, 24550, "Hausgeld  WE 01")).toBe(dedupeHash("acc1", d, 24550, "hausgeld we 01 "));
  });

  it("kollisionsfrei über Konto, Datum, Betrag, Zweck", () => {
    const base = dedupeHash("acc1", d, 24550, "Hausgeld");
    expect(dedupeHash("acc2", d, 24550, "Hausgeld")).not.toBe(base);
    expect(dedupeHash("acc1", new Date(Date.UTC(2026, 0, 3)), 24550, "Hausgeld")).not.toBe(base);
    expect(dedupeHash("acc1", d, 24551, "Hausgeld")).not.toBe(base);
    expect(dedupeHash("acc1", d, -24550, "Hausgeld")).not.toBe(base);
    expect(dedupeHash("acc1", d, 24550, "Hausgeld 2")).not.toBe(base);
  });

  it("mapRows erzeugt identische Hashes für identische Umsätze (Duplikaterkennung)", () => {
    const { header, rows } = parseCsv(SPARKASSE);
    const m = guessMapping(header);
    const mapping = { date: m.date!, amount: m.amount!, purpose: m.purpose! };
    const a = mapRows(rows, mapping, "acc1");
    const b = mapRows(rows, mapping, "acc1");
    expect(a[0].dedupeHash).toBe(b[0].dedupeHash);
    expect(a[0].dedupeHash).not.toBe(a[1].dedupeHash);
  });
});
