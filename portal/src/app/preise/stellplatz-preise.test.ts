import { describe, expect, it } from "vitest";
import {
  BASIC_JE_EINHEIT_EUR,
  MAX_EINHEITEN,
  monatspreis,
  monatspreisGesamt,
  PLUS_JE_EINHEIT_EUR,
  rabattFuer,
  STELLPLATZ_JE_MONAT_EUR,
} from "./preise-daten";

// Stellplätze und Garagen: pauschal 1 € je Stellplatz/Monat, ohne Staffel —
// und ohne jede Rückwirkung auf die Einheiten-Rechnung. Die Szenarien stammen
// aus der Aufgabenstellung vom 07.08.2026 (inkl. Akzeptanzkriterium 58 €).
describe("monatspreisGesamt", () => {
  it("rechnet ohne Stellplätze wie bisher", () => {
    expect(monatspreisGesamt(BASIC_JE_EINHEIT_EUR, 1, 0)).toBe(10);
    expect(monatspreisGesamt(BASIC_JE_EINHEIT_EUR, 4, 0)).toBe(40);
  });

  it("addiert Stellplätze flach — unterhalb der Rabattstaffel", () => {
    // 4 Einheiten (kein Rabatt) + 3 Stellplätze: 40 + 3 = 43 €
    expect(monatspreisGesamt(BASIC_JE_EINHEIT_EUR, 4, 3)).toBe(43);
  });

  it("gibt den Mengenrabatt nur auf Einheiten, nie auf Stellplätze", () => {
    // 5 Einheiten (10 %) + 2 Stellplätze: 5×10×0,9 + 2×1 = 47 €
    expect(monatspreisGesamt(BASIC_JE_EINHEIT_EUR, 5, 2)).toBe(47);
    // 9 Einheiten (20 %) + 9 Stellplätze: 9×10×0,8 + 9×1 = 81 €
    expect(monatspreisGesamt(BASIC_JE_EINHEIT_EUR, 9, 9)).toBe(81);
  });

  it("erfüllt das Akzeptanzkriterium: 6 Einheiten Basic + 4 Stellplätze = 58 €", () => {
    // 6×10×0,9 + 4×1 = 58 € brutto — identisch in Rechner, Checkout, Abo.
    expect(monatspreisGesamt(BASIC_JE_EINHEIT_EUR, 6, 4)).toBe(58);
  });

  it("rechnet Verwalter-Plus mit demselben Stellplatzpreis", () => {
    // 6×13,90×0,9 + 4×1 = 75,06 + 4 = 79,06 €
    expect(monatspreisGesamt(PLUS_JE_EINHEIT_EUR, 6, 4)).toBeCloseTo(79.06, 2);
    // Der Stellplatzpreis hängt nicht am Tarif.
    expect(
      monatspreisGesamt(PLUS_JE_EINHEIT_EUR, 4, 3) - monatspreis(PLUS_JE_EINHEIT_EUR, 4),
    ).toBe(3 * STELLPLATZ_JE_MONAT_EUR);
  });

  it("lässt Stellplätze die Rabattstufen nicht beeinflussen", () => {
    // 4 Einheiten + 10 Stellplätze: Die Staffel greift NICHT (sie zählt nur
    // Einheiten) — 40 + 10 = 50 €, nicht 4×9 + 10.
    expect(rabattFuer(4)).toBe(0);
    expect(monatspreisGesamt(BASIC_JE_EINHEIT_EUR, 4, 10)).toBe(50);
  });

  it("hält die 12er-Grenze frei von Stellplätzen (nur eine Zahl, keine Summe)", () => {
    // Die Grenze wird überall gegen die EINHEITEN-Zahl geprüft
    // (billing-checkout, billing-sync, wechsleTarif über zaehleWegMengen) —
    // dieser Test hält die Konstante fest, damit ein künftiger Umbau der
    // Grenze die Stellplätze nicht wieder einrechnet.
    expect(MAX_EINHEITEN).toBe(12);
    expect(monatspreisGesamt(BASIC_JE_EINHEIT_EUR, 12, 40)).toBe(12 * 8 + 40);
  });
});
