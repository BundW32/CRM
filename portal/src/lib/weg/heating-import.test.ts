import { describe, expect, it } from "vitest";
import {
  guessHeatingColumns,
  leadingNumber,
  matchHeatingRows,
  normalizeLabel,
  parseHeatingCsv,
} from "./heating-import";

describe("normalizeLabel / leadingNumber", () => {
  it("normalisiert Bezeichnungen", () => {
    expect(normalizeLabel("  WE 01,  EG links ")).toBe("we 01, eg links");
  });
  it("extrahiert die führende Zahl", () => {
    expect(leadingNumber("WE 01, EG links")).toBe(1);
    expect(leadingNumber("Wohnung 12")).toBe(12);
    expect(leadingNumber("Stellplatz")).toBeNull();
  });
});

describe("guessHeatingColumns", () => {
  it("erkennt Einheit- und Betragsspalte", () => {
    expect(guessHeatingColumns(["Einheit", "Betrag (EUR)"])).toEqual({ unitCol: 0, amountCol: 1 });
    expect(guessHeatingColumns(["Nutzer", "Fläche", "Gesamtkosten"])).toEqual({ unitCol: 0, amountCol: 2 });
  });
  it("liefert null, wenn Spalten fehlen", () => {
    expect(guessHeatingColumns(["Foo", "Bar"])).toBeNull();
  });
});

describe("parseHeatingCsv", () => {
  it("liest Einheiten und Beträge (deutsche Zahlen, € und Tausenderpunkt)", () => {
    const csv = "Einheit;Betrag\nWE 01;1.234,56 €\nWE 02;987,00\n";
    const res = parseHeatingCsv(csv);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.rows).toEqual([
        { unitLabel: "WE 01", amountCents: 123456 },
        { unitLabel: "WE 02", amountCents: 98700 },
      ]);
    }
  });
  it("meldet fehlende Spalten", () => {
    const res = parseHeatingCsv("Foo;Bar\n1;2\n");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("spalten");
  });
  it("meldet leere Daten", () => {
    const res = parseHeatingCsv("Einheit;Betrag\n;\n");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("leer");
  });
});

describe("matchHeatingRows", () => {
  const units = [
    { id: "u1", label: "WE 01, EG links" },
    { id: "u2", label: "WE 02, EG rechts" },
    { id: "u3", label: "WE 03, 1. OG" },
  ];

  it("matcht exakt (normalisiert)", () => {
    const m = matchHeatingRows(units, [{ unitLabel: "we 02, eg rechts", amountCents: 500 }]);
    expect(m.matched).toEqual([{ unitId: "u2", unitLabel: "WE 02, EG rechts", amountCents: 500 }]);
  });

  it("matcht über die eindeutige Nummer, wenn das Label abweicht", () => {
    const m = matchHeatingRows(units, [
      { unitLabel: "Wohnung 1", amountCents: 300 },
      { unitLabel: "3", amountCents: 700 },
    ]);
    expect(m.matched.map((x) => x.unitId).sort()).toEqual(["u1", "u3"]);
  });

  it("meldet nicht zuordenbare Zeilen und Einheiten ohne Zeile", () => {
    const m = matchHeatingRows(units, [
      { unitLabel: "WE 01, EG links", amountCents: 300 },
      { unitLabel: "Gewerbe X", amountCents: 999 },
    ]);
    expect(m.matched).toHaveLength(1);
    expect(m.unmatchedRows).toEqual([{ unitLabel: "Gewerbe X", amountCents: 999 }]);
    expect(m.unmatchedUnits.map((u) => u.id).sort()).toEqual(["u2", "u3"]);
  });

  it("verhindert doppelte Zuordnung derselben Einheit", () => {
    const m = matchHeatingRows(units, [
      { unitLabel: "WE 01", amountCents: 100 },
      { unitLabel: "1", amountCents: 200 },
    ]);
    expect(m.matched).toHaveLength(1);
    expect(m.unmatchedRows).toHaveLength(1);
  });

  it("Stellplätze ziehen keine Zeilen an und fehlen nicht als „ohne Zeile“", () => {
    const mitStellplatz = [
      ...units,
      { id: "st6", label: "TE 06, Stellplatz", unitType: "STELLPLATZ" },
    ];
    // Zeile „6" darf NICHT auf den Stellplatz matchen — ein Stellplatz wird
    // nicht beheizt; die Zeile bleibt als nicht zuordenbar gemeldet.
    const m = matchHeatingRows(mitStellplatz, [
      { unitLabel: "WE 01, EG links", amountCents: 300 },
      { unitLabel: "6", amountCents: 999 },
    ]);
    expect(m.matched.map((x) => x.unitId)).toEqual(["u1"]);
    expect(m.unmatchedRows).toEqual([{ unitLabel: "6", amountCents: 999 }]);
    // Und der Stellplatz erscheint nicht in der „Einheiten ohne Zeile"-Liste.
    expect(m.unmatchedUnits.map((u) => u.id).sort()).toEqual(["u2", "u3"]);
  });
});
