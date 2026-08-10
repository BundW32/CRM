import { describe, expect, it } from "vitest";
import { churnQuote, formatProzent, mrrCentsFuer } from "./business";

// Die Staffel (preise-daten.ts): ab 5 Einheiten 10 %, ab 9 Einheiten 20 % —
// Volume Pricing, der Rabatt gilt auf ALLE Einheiten. Gerundet wird wie im
// Checkout: Einheitenpreis auf Cent, dann mal Menge.

describe("mrrCentsFuer – Basic (10,00 €/Einheit) an den Staffelgrenzen", () => {
  it.each([
    // [Einheiten, erwartete Cent] — 4 → voller Preis, 5 → 10 %, 8 → 10 %,
    // 9 → 20 %, 12 → 20 % (Obergrenze), 13 → 20 % (über der Checkout-Grenze,
    // Bestandsabo rechnet weiter).
    [4, 4 * 1000],
    [5, 5 * 900],
    [8, 8 * 900],
    [9, 9 * 800],
    [12, 12 * 800],
    [13, 13 * 800],
  ])("%i Einheiten → %i Cent", (einheiten, cents) => {
    expect(mrrCentsFuer("basic", einheiten, 0)).toBe(cents);
  });

  it("die Sprungstellen lohnen sich nie rückwärts (9 kosten nicht mehr als 8+1 voll)", () => {
    // 8×9,00 = 72,00 → 9×8,00 = 72,00: der Sprung auf 20 % gleicht die
    // zusätzliche Einheit exakt aus.
    expect(mrrCentsFuer("basic", 9, 0)).toBeLessThanOrEqual(
      mrrCentsFuer("basic", 8, 0) + 1000,
    );
  });
});

describe("mrrCentsFuer – Verwalter-Plus (13,90 €/Einheit): krumme Staffelpreise", () => {
  it.each([
    [4, 4 * 1390], // 13,90 €
    [5, 5 * 1251], // 12,51 € (−10 %)
    [8, 8 * 1251],
    [9, 9 * 1112], // 11,12 € (−20 %)
    [12, 12 * 1112],
    [13, 13 * 1112],
  ])("%i Einheiten → %i Cent", (einheiten, cents) => {
    expect(mrrCentsFuer("plus", einheiten, 0)).toBe(cents);
  });

  it("rundet den Einheitenpreis, nicht die Summe (Stripe-Checkout-Logik)", () => {
    // 13,90 × 0,9 = 12,51 exakt; bei 20 %: 11,12. Fünf Einheiten: 6255 Cent —
    // die Summenrundung von 5 × 12,510000001 fiele genauso aus, aber bei
    // künftigen Preisänderungen nicht mehr. Der Test hält die Reihenfolge fest.
    expect(mrrCentsFuer("plus", 5, 0)).toBe(6255);
  });
});

describe("mrrCentsFuer – Stellplätze", () => {
  it("1,00 € je Stellplatz, flach, ohne Staffel — auch bei vielen", () => {
    expect(mrrCentsFuer("basic", 4, 3)).toBe(4 * 1000 + 3 * 100);
    // 10 Stellplätze lösen KEINE Staffel aus und keine 12er-Grenze.
    expect(mrrCentsFuer("basic", 2, 10)).toBe(2 * 1000 + 10 * 100);
  });

  it("Stellplätze zählen nicht in die Einheiten-Staffel", () => {
    // 4 Einheiten + 5 Stellplätze: Einheiten bleiben beim vollen Preis.
    expect(mrrCentsFuer("basic", 4, 5)).toBe(4 * 1000 + 5 * 100);
  });

  it("im Start-Tarif kosten auch Stellplätze nichts", () => {
    expect(mrrCentsFuer("free", 6, 4)).toBe(0);
  });
});

describe("mrrCentsFuer – Sonderfälle", () => {
  it("free und pro liefern 0 (pro hat keinen hinterlegten Preis)", () => {
    expect(mrrCentsFuer("free", 8, 0)).toBe(0);
    expect(mrrCentsFuer("pro", 8, 0)).toBe(0);
    expect(mrrCentsFuer("unbekannt", 8, 0)).toBe(0);
  });

  it("nichts Abrechenbares → 0; negative Mengen zählen nicht", () => {
    expect(mrrCentsFuer("basic", 0, 0)).toBe(0);
    expect(mrrCentsFuer("basic", 3, -2)).toBe(3 * 1000);
  });
});

describe("churnQuote", () => {
  it("Kündigungen bezogen auf den Bestand zu Beginn", () => {
    expect(churnQuote(2, 40)).toBeCloseTo(0.05);
    expect(churnQuote(0, 40)).toBe(0);
  });

  it("ohne Bestand keine Quote", () => {
    expect(churnQuote(0, 0)).toBeNull();
    expect(churnQuote(3, 0)).toBeNull();
  });
});

describe("formatProzent", () => {
  it("deutsche Darstellung mit einer Nachkommastelle", () => {
    expect(formatProzent(0.05)).toBe("5,0 %");
    expect(formatProzent(0.1234)).toBe("12,3 %");
  });
});
