import { describe, expect, it } from "vitest";
import {
  parseZeitraum,
  toIsoTag,
  utcTag,
  vorperiodeLabel,
  zeitraumLabel,
  zeitraumQuery,
} from "./zeitraum";

// Fester „heute"-Anker für alle Fälle: Montag, 10.08.2026, mittags UTC —
// die Uhrzeit muss herausfallen, sonst wäre der Test von der Tageszeit abhängig.
const HEUTE = new Date("2026-08-10T12:34:56Z");

describe("parseZeitraum", () => {
  it("Standard ohne Parameter: 28 Tage, endet gestern", () => {
    const z = parseZeitraum({}, HEUTE);
    expect(z.preset).toBe("28");
    expect(z.tage).toBe(28);
    expect(toIsoTag(z.bis)).toBe("2026-08-09");
    expect(toIsoTag(z.von)).toBe("2026-07-13");
  });

  it("Presets 7 und 90 liefern die verlangte Länge", () => {
    expect(parseZeitraum({ zeitraum: "7" }, HEUTE).tage).toBe(7);
    expect(parseZeitraum({ zeitraum: "90" }, HEUTE).tage).toBe(90);
  });

  it("Vorperiode ist gleich lang und schließt lückenlos an", () => {
    const z = parseZeitraum({ zeitraum: "7" }, HEUTE);
    expect(toIsoTag(z.vorBis)).toBe("2026-08-02"); // Tag vor `von`
    expect(toIsoTag(z.vorVon)).toBe("2026-07-27");
    const vorTage = (z.vorBis.getTime() - z.vorVon.getTime()) / 86_400_000 + 1;
    expect(vorTage).toBe(z.tage);
  });

  it("monat: Monatserster bis gestern", () => {
    const z = parseZeitraum({ zeitraum: "monat" }, HEUTE);
    expect(z.preset).toBe("monat");
    expect(toIsoTag(z.von)).toBe("2026-08-01");
    expect(toIsoTag(z.bis)).toBe("2026-08-09");
    expect(z.tage).toBe(9);
  });

  it("monat am Monatsersten: Fenster ist nie leer", () => {
    const z = parseZeitraum({ zeitraum: "monat" }, new Date("2026-08-01T06:00:00Z"));
    expect(toIsoTag(z.von)).toBe("2026-08-01");
    expect(toIsoTag(z.bis)).toBe("2026-08-01");
    expect(z.tage).toBe(1);
  });

  it("freies Von/Bis gewinnt gegen ein gleichzeitig gesetztes Preset", () => {
    const z = parseZeitraum({ zeitraum: "7", von: "2026-06-01", bis: "2026-06-14" }, HEUTE);
    expect(z.preset).toBeNull();
    expect(z.tage).toBe(14);
    expect(toIsoTag(z.von)).toBe("2026-06-01");
  });

  it("verdrehte Grenzen werden gerichtet statt verworfen", () => {
    const z = parseZeitraum({ von: "2026-06-14", bis: "2026-06-01" }, HEUTE);
    expect(toIsoTag(z.von)).toBe("2026-06-01");
    expect(toIsoTag(z.bis)).toBe("2026-06-14");
  });

  it("ungültige Daten fallen auf den Standard zurück", () => {
    for (const kaputt of [{ von: "gestern", bis: "2026-06-01" }, { von: "2026-02-31", bis: "2026-03-01" }, { zeitraum: "999" }]) {
      const z = parseZeitraum(kaputt, HEUTE);
      expect(z.preset).toBe("28");
      expect(z.tage).toBe(28);
    }
  });

  it("Array-Parameter (doppelter Suchparam) nehmen den ersten Wert", () => {
    const z = parseZeitraum({ zeitraum: ["7", "90"] }, HEUTE);
    expect(z.tage).toBe(7);
  });
});

describe("zeitraumQuery", () => {
  it("Preset reist als zeitraum=, freie Wahl als von/bis", () => {
    expect(zeitraumQuery(parseZeitraum({ zeitraum: "7" }, HEUTE)).toString()).toBe("zeitraum=7");
    expect(
      zeitraumQuery(parseZeitraum({ von: "2026-06-01", bis: "2026-06-14" }, HEUTE)).toString(),
    ).toBe("von=2026-06-01&bis=2026-06-14");
  });
});

describe("Beschriftungen", () => {
  it("nennen Preset bzw. Datumsspanne", () => {
    expect(zeitraumLabel(parseZeitraum({ zeitraum: "7" }, HEUTE))).toBe("Letzte 7 Tage");
    expect(zeitraumLabel(parseZeitraum({ zeitraum: "monat" }, HEUTE))).toBe("Laufender Monat");
    expect(zeitraumLabel(parseZeitraum({ von: "2026-06-01", bis: "2026-06-14" }, HEUTE))).toBe(
      "01.06.2026 – 14.06.2026",
    );
    expect(vorperiodeLabel(parseZeitraum({ zeitraum: "7" }, HEUTE))).toBe(
      "vs. 27.07.2026 – 02.08.2026",
    );
  });
});

describe("utcTag", () => {
  it("schneidet auf UTC-Mitternacht", () => {
    expect(utcTag(new Date("2026-08-10T23:59:59Z")).toISOString()).toBe(
      "2026-08-10T00:00:00.000Z",
    );
  });
});
