import { beforeEach, describe, expect, it } from "vitest";
import { _drosselZuruecksetzen, sollMelden } from "./fehler-alarm";

// Die Drossel ist der Kern der Fehler-Alarmierung: Ohne sie macht ein einziger
// Dauerfehler (z. B. Datenbank weg → jeder Request wirft) aus dem Alarmweg
// einen Mail-Sturm, und der Betreiber schaltet die Alarme ab — dann ist die
// Beobachtbarkeit wieder auf dem Stand vor B-4.

const STUNDE = 60 * 60 * 1000;

describe("sollMelden", () => {
  beforeEach(() => _drosselZuruecksetzen());

  it("meldet einen neuen Fehler sofort", () => {
    expect(sollMelden("route|kaputt", 1_000)).toBe(true);
  });

  it("meldet denselben Fehler innerhalb einer Stunde nicht erneut", () => {
    expect(sollMelden("route|kaputt", 1_000)).toBe(true);
    expect(sollMelden("route|kaputt", 1_000 + STUNDE / 2)).toBe(false);
  });

  it("meldet denselben Fehler nach Ablauf der Stunde wieder", () => {
    expect(sollMelden("route|kaputt", 1_000)).toBe(true);
    expect(sollMelden("route|kaputt", 2_000 + STUNDE)).toBe(true);
  });

  it("unterscheidet verschiedene Fehler", () => {
    expect(sollMelden("route-a|kaputt", 1_000)).toBe(true);
    expect(sollMelden("route-b|anders", 1_000)).toBe(true);
  });

  it("deckelt die Gesamtzahl je Stunde — auch für lauter verschiedene Fehler", () => {
    // Ein kaputtes Deployment wirft auf JEDER Route anders; fünf Mails sagen
    // dasselbe wie fünfzig.
    for (let i = 0; i < 5; i++) {
      expect(sollMelden(`route-${i}|kaputt`, 1_000)).toBe(true);
    }
    expect(sollMelden("route-6|kaputt", 1_000)).toBe(false);
    // Nächstes Stundenfenster: wieder offen.
    expect(sollMelden("route-6|kaputt", 2_000 + STUNDE)).toBe(true);
  });
});
