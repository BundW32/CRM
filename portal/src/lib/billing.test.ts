import { describe, expect, it } from "vitest";
import {
  PLANS,
  STELLPLATZ_CENTS,
  aboHinweis,
  aktiverPlan,
  checkoutJeEinheitCents,
  hatPlanFunktion,
  istTestphaseAbgelaufen,
  planLabel,
  zugriffsStatus,
} from "./billing";

// Hilfen: eine Organisation mit laufender bzw. abgelaufener Testfrist.
const inZukunft = new Date(Date.now() + 7 * 86_400_000);
const inVergangenheit = new Date(Date.now() - 7 * 86_400_000);

describe("aktiverPlan", () => {
  it("meldet in der laufenden Testphase Pro, nicht den gespeicherten Tarif", () => {
    // Der springende Punkt: Neukunden testen den vollen Funktionsumfang. Die
    // Seite zeigte „Aktueller Tarif: Free" neben „Status: Testphase" — zwei
    // Angaben, die einander widersprechen.
    const org = { plan: "free", subscriptionStatus: "trialing", trialEndsAt: inZukunft };
    expect(aktiverPlan(org)).toBe("pro");
    expect(planLabel(aktiverPlan(org))).toBe("Pro");
  });

  it("fällt nach Ablauf der Testfrist auf den gespeicherten Tarif zurück", () => {
    // Vorher lieferte "trialing" IMMER Pro — und weil niemand den Status nach
    // Fristablauf umstellt, lief jede Testphase faktisch ewig weiter.
    expect(
      aktiverPlan({ plan: "free", subscriptionStatus: "trialing", trialEndsAt: inVergangenheit }),
    ).toBe("free");
    expect(istTestphaseAbgelaufen({ subscriptionStatus: "trialing", trialEndsAt: inVergangenheit })).toBe(true);
    expect(istTestphaseAbgelaufen({ subscriptionStatus: "trialing", trialEndsAt: inZukunft })).toBe(false);
  });

  it("lässt eine Testphase ohne Frist (B&W-Tür) nicht ablaufen", () => {
    expect(
      aktiverPlan({ plan: "free", subscriptionStatus: "trialing", trialEndsAt: null }),
    ).toBe("pro");
    expect(istTestphaseAbgelaufen({ subscriptionStatus: "trialing", trialEndsAt: null })).toBe(false);
  });

  it("lässt den gespeicherten Tarif unangetastet, sobald die Testphase vorbei ist", () => {
    // `Organization.plan` sagt, worauf die Gemeinschaft NACH der Testphase
    // zurückfällt. Diese Aussage darf die Ableitung nicht überschreiben.
    expect(aktiverPlan({ plan: "free", subscriptionStatus: "canceled", trialEndsAt: null })).toBe("free");
    expect(aktiverPlan({ plan: "pro", subscriptionStatus: "active", trialEndsAt: null })).toBe("pro");
  });

  it("fällt bei unbekanntem Tarif auf free zurück statt den Rohwert durchzureichen", () => {
    expect(aktiverPlan({ plan: "enterprise", subscriptionStatus: "active", trialEndsAt: null })).toBe("free");
  });

  it("kennt die wegportal24-Einheiten-Tarife", () => {
    expect(aktiverPlan({ plan: "basic", subscriptionStatus: "active", trialEndsAt: null })).toBe("basic");
    expect(aktiverPlan({ plan: "plus", subscriptionStatus: "active", trialEndsAt: null })).toBe("plus");
    expect(planLabel("plus")).toBe("Verwalter-Plus");
  });
});

