import Stripe from "stripe";

// Lazy Stripe-Client. Ohne STRIPE_SECRET_KEY ist die Anbindung inaktiv
// (`stripeOrNull()` liefert dann null) – Build und App laufen ohne Keys durch,
// alle Billing-Pfade sind hinter isBillingEnabled() gegated.
let cached: Stripe | null | undefined;

export function stripeOrNull(): Stripe | null {
  if (cached !== undefined) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  cached = key ? new Stripe(key) : null;
  return cached;
}

// Env-Konfiguration (alles optional; ohne diese bleibt Billing inaktiv):
//   STRIPE_SECRET_KEY      – Secret Key (sk_test_… / sk_live_…)
//   STRIPE_WEBHOOK_SECRET  – Signing Secret des Webhook-Endpoints (whsec_…)
//   STRIPE_PRICE_PRO       – Preis-ID des Pro-Abos (price_…) aus dem Dashboard
//   PORTAL_BASE_URL        – Basis-URL für Success/Cancel/Return
export function stripePricePro(): string | null {
  return process.env.STRIPE_PRICE_PRO || null;
}

export function stripeWebhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET || null;
}
