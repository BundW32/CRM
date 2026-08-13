import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import {
  decodeBankFile,
  normHeader,
  dedupeHash,
  detectMapping,
  guessMapping,
  guessMappingFromRows,
  mapRows,
  mappingComplete,
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

// ── Echte Bankdatei: ohne Kopfzeile, Windows-1252 ────────────────────────────
//
// Anonymisierte Kopie einer Volksbank-Datei (Kontoumsätze 2023) mit identischer
// Byte-Struktur: 391 Zeilen, je 9 Felder, CRLF, Trennzeichen ";", gemischte
// Anführungszeichen, Beträge mit führendem + und Tausenderpunkt, Umlaute und ß
// als Einzelbytes, das Euro-Zeichen als 0x80. An dieser Datei ist der Import
// gescheitert; sie ist deshalb der Kern dieser Prüfung.
const VR_BYTES = readFileSync(new URL("../../test/fixtures/vr-umsatz-ohne-kopfzeile.csv", import.meta.url));

describe("decodeBankFile", () => {
  it("Windows-1252 wird erkannt, Umlaute und € kommen unversehrt an", () => {
    const { text, encoding } = decodeBankFile(VR_BYTES);
    expect(encoding).toBe("windows-1252");
    expect(text).toContain("Augenärzte");
    expect(text).toContain("Schließgesellschaft");
    expect(text).toContain("€");
    // Kein einziges Ersetzungszeichen: Genau daran erkennt man die kaputte
    // UTF-8-Annahme — 73 von 391 Zeilen trugen sie zuvor.
    expect(text).not.toContain("�");
  });

  it("feste UTF-8-Annahme wäre falsch — die Datei ist kein gültiges UTF-8", () => {
    expect(() => new TextDecoder("utf-8", { fatal: true }).decode(VR_BYTES)).toThrow();
    expect(Buffer.from(VR_BYTES).toString("utf-8")).toContain("�");
  });

  it("UTF-8 mit BOM, UTF-16LE und UTF-16BE über die BOM", () => {
    const text = "Buchungstag;Betrag;Verwendungszweck\r\n02.01.2026;245,50;Hausgeld WE 01 März\r\n";
    const utf8Bom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(text, "utf-8")]);
    expect(decodeBankFile(utf8Bom)).toEqual({ text, encoding: "utf-8-bom" });

    const le = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, "utf16le")]);
    expect(decodeBankFile(le)).toEqual({ text, encoding: "utf-16le" });

    const beBody = Buffer.from(text, "utf16le");
    beBody.swap16();
    expect(decodeBankFile(Buffer.concat([Buffer.from([0xfe, 0xff]), beBody]))).toEqual({
      text,
      encoding: "utf-16be",
    });
  });

  it("reines UTF-8 bleibt UTF-8", () => {
    const { encoding, text } = decodeBankFile(Buffer.from("Buchungstag;Betrag\r\n02.01.2026;1,00\r\n", "utf-8"));
    expect(encoding).toBe("utf-8");
    expect(text).toContain("Buchungstag");
  });
});

describe("Datei ohne Kopfzeile", () => {
  const { text } = decodeBankFile(VR_BYTES);
  const parsed = parseCsv(text);

  it("erkennt, dass keine Kopfzeile da ist — und verliert keine Zeile", () => {
    expect(parsed.hasHeader).toBe(false);
    expect(parsed.delimiter).toBe(";");
    expect(parsed.skippedBefore).toBe(0);
    // 391 Zeilen in der Datei, 391 Datensätze. Die erste Buchung des Jahres
    // ging zuvor still als vermeintliche Kopfzeile verloren (390 statt 391).
    expect(parsed.rows).toHaveLength(391);
    expect(parsed.rows[0][1]).toBe("01.01.2023");
    expect(parsed.header).toHaveLength(9);
    expect(parsed.header[0]).toBe("Spalte 1");
  });

  it("ordnet die Spalten über den Inhalt zu", () => {
    expect(detectMapping(parsed)).toEqual({ date: 1, amount: 2, purpose: 6, counterparty: 5 });
  });

  it("alle 391 Zeilen werden zu Buchungen", () => {
    const mapping = detectMapping(parsed);
    expect(mappingComplete(mapping)).toBe(true);
    const buchungen = mapRows(parsed.rows, mapping as never, "acc1");
    expect(buchungen).toHaveLength(391);
    expect(buchungen.some((b) => b.counterparty === "Augenärzte Dr. Wagner MVZ")).toBe(true);
    expect(buchungen.some((b) => b.reference.includes("€"))).toBe(true);
    expect(buchungen.every((b) => !b.reference.includes("�"))).toBe(true);
    expect(buchungen.some((b) => b.kind === "EINNAHME")).toBe(true);
    expect(buchungen.some((b) => b.kind === "AUSGABE")).toBe(true);
    // Tausenderpunkt (…;+7.945,36;…) muss als Euro ankommen, nicht als Cent.
    expect(buchungen.some((b) => b.amountCents > 100_000)).toBe(true);
  });

  it("Datumsspalte: die frühere der beiden ist der Buchungstag", () => {
    const m = guessMappingFromRows([
      ["ref1", "02.01.2023", "+10,00", "03.01.2023", "", "Meier", "Hausgeld Januar 2023 WE 01"],
      ["ref2", "05.01.2023", "-20,00", "06.01.2023", "", "Schulz", "Abschlag Strom Februar 2023"],
      ["ref3", "09.01.2023", "+30,00", "09.01.2023", "", "Kunze", "Hausgeld Januar 2023 WE 02"],
    ]);
    expect(m.date).toBe(1); // nicht 3 (Valuta)
  });
});

