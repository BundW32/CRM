import { describe, expect, it } from "vitest";
import { satzAm, verzugszinsen, zinssatzProzent, type Basiszinssatz } from "./verzug";

// Zwei erfundene Halbjahressätze — der Test prüft die Rechnung, nicht die
// Bundesbank. Echte Sätze werden gepflegt, nicht einprogrammiert (siehe
// `verzug.ts`), und ein Test, der sie fest verdrahtet, wäre ab dem nächsten
// Halbjahr eine Lüge.
const SAETZE: Basiszinssatz[] = [
  { gueltigAb: new Date(2026, 0, 1), basispunkte: 200 }, // 2,00 %
  { gueltigAb: new Date(2026, 6, 1), basispunkte: 100 }, // 1,00 %
];

describe("Verzugszinsen (§§ 286, 288 BGB)", () => {
  it("rechnet fünf Punkte über dem Basiszinssatz", () => {
    // § 288 Abs. 1 BGB. Die neun Punkte des Absatzes 2 gelten nicht, wenn ein
    // Verbraucher beteiligt ist — der Wohnungseigentümer ist regelmäßig einer.
    expect(zinssatzProzent(SAETZE[0])).toBe(7);
    expect(zinssatzProzent(SAETZE[1])).toBe(6);
  });

  it("beginnt am Tag NACH der Fälligkeit", () => {
    // § 187 Abs. 1 BGB: Der Ereignistag zählt nicht mit. Ein Tag zu viel wäre
    // eine überhöhte Forderung in einem Schreiben, das nach außen geht.
    const amFaelligkeitstag = verzugszinsen({
      hauptCents: 100_000,
      faellig: new Date(2026, 1, 1),
      bis: new Date(2026, 1, 1),
      saetze: SAETZE,
    });
    expect(amFaelligkeitstag).toEqual({ berechenbar: true, zinsenCents: 0, tage: 0 });

    const einTagSpaeter = verzugszinsen({
      hauptCents: 100_000,
      faellig: new Date(2026, 1, 1),
      bis: new Date(2026, 1, 2),
      saetze: SAETZE,
    });
    expect(einTagSpaeter.berechenbar && einTagSpaeter.tage).toBe(1);
  });

  it("rechnet taggenau", () => {
    // 1.000 € zu 7 % für 1 Tag in einem 365-Tage-Jahr: 100000 * 0,07 / 365
    const r = verzugszinsen({
      hauptCents: 100_000,
      faellig: new Date(2026, 1, 1),
      bis: new Date(2026, 1, 2),
      saetze: SAETZE,
    });
    expect(r.berechenbar && r.zinsenCents).toBe(Math.round((100_000 * 7) / 100 / 365));
  });

  it("wechselt den Satz mitten in der Laufzeit", () => {
    // Der Basiszinssatz ändert sich halbjährlich. Über den ganzen Zeitraum mit
    // einem Durchschnitt zu rechnen wäre einfacher und falsch.
    const r = verzugszinsen({
      hauptCents: 100_000,
      faellig: new Date(2026, 5, 29), // Verzug ab 30.06.
      bis: new Date(2026, 6, 1),
      saetze: SAETZE,
    });
    // 30.06. und 01.07. zu 7 %, 01.07. zu 6 % → getrennt gerechnet
    const erwartet = Math.round(
      (100_000 * 7) / 100 / 365 + (100_000 * 6) / 100 / 365,
    );
    expect(r.berechenbar && r.tage).toBe(2);
    expect(r.berechenbar && r.zinsenCents).toBe(erwartet);
  });

  it("rechnet Schaltjahre mit 366 Tagen", () => {
    const schalt: Basiszinssatz[] = [{ gueltigAb: new Date(2024, 0, 1), basispunkte: 200 }];
    const r = verzugszinsen({
      hauptCents: 100_000,
      faellig: new Date(2024, 1, 1),
      bis: new Date(2024, 1, 2),
      saetze: schalt,
    });
    expect(r.berechenbar && r.zinsenCents).toBe(Math.round((100_000 * 7) / 100 / 366));
  });

  it("verweigert die Rechnung, statt einen veralteten Satz fortzuschreiben", () => {
    // **Der wichtigste Test.** Ohne ihn schriebe das Programm den letzten
    // bekannten Satz stillschweigend fort — und der Fehler landete in einer
    // Mahnung, die nach außen geht. Lieber keine Zahl als eine falsche.
    const r = verzugszinsen({
      hauptCents: 100_000,
      faellig: new Date(2025, 10, 1),
      bis: new Date(2026, 1, 1),
      saetze: SAETZE, // erster Satz erst ab 01.01.2026
    });
    expect(r.berechenbar).toBe(false);
    if (r.berechenbar) return;
    expect(r.luecke.getFullYear()).toBe(2025);
  });

  it("rechnet keine Zinseszinsen", () => {
    // § 289 Satz 1 BGB. Zinsen laufen nur auf die Hauptforderung — die
    // Signatur lässt gar nichts anderes zu, und dieser Test hält das fest.
    const r = verzugszinsen({
      hauptCents: 0,
      faellig: new Date(2026, 1, 1),
      bis: new Date(2026, 11, 31),
      saetze: SAETZE,
    });
    expect(r).toEqual({ berechenbar: true, zinsenCents: 0, tage: 0 });
  });

  it("findet den zum Stichtag geltenden Satz", () => {
    expect(satzAm(SAETZE, new Date(2026, 3, 15))?.basispunkte).toBe(200);
    expect(satzAm(SAETZE, new Date(2026, 8, 15))?.basispunkte).toBe(100);
    expect(satzAm(SAETZE, new Date(2025, 8, 15))).toBeNull();
    // Der Geltungstag selbst gehört schon zum neuen Satz.
    expect(satzAm(SAETZE, new Date(2026, 6, 1))?.basispunkte).toBe(100);
  });
});
