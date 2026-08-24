import { describe, expect, it } from "vitest";
import {
  istLaufenderTag,
  parseZeitraum,
  toIsoTag,
  utcTag,
  vorperiodeLabel,
  zeitraumLabel,
  zeitraumQuery,
  zeitraumSpanne,
} from "./zeitraum";

// Fester „heute"-Anker für alle Fälle: Montag, 10.08.2026, mittags UTC —
// die Uhrzeit muss herausfallen, sonst wäre der Test von der Tageszeit abhängig.
const HEUTE = new Date("2026-08-10T12:34:56Z");

describe("parseZeitraum", () => {
  it("Standard ohne Parameter: 7 Tage, endet gestern", () => {
    const z = parseZeitraum({}, HEUTE);
    expect(z.preset).toBe("7");
    expect(z.tage).toBe(7);
    expect(toIsoTag(z.bis)).toBe("2026-08-09");
    expect(toIsoTag(z.von)).toBe("2026-08-03");
  });

  it("Presets 28 und 90 liefern die verlangte Länge", () => {
    expect(parseZeitraum({ zeitraum: "28" }, HEUTE).tage).toBe(28);
    expect(parseZeitraum({ zeitraum: "90" }, HEUTE).tage).toBe(90);
  });

  // „heute" ist die einzige Auswahl, die den laufenden Tag einschließt — alles
  // andere endet gestern, damit der Vergleich nicht an einem halben Tag hängt.
  it("heute: genau der laufende Tag, Vorperiode ist gestern", () => {
    const z = parseZeitraum({ zeitraum: "heute" }, HEUTE);
    expect(z.preset).toBe("heute");
    expect(z.tage).toBe(1);
    expect(toIsoTag(z.von)).toBe("2026-08-10");
    expect(toIsoTag(z.bis)).toBe("2026-08-10");
    expect(toIsoTag(z.vorVon)).toBe("2026-08-09");
    expect(toIsoTag(z.vorBis)).toBe("2026-08-09");
    expect(istLaufenderTag(z)).toBe(true);
  });

  it("kein anderes Preset schließt den laufenden Tag ein", () => {
    for (const p of ["7", "28", "90", "monat"]) {
      const z = parseZeitraum({ zeitraum: p }, HEUTE);
      expect(toIsoTag(z.bis)).toBe("2026-08-09");
      expect(istLaufenderTag(z)).toBe(false);
    }
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
      expect(z.preset).toBe("7");
      expect(z.tage).toBe(7);
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
  it("nennen die Auswahl", () => {
    expect(zeitraumLabel(parseZeitraum({ zeitraum: "heute" }, HEUTE))).toBe("Heute");
    expect(zeitraumLabel(parseZeitraum({ zeitraum: "7" }, HEUTE))).toBe("Letzte 7 Tage");
    expect(zeitraumLabel(parseZeitraum({ zeitraum: "monat" }, HEUTE))).toBe("Laufender Monat");
    expect(zeitraumLabel(parseZeitraum({ von: "2026-06-01", bis: "2026-06-14" }, HEUTE))).toBe(
      "Freier Zeitraum",
    );
  });

  // Der wichtigste Fall dieser Datei: Bei einem Preset stand früher NUR die
  // Vorperiode als Datum da, und die wurde als der eigene Zeitraum gelesen.
  it("schreiben die eigene Spanne aus — auch bei einem Preset", () => {
    expect(zeitraumSpanne(parseZeitraum({ zeitraum: "7" }, HEUTE))).toBe(
      "03.08.2026 – 09.08.2026",
    );
    expect(zeitraumSpanne(parseZeitraum({ von: "2026-06-01", bis: "2026-06-14" }, HEUTE))).toBe(
      "01.06.2026 – 14.06.2026",
    );
  });

  it("ein einzelner Tag steht nicht doppelt da", () => {
    const z = parseZeitraum({ zeitraum: "heute" }, HEUTE);
    expect(zeitraumSpanne(z)).toBe("10.08.2026");
    expect(vorperiodeLabel(z)).toBe("vs. 09.08.2026");
  });

  it("Vorperiode wird als Spanne genannt", () => {
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