describe("Kopfzeile steht nicht in Zeile 1", () => {
  // Sparkassen-Internetbanking stellt Titel- und Zeitraumzeilen voran.
  const MIT_TITEL = [
    "Umsatzanzeige;;",
    "Zeitraum: 01.01.2026 - 31.01.2026;Konto: DE11500105170000000001;",
    "Buchungstag;Verwendungszweck;Betrag",
    "02.01.2026;Hausgeld WE 01 Januar;245,50",
    "05.01.2026;Stadtwerke Abschlag;-89,00",
  ].join("\r\n");

  it("findet die Kopfzeile und überspringt den Vorspann", () => {
    const parsed = parseCsv(MIT_TITEL);
    expect(parsed.hasHeader).toBe(true);
    expect(parsed.skippedBefore).toBe(2);
    expect(parsed.delimiter).toBe(";"); // nicht "," — die Titelzeile kippt nichts
    expect(parsed.rows).toHaveLength(2);
    expect(detectMapping(parsed)).toEqual({ date: 0, purpose: 1, amount: 2 });
  });

  it("die ersten Rohzeilen bleiben für die Anzeige erhalten", () => {
    expect(parseCsv(MIT_TITEL).rawLines[0]).toBe("Umsatzanzeige;;");
  });
});

describe("getrennte Soll-/Haben-Spalten", () => {
  const SOLL_HABEN = [
    "Buchungstag;Verwendungszweck;Soll;Haben",
    "02.01.2026;Hausgeld WE 01;;245,50",
    "05.01.2026;Stadtwerke Abschlag;89,00;",
  ].join("\n");

  it("führt Soll und Haben zu einem vorzeichenbehafteten Betrag zusammen", () => {
    const parsed = parseCsv(SOLL_HABEN);
    const m = detectMapping(parsed);
    expect(m).toEqual({ date: 0, purpose: 1, debit: 2, credit: 3 });
    expect(mappingComplete(m)).toBe(true);
    const buchungen = mapRows(parsed.rows, m as never, "acc1");
    expect(buchungen).toHaveLength(2);
    expect(buchungen[0].kind).toBe("EINNAHME");
    expect(buchungen[0].amountCents).toBe(24550);
    expect(buchungen[1].kind).toBe("AUSGABE");
    expect(buchungen[1].amountCents).toBe(8900);
  });
});

describe("Synonyme und Umlaut-Schreibweisen", () => {
  it("erkennt Umsatz in EUR, Wertstellung, Zahlungsempfänger", () => {
    const m = guessMapping(["Wertstellung", "Vorgang/Verwendungszweck", "Umsatz in EUR", "Zahlungsempfänger"]);
    expect(m).toEqual({ date: 0, purpose: 1, amount: 2, counterparty: 3 });
  });

  it("Umlaut und ae-Schreibweise treffen dasselbe Muster", () => {
    expect(guessMapping(["Buchungstag", "Begünstigter", "Betrag"]).counterparty).toBe(1);
    expect(guessMapping(["Buchungstag", "Beguenstigter", "Betrag"]).counterparty).toBe(1);
  });

  it("Betrag in EUR und Wert als Betragsspalte", () => {
    expect(guessMapping(["Datum", "Betrag in EUR", "Verwendungszweck"]).amount).toBe(1);
    expect(guessMapping(["Datum", "Wert", "Verwendungszweck"]).amount).toBe(1);
  });

  it("Auftraggeber/Empfänger als Zahlungspartner", () => {
    expect(guessMapping(["Buchungstag", "Auftraggeber/Empfänger", "Betrag"]).counterparty).toBe(1);
  });
});

