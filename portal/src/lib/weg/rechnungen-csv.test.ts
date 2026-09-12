import { describe, expect, it } from "vitest";
import { erkenneSpalten, isoTagAus, parseRechnungenCsv, pruefeRechnungenCsv } from "./rechnungen-csv";

const bytes = (s: string) => new TextEncoder().encode(s);

describe("erkenneSpalten", () => {
  it("findet die Spalten an ihren Namen, in beliebiger Reihenfolge", () => {
    const z = erkenneSpalten(["Rechnungsnr.", "Lieferant", "Bruttobetrag", "Rechnungsdatum", "Fälligkeitsdatum", "Leistung", "Bemerkung"]);
    expect(z).toEqual({ nummer: 0, glaeubiger: 1, betrag: 2, datum: 3, faellig: 4, bezeichnung: 5, notiz: 6 });
  });

  it("verwechselt das Fälligkeitsdatum nicht mit dem Rechnungsdatum", () => {
    const z = erkenneSpalten(["Fällig am", "Datum", "Betrag"]);
    expect(z.faellig).toBe(0);
    expect(z.datum).toBe(1);
  });
});

describe("isoTagAus", () => {
  it("liest deutsche und ISO-Daten und lehnt Unmögliches ab", () => {
    expect(isoTagAus("3.11.2026")).toBe("2026-11-03");
    expect(isoTagAus("03.11.26")).toBe("2026-11-03");
    expect(isoTagAus("2026-11-03")).toBe("2026-11-03");
    expect(isoTagAus("31.11.2026")).toBeNull();
    expect(isoTagAus("November")).toBeNull();
  });
});

describe("parseRechnungenCsv", () => {
  it("liest eine übliche Rechnungsliste", () => {
    const csv =
      "Bezeichnung;Gläubiger;Betrag;Rechnungsdatum;Fällig am;Notiz\r\n" +
      "Dachreparatur;Dachdeckerei Müller GmbH;1.250,00;14.03.2026;28.03.2026;Sturmschaden\r\n" +
      "Wartung Aufzug;Schindler;480,00 €;2026-04-01;;\r\n" +
      ";;;;;\r\n";
    const res = parseRechnungenCsv(bytes(csv));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.zeilen).toEqual([
      {
        zeile: 2,
        title: "Dachreparatur",
        creditor: "Dachdeckerei Müller GmbH",
        amountCents: 125000,
        incurredOn: "2026-03-14",
        dueDate: "2026-03-28",
        note: "Sturmschaden",
      },
      {
        zeile: 3,
        title: "Wartung Aufzug",
        creditor: "Schindler",
        amountCents: 48000,
        incurredOn: "2026-04-01",
        dueDate: null,
        note: null,
      },
    ]);
  });

  it("baut die Bezeichnung aus der Rechnungsnummer, wenn keine Bezeichnung da ist", () => {
    const csv = "Rechnungsnummer,Firma,Brutto,Datum\n2026-114,Müller GmbH,\"1,250.00\",14.03.2026\n";
    const res = parseRechnungenCsv(bytes(csv));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.zeilen[0].title).toBe("Rechnung 2026-114");
    expect(res.zeilen[0].amountCents).toBe(125000);
    // Die Nummer steht schon im Titel — keine doppelte Notiz.
    expect(res.zeilen[0].note).toBeNull();
  });

  it("hebt die Rechnungsnummer in die Notiz, wenn der Titel sie nicht trägt", () => {
    const csv = "Bezeichnung;Rechnungsnr;Betrag;Datum\nDachreparatur;R-77;100;01.02.2026\n";
    const res = parseRechnungenCsv(bytes(csv));
    expect(res.ok && res.zeilen[0].note).toBe("Rechnungsnr. R-77");
  });

  it("nennt fehlende Pflichtspalten", () => {
    const res = parseRechnungenCsv(bytes("Bezeichnung;Datum\nDach;01.02.2026\n"));
    expect(res).toEqual({ ok: false, fehler: { art: "kopfzeile", fehlt: ["betrag"] } });
  });

  it("bricht bei einer unlesbaren Zeile mit Zeilennummer ab — alles oder nichts", () => {
    const csv = "Bezeichnung;Betrag;Datum\nDach;1.250,00;14.03.2026\nAufzug;abc;01.04.2026\n";
    const res = parseRechnungenCsv(bytes(csv));
    expect(res).toEqual({ ok: false, fehler: { art: "betrag", zeile: 3 } });

    const csv2 = "Bezeichnung;Betrag;Datum;Fällig\nDach;10;14.03.2026;bald\n";
    expect(parseRechnungenCsv(bytes(csv2))).toEqual({ ok: false, fehler: { art: "datum", zeile: 2 } });
  });

  it("liefert in der Prüfung jede Zeile mit Ergebnis — gute Zeilen bleiben trotz einer schlechten", () => {
    const csv = "Bezeichnung;Betrag;Datum\nDach;1.250,00;14.03.2026\nAufzug;abc;01.04.2026\nTor;50;02.04.2026\n";
    const res = pruefeRechnungenCsv(bytes(csv));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.zeilen.map((z) => [z.zeile, z.ok, z.ok ? z.daten.title : z.grund])).toEqual([
      [2, true, "Dach"],
      [3, false, "betrag"],
      [4, true, "Tor"],
    ]);
  });

  it("meldet eine leere Datei", () => {
    expect(parseRechnungenCsv(bytes(""))).toEqual({ ok: false, fehler: { art: "leer" } });
    expect(parseRechnungenCsv(bytes("Bezeichnung;Betrag;Datum\n"))).toEqual({
      ok: false,
      fehler: { art: "leer" },
    });
  });

  it("kommt mit Windows-1252 (Excel-Export) zurecht", () => {
    const latin = Buffer.from("Bezeichnung;Betrag;Datum\nGl\xe4serreinigung;50;01.02.2026\n", "latin1");
    const res = parseRechnungenCsv(new Uint8Array(latin));
    expect(res.ok && res.zeilen[0].title).toBe("Gläserreinigung");
  });
});