describe("hatPlanFunktion", () => {
  it("gibt das Verwalter-Ticket nur Verwalter-Plus (und der Testphase)", () => {
    // Das Ticket-System ist DAS Unterscheidungsmerkmal zwischen Basic und
    // Verwalter-Plus — Basic darf es nie haben, sonst gibt es keinen Grund
    // für den Aufpreis. Die Testphase verspricht den vollen Umfang und
    // schließt es deshalb ein.
    const aktiv = (plan: string) => ({ plan, subscriptionStatus: "active", trialEndsAt: null });
    expect(hatPlanFunktion(aktiv("plus"), "verwalterTicket")).toBe(true);
    expect(hatPlanFunktion(aktiv("basic"), "verwalterTicket")).toBe(false);
    expect(hatPlanFunktion(aktiv("free"), "verwalterTicket")).toBe(false);
    expect(
      hatPlanFunktion(
        { plan: "free", subscriptionStatus: "trialing", trialEndsAt: inZukunft },
        "verwalterTicket",
      ),
    ).toBe(true);
  });

  it("nimmt Start (free) die Arbeitsfunktionen, lässt sie jedem bezahlten Tarif", () => {
    const aktiv = (plan: string) => ({ plan, subscriptionStatus: "active", trialEndsAt: null });
    expect(hatPlanFunktion(aktiv("free"), "vollerUmfang")).toBe(false);
    expect(hatPlanFunktion(aktiv("basic"), "vollerUmfang")).toBe(true);
    expect(hatPlanFunktion(aktiv("plus"), "vollerUmfang")).toBe(true);
    expect(hatPlanFunktion(aktiv("pro"), "vollerUmfang")).toBe(true);
    // Abgelaufene Testphase = Start-Umfang.
    expect(
      hatPlanFunktion(
        { plan: "free", subscriptionStatus: "trialing", trialEndsAt: inVergangenheit },
        "vollerUmfang",
      ),
    ).toBe(false);
  });
});

describe("aboHinweis", () => {
  it("meldet Zahlungsverzug, Kündigung und abgelaufene Testphase — sonst nichts", () => {
    expect(aboHinweis({ plan: "basic", subscriptionStatus: "past_due", trialEndsAt: null })).toBe(
      "zahlung-ueberfaellig",
    );
    expect(aboHinweis({ plan: "free", subscriptionStatus: "canceled", trialEndsAt: null })).toBe(
      "gekuendigt",
    );
    expect(
      aboHinweis({ plan: "free", subscriptionStatus: "trialing", trialEndsAt: inVergangenheit }),
    ).toBe("testphase-abgelaufen");
    expect(
      aboHinweis({ plan: "free", subscriptionStatus: "trialing", trialEndsAt: inZukunft }),
    ).toBe(null);
    expect(aboHinweis({ plan: "plus", subscriptionStatus: "active", trialEndsAt: null })).toBe(null);
  });

  it("lässt past_due den vollen Umfang (Kulanz — Stripe mahnt selbst)", () => {
    // Wer im Zahlungsverzug sofort gesperrt wird, kann die Ursache (abgelaufene
    // Karte) oft nicht mal mehr im Portal beheben wollen. Endgültiges Scheitern
    // kommt als `canceled` per Webhook, DANN greift der Start-Umfang.
    const org = { plan: "plus", subscriptionStatus: "past_due", trialEndsAt: null };
    expect(hatPlanFunktion(org, "vollerUmfang")).toBe(true);
    expect(hatPlanFunktion(org, "verwalterTicket")).toBe(true);
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

  it("berechnet Stellplätze flach mit 1 € — die Staffel greift dort nie", () => {
    // Der Stellplatz-Posten geht mit genau diesem Betrag an Stripe — in
    // beiden Bezahltarifen gleich, unabhängig von der Einheitenzahl.
    expect(STELLPLATZ_CENTS).toBe(100);
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

  it("meldet eine abgelaufene Testphase als gesperrt (heißt: Start-Umfang, kein Aussperren)", () => {
    // „gesperrt" führt seit dem 06.08.2026 nicht mehr auf eine Sperrseite —
    // es gilt der Start-Umfang, und die Buchungsseite /abo nutzt den Status
    // als Zugangswächter. Ohne die Ableitung hätte der Ablauf gar keine Wirkung.
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
  it("Start beschreibt den festgelegten Umfang der Preisseite", () => {
    // Der Zuschnitt steht seit der Start-Karte der Preisseite fest: einrichten
    // und ansehen, ohne Zeitlimit. „Zum Ausprobieren" bleibt draußen —
    // ausprobiert wird der volle Umfang, und zwar in der Testphase.
    expect(PLANS.free.name).toBe("Start");
    expect(PLANS.free.description).not.toContain("Zum Ausprobieren");
    expect(PLANS.free.description).not.toContain("noch festgelegt");
    expect(PLANS.free.description).toContain("Einrichten und Ansehen");
  });
});
