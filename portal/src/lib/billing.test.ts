import { describe, expect, it } from "vitest";
import { PLANS, aktiverPlan, checkoutJeEinheitCents, planLabel } from "./billing";

describe("aktiverPlan", () => {
  it("meldet in der Testphase Pro, nicht den gespeicherten Tarif", () => {
    // Der springende Punkt: Neukunden testen den vollen Funktionsumfang. Die
    // Seite zeigte „Aktueller Tarif: Free" neben „Status: Testphase" — zwei
    // Angaben, die einander widersprechen.
    expect(aktiverPlan({ plan: "free", subscriptionStatus: "trialing" })).toBe("pro");
    expect(planLabel(aktiverPlan({ plan: "free", subscriptionStatus: "trialing" }))).toBe("Pro");
  });

  it("lässt den gespeicherten Tarif unangetastet, sobald die Testphase vorbei ist", () => {
    // `Organization.plan` sagt, worauf die Gemeinschaft NACH der Testphase
    // zurückfällt. Diese Aussage darf die Ableitung nicht überschreiben.
    expect(aktiverPlan({ plan: "free", subscriptionStatus: "canceled" })).toBe("free");
    expect(aktiverPlan({ plan: "pro", subscriptionStatus: "active" })).toBe("pro");
  });

  it("fällt bei unbekanntem Tarif auf free zurück statt den Rohwert durchzureichen", () => {
    expect(aktiverPlan({ plan: "enterprise", subscriptionStatus: "active" })).toBe("free");
  });

  it("kennt die wegportal24-Einheiten-Tarife", () => {
    expect(aktiverPlan({ plan: "basic", subscriptionStatus: "active" })).toBe("basic");
    expect(aktiverPlan({ plan: "plus", subscriptionStatus: "active" })).toBe("plus");
    expect(planLabel("plus")).toBe("Verwalter-Plus");
  });
});

describe("Einheiten-Tarife", () => {
  it("tragen die Preise der einen Preisquelle", () => {
    // Preisseite und Abrechnung dürfen nie zwei verschiedene Zahlen nennen —
    // beide lesen preise-daten.ts. Basic 10 €, Verwalter-Plus 13,90 € je
    // Einheit und Monat (Stand 04.08.2026, Festlegung des Auftraggebers).
    expect(PLANS.basic.perUnitCents).toBe(1000);
    expect(PLANS.plus.perUnitCents).toBe(1390);
  });

  it("berechnet den Checkout-Preis je Einheit nach der Mengenstaffel", () => {
    // Der Buchen-Knopf bucht GENAU die Zahlen der Preisseite: Basispreis bis
    // 4 Einheiten, 10 % Rabatt ab 5, 20 % ab 9 (RABATT_STAFFEL). Der Betrag
    // geht als price_data inline an Stripe — es gibt keine zweite Staffel im
    // Stripe-Dashboard, die abweichen könnte.
    expect(checkoutJeEinheitCents("basic", 2)).toBe(1000);
    expect(checkoutJeEinheitCents("basic", 5)).toBe(900);
    expect(checkoutJeEinheitCents("basic", 9)).toBe(800);
    expect(checkoutJeEinheitCents("plus", 4)).toBe(1390);
    expect(checkoutJeEinheitCents("plus", 5)).toBe(1251);
    expect(checkoutJeEinheitCents("plus", 12)).toBe(1112);
  });
});

describe("Tarifbeschreibungen", () => {
  it("behaupten keinen fertigen Grundtarif", () => {
    // Free gibt es in diesem Zuschnitt noch nicht — „Zum Ausprobieren“ stand
    // außerdem am falschen Tarif: Ausprobiert wird Pro.
    expect(PLANS.free.description).not.toContain("Zum Ausprobieren");
    expect(PLANS.free.description).toContain("noch festgelegt");
  });
});
