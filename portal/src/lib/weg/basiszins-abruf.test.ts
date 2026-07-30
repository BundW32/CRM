import { describe, expect, it } from "vitest";
import {
  MAX_PROZENT,
  MIN_PROZENT,
  holeZinssaetze,
  istGeltungsbeginn,
  parseBundesbankCsv,
} from "./basiszins-abruf";

const iso = (d: Date) => d.toISOString().slice(0, 10);

describe("Geltungsbeginn (§ 247 Abs. 2 BGB)", () => {
  it("erkennt nur den 1. Januar und den 1. Juli", () => {
    expect(istGeltungsbeginn(new Date(Date.UTC(2026, 0, 1)))).toBe(true);
    expect(istGeltungsbeginn(new Date(Date.UTC(2026, 6, 1)))).toBe(true);
    expect(istGeltungsbeginn(new Date(Date.UTC(2026, 0, 2)))).toBe(false);
    expect(istGeltungsbeginn(new Date(Date.UTC(2026, 3, 1)))).toBe(false);
  });
});

describe("CSV der Bundesbank lesen", () => {
  // Aufbau nach dem üblichen Muster der BBSIS-Zeitreihen: einige Kopf- und
  // Metazeilen, danach Datum;Wert. Das genaue Format war beim Bau nicht
  // überprüfbar (die Adresse war aus der Entwicklungsumgebung gesperrt) —
  // deshalb liest der Parser tolerant und prüft danach streng.
  const echtnah = `"BBSIS.D.I.ZST.ZI.EUR.S1311.B.A604.R01XX.R.A.A._Z._Z.A";"Basiszinssatz gemäß § 247 BGB"
"Einheit";"%"
"Stand";"2026-07-01"
2015-01-01;-0.83;
2016-07-01;-0.88;
2023-01-01;1.62;
2023-07-01;3.12;
2024-01-01;3.62;
`;

  it("liest die Reihe und rechnet in Basispunkte", () => {
    const saetze = parseBundesbankCsv(echtnah);
    expect(saetze.map((s) => [iso(s.validFrom), s.basisPoints])).toEqual([
      ["2015-01-01", -83],
      ["2016-07-01", -88],
      ["2023-01-01", 162],
      ["2023-07-01", 312],
      ["2024-01-01", 362],
    ]);
  });

  it("wirft die Kopf- und Metazeilen von selbst heraus", () => {
    // „Stand";"2026-07-01" enthält ein gültiges Datum, aber keinen Wert —
    // solche Zeilen dürfen nicht als Satz durchgehen.
    const saetze = parseBundesbankCsv(echtnah);
    expect(saetze.some((s) => iso(s.validFrom) === "2026-07-01")).toBe(false);
  });

  it("versteht Dezimalkomma und Semikolon wie Komma als Trenner", () => {
    expect(parseBundesbankCsv("2024-01-01;3,62")[0]?.basisPoints).toBe(362);
    expect(parseBundesbankCsv("2024-01-01,3.62")[0]?.basisPoints).toBe(362);
  });

  it("überspringt Daten, die kein Geltungsbeginn sind", () => {
    // Ein Wert zum 15. März ist kein Basiszinssatz — daran erkennt der Parser,
    // dass er die falsche Spalte erwischt hat.
    expect(parseBundesbankCsv("2024-03-15;3.62")).toEqual([]);
  });

  it("überspringt unplausible Werte", () => {
    // Der klassische Fehler: der Faktor 100 verrutscht.
    expect(parseBundesbankCsv(`2024-01-01;${MAX_PROZENT + 1}`)).toEqual([]);
    expect(parseBundesbankCsv(`2024-01-01;${MIN_PROZENT - 1}`)).toEqual([]);
    // Die Grenzen selbst gelten noch.
    expect(parseBundesbankCsv(`2024-01-01;${MAX_PROZENT}`)).toHaveLength(1);
  });

  it("liefert bei völlig fremdem Inhalt gar nichts", () => {
    // Der wichtigste Fall: Ändert die Bundesbank ihr Format, kommt hier eine
    // leere Liste heraus — und der Aufrufer schreibt dann nichts. Ein Parser,
    // der in diesem Fall irgendetwas zurückgäbe, wäre gefährlich.
    expect(parseBundesbankCsv("<html><body>Wartungsarbeiten</body></html>")).toEqual([]);
    expect(parseBundesbankCsv("")).toEqual([]);
    expect(parseBundesbankCsv("Fehler 500")).toEqual([]);
  });

  it("nimmt bei doppeltem Datum den letzten Eintrag", () => {
    // Zeitreihen werden fortgeschrieben; spätere Zeilen sind die korrigierten.
    const saetze = parseBundesbankCsv("2024-01-01;3.00\n2024-01-01;3.62");
    expect(saetze).toHaveLength(1);
    expect(saetze[0].basisPoints).toBe(362);
  });

  it("sortiert aufsteigend nach Geltungsbeginn", () => {
    const saetze = parseBundesbankCsv("2024-01-01;3.62\n2023-01-01;1.62");
    expect(saetze.map((s) => iso(s.validFrom))).toEqual(["2023-01-01", "2024-01-01"]);
  });
});

describe("Abruf: jeder Fehler endet in „nichts übernommen“", () => {
  const antwort = (body: string, status = 200): typeof fetch =>
    (async () =>
      ({ ok: status >= 200 && status < 300, status, text: async () => body }) as Response) as typeof fetch;

  it("liefert die Sätze bei einer guten Antwort", async () => {
    const r = await holeZinssaetze(antwort("2024-01-01;3.62"));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.saetze).toHaveLength(1);
  });

  it("meldet einen Fehlerstatus mit Zahl", async () => {
    const r = await holeZinssaetze(antwort("", 503));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.grund).toContain("503");
  });

  it("meldet eine unlesbare Antwort als Formatänderung", async () => {
    const r = await holeZinssaetze(antwort("<html>Wartung</html>"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.grund).toContain("Format");
  });

  it("wirft bei einem Netzfehler keine Ausnahme", async () => {
    // Der Abruf ist ein Komfortmerkmal und darf nie etwas blockieren.
    const kaputt = (async () => {
      throw new Error("ENOTFOUND");
    }) as unknown as typeof fetch;
    const r = await holeZinssaetze(kaputt);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.grund).toContain("nicht erreichbar");
  });
});
