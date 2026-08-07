import { describe, expect, it } from "vitest";
import { PLANS, aktiverPlan, planLabel, zugriffsStatus } from "./billing";

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
});

describe("zugriffsStatus", () => {
  const now = new Date("2026-08-06T12:00:00Z");
  const morgen = new Date("2026-08-07T12:00:00Z");
  const gestern = new Date("2026-08-05T12:00:00Z");

  it("lässt aktive Abos und laufende Testphasen arbeiten", () => {
    expect(zugriffsStatus({ subscriptionStatus: "active", trialEndsAt: null }, now)).toBe("voll");
    expect(zugriffsStatus({ subscriptionStatus: "trialing", trialEndsAt: morgen }, now)).toBe("voll");
  });

  it("sperrt eine abgelaufene Testphase — das ist der Kern der Abo-Durchsetzung", () => {
    // Ohne diese Sperre wäre die Testphase nur eine Zahl in der Datenbank:
    // Ihr Ablauf hätte keinerlei Wirkung, und niemand hätte je einen Grund zu buchen.
    expect(zugriffsStatus({ subscriptionStatus: "trialing", trialEndsAt: gestern }, now)).toBe(
      "gesperrt",
    );
  });

  it("lässt eine Testphase OHNE Enddatum unbefristet laufen (von der Plattform angelegte Organisationen)", () => {
    expect(zugriffsStatus({ subscriptionStatus: "trialing", trialEndsAt: null }, now)).toBe("voll");
  });

  it("sperrt gekündigte Abos und gewährt bei überfälliger Zahlung Kulanz", () => {
    expect(zugriffsStatus({ subscriptionStatus: "canceled", trialEndsAt: null }, now)).toBe(
      "gesperrt",
    );
    // Stripe wiederholt die Zahlung (Smart Retries) — der Kunde bleibt drin,
    // die Oberfläche mahnt. Endgültig scheitern setzt „canceled".
    expect(zugriffsStatus({ subscriptionStatus: "past_due", trialEndsAt: null }, now)).toBe(
      "kulanz",
    );
  });

  it("sperrt bei unbekanntem Status niemanden aus (Drift meldet der Abgleich)", () => {
    expect(zugriffsStatus({ subscriptionStatus: "kaputt", trialEndsAt: gestern }, now)).toBe("voll");
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
