import { describe, expect, it } from "vitest";
import { PLANS, aktiverPlan, planLabel } from "./billing";

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
});

describe("Tarifbeschreibungen", () => {
  it("behaupten keinen fertigen Grundtarif", () => {
    // Free gibt es in diesem Zuschnitt noch nicht — „Zum Ausprobieren“ stand
    // außerdem am falschen Tarif: Ausprobiert wird Pro.
    expect(PLANS.free.description).not.toContain("Zum Ausprobieren");
    expect(PLANS.free.description).toContain("noch festgelegt");
  });
});