describe("Trennzeichen und Dezimaltrenner", () => {
  it("Komma-Dezimaltrenner bei Semikolon-Feldtrenner", () => {
    const parsed = parseCsv("Buchungstag;Betrag;Verwendungszweck\n02.01.2026;1.234,56;Test\n");
    expect(parsed.delimiter).toBe(";");
    const buchungen = mapRows(parsed.rows, detectMapping(parsed) as never, "acc1");
    expect(buchungen[0].amountCents).toBe(123456);
  });

  it("Tabulator-getrennt", () => {
    const parsed = parseCsv("Buchungstag\tBetrag\tVerwendungszweck\n02.01.2026\t-12,00\tTest\n");
    expect(parsed.delimiter).toBe("\t");
    expect(parsed.rows[0]).toEqual(["02.01.2026", "-12,00", "Test"]);
  });

  it("Unicode-Minus, führendes Plus und Tausenderpunkt", () => {
    expect(parseSignedEuroToCents("−1.234,56")).toBe(-123456);
    expect(parseSignedEuroToCents("+8880,46")).toBe(888046);
    expect(parseSignedEuroToCents("-583,10")).toBe(-58310);
    expect(parseSignedEuroToCents("1.234,56 €")).toBe(123456);
  });
});

// ── Kopfzeilen weiterer Banken ───────────────────────────────────────────────
//
// Drei Fehler, die dieser Durchgang zutage gefördert hat und die diese Prüfung
// festhält: „Vorgang" ist bei comdirect die Umsatzart und nicht der Zweck,
// „Auftraggeberkonto" ist das eigene Konto und nicht die Gegenseite, und ING
// nennt den Buchungstag schlicht „Buchung".
describe("weitere Bank-Kopfzeilen", () => {
  it("ING: Buchung schlaegt Valuta", () => {
    const m = guessMapping([
      "Buchung", "Valuta", "Auftraggeber/Empfänger", "Buchungstext",
      "Verwendungszweck", "Saldo", "Währung", "Betrag", "Währung",
    ]);
    expect(m).toEqual({ date: 0, purpose: 4, counterparty: 2, amount: 7 });
  });

  it("comdirect: der Zweck steht in Buchungstext, nicht in Vorgang", () => {
    const m = guessMapping(["Buchungstag", "Wertstellung (Valuta)", "Vorgang", "Buchungstext", "Umsatz in EUR"]);
    expect(m.date).toBe(0);
    expect(m.purpose).toBe(3);
    expect(m.amount).toBe(4);
  });

  it("Commerzbank: Auftraggeberkonto ist kein Zahlungspartner", () => {
    const m = guessMapping([
      "Buchungstag", "Wertstellung", "Umsatzart", "Buchungstext", "Betrag",
      "Währung", "Auftraggeberkonto", "IBAN Auftraggeberkonto",
    ]);
    expect(m.counterparty).toBeUndefined();
    expect(m.purpose).toBe(3);
  });

  it("DKB und Postbank", () => {
    const dkb = guessMapping([
      "Buchungsdatum", "Wertstellung", "Status", "Zahlungspflichtige*r",
      "Zahlungsempfänger*in", "Verwendungszweck", "Umsatztyp", "IBAN", "Betrag (€)",
    ]);
    expect(dkb.date).toBe(0);
    expect(dkb.purpose).toBe(5);
    expect(dkb.amount).toBe(8);

    const postbank = guessMapping([
      "Buchungstag", "Wertstellung", "Umsatzart", "Begünstigter / Auftraggeber",
      "Verwendungszweck", "IBAN", "BIC", "Betrag", "Soll", "Haben", "Währung",
    ]);
    expect(postbank).toEqual({ date: 0, purpose: 4, counterparty: 3, amount: 7 });
  });

  it("englische Kopfzeilen (N26) fallen auf die Inhaltserkennung zurück", () => {
    const csv = [
      "Booking Date,Value Date,Partner Name,Partner Iban,Type,Payment Reference,Amount (EUR)",
      "02.01.2026,02.01.2026,Erika Mustermann,DE02120300000000202051,Credit,Hausgeld WE 01 Januar 2026,245.50",
      "05.01.2026,05.01.2026,Stadtwerke Nord,DE44100110012345678901,Debit,Abschlag Allgemeinstrom Januar,-89.00",
      "09.01.2026,09.01.2026,Versicherung AG,DE87200500001234567890,Debit,Jahresbeitrag Police 4711 Gebaeude,-1234.56",
    ].join("\n");
    const parsed = parseCsv(csv);
    const m = detectMapping(parsed);
    expect(mappingComplete(m)).toBe(true);
    const buchungen = mapRows(parsed.rows, m as never, "acc1");
    expect(buchungen).toHaveLength(3);
    expect(buchungen[2].amountCents).toBe(123456);
  });
});

describe("Dezimaltrenner", () => {
  it("das letzte Trennzeichen entscheidet — deutsch wie englisch", () => {
    expect(parseSignedEuroToCents("1.234,56")).toBe(123456);
    expect(parseSignedEuroToCents("1,234.56")).toBe(123456); // englischer Export
    expect(parseSignedEuroToCents("1.234.567,89")).toBe(123456789);
    expect(parseSignedEuroToCents("1,234,567.89")).toBe(123456789);
    expect(parseSignedEuroToCents("-1.234,56")).toBe(-123456);
    expect(parseSignedEuroToCents("245,50")).toBe(24550);
    expect(parseSignedEuroToCents("245.50")).toBe(24550);
  });
});

// ── Zwei Partnerspalten (DKB u. a.) ──────────────────────────────────────────
//
// Bei einer Gutschrift steht die Gegenseite in „Zahlungspflichtige*r", bei
// einer Belastung in „Zahlungsempfänger*in" — in der jeweils anderen Spalte
// steht das eigene Konto. Eine feste Spalte zu nehmen hieße, bei der Hälfte
// der Zeilen den eigenen Namen als Zahlungspartner zu buchen.
describe("richtungsabhängiger Zahlungspartner", () => {
  const DKB = [
    "Buchungsdatum;Wertstellung;Status;Zahlungspflichtige*r;Zahlungsempfänger*in;Verwendungszweck;Umsatztyp;IBAN;Betrag (€)",
    "02.01.2026;02.01.2026;Gebucht;Mustermann, Erika;WEG Musterstr. 12;Hausgeld WE 01 Januar;Eingang;DE02120300000000202051;245,50",
    "08.01.2026;08.01.2026;Gebucht;WEG Musterstr. 12;Gebäudeversicherung AG;Jahresbeitrag Police 4711;Ausgang;DE87200500001234567890;-1.234,56",
  ].join("\n");

  it("erkennt das Paar statt einer festen Spalte", () => {
    const m = guessMapping(parseCsv(DKB).header);
    expect(m.counterpartyIn).toBe(3); // Zahlungspflichtige*r
    expect(m.counterpartyOut).toBe(4); // Zahlungsempfänger*in
    expect(m.counterparty).toBeUndefined();
  });

  it("nimmt je Zeile die Spalte, die zur Richtung passt", () => {
    const parsed = parseCsv(DKB);
    const m = detectMapping(parsed);
    expect(mappingComplete(m)).toBe(true);
    const buchungen = mapRows(parsed.rows, m as never, "acc1");
    expect(buchungen[0].kind).toBe("EINNAHME");
    expect(buchungen[0].counterparty).toBe("Mustermann, Erika"); // der Zahler
    expect(buchungen[1].kind).toBe("AUSGABE");
    expect(buchungen[1].counterparty).toBe("Gebäudeversicherung AG"); // der Empfänger
  });

  it("ist die passende Spalte leer, wird die andere genommen", () => {
    const mapping = { date: 0, amount: 1, purpose: 2, counterpartyIn: 3, counterpartyOut: 4 };
    const [ein] = mapRows([["02.01.2026", "10,00", "Test", "", "Notfallname"]], mapping, "acc1");
    expect(ein.counterparty).toBe("Notfallname");
  });

  it("eine gemeinsame Spalte bleibt eine gemeinsame", () => {
    // Sparkasse und Postbank führen beide Rollen in **einer** Spalte — dort
    // darf die Paar-Erkennung nicht zuschlagen.
    const sparkasse = guessMapping(["Buchungstag", "Verwendungszweck", "Beguenstigter/Zahlungspflichtiger", "Betrag"]);
    expect(sparkasse.counterparty).toBe(2);
    expect(sparkasse.counterpartyIn).toBeUndefined();

    const postbank = guessMapping(["Buchungstag", "Begünstigter / Auftraggeber", "Verwendungszweck", "Betrag"]);
    expect(postbank.counterparty).toBe(1);
    expect(postbank.counterpartyIn).toBeUndefined();

    const ing = guessMapping(["Buchung", "Auftraggeber/Empfänger", "Verwendungszweck", "Betrag"]);
    expect(ing.counterparty).toBe(1);
    expect(ing.counterpartyIn).toBeUndefined();
  });

  it("gendergerechte Schreibweisen treffen dieselben Muster", () => {
    // „Zahlungspflichtige*r" traf /zahlungspflichtiger/ vorher nicht — der
    // Stern stand im Weg.
    expect(normHeader("Zahlungspflichtige*r")).toBe("zahlungspflichtige r");
    const m = guessMapping(["Datum", "Zahlungspflichtige:r", "Zahlungsempfänger:in", "Betrag", "Verwendungszweck"]);
    expect(m.counterpartyIn).toBe(1);
    expect(m.counterpartyOut).toBe(2);
  });
});
