import Stripe from "stripe";
import type { SubscriptionStatus } from "./billing";

// Stripe-Abo-Status → unser subscriptionStatus. Vom Webhook UND vom täglichen
// Abgleich genutzt — zwei Kopien dieser Zuordnung würden auseinanderlaufen.
export function mapStripeStatus(s: Stripe.Subscription.Status): SubscriptionStatus {
  switch (s) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
    case "unpaid":
      return "past_due";
    default:
      return "canceled";
  }
}

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
//   BILLING_ALERT_EMAIL    – Empfänger der Billing-Alarme (Webhook-Fehler,
//                            Drift im täglichen Abgleich); ersatzweise geht der
//                            Alarm an die erste Adresse aus PLATFORM_ADMIN_EMAILS
export function stripePricePro(): string | null {
  return process.env.STRIPE_PRICE_PRO || null;
}

export function stripeWebhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET || null;
}

// ── Gemeinsame Checkout-/Portal-Helfer ──────────────────────────────────────
// Von der Abrechnungsseite UND der Sperrseite (/abo) genutzt. Beide Aufrufer
// unterscheiden sich nur in den Rücksprung-Adressen — die Stripe-Logik selbst
// darf es nur einmal geben.

// Erzeugt eine Checkout-Session für das Pro-Abo. null = Billing nicht
// konfiguriert oder Stripe lieferte keine URL.
export async function createCheckoutUrl(
  org: { id: string; stripeCustomerId: string | null },
  successUrl: string,
  cancelUrl: string,
): Promise<string | null> {
  const stripe = stripeOrNull();
  const price = stripePricePro();
  if (!stripe || !price) return null;
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    client_reference_id: org.id,
    customer: org.stripeCustomerId ?? undefined,
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
  return session.url ?? null;
}

// Erzeugt eine Customer-Portal-Session (Zahlungsmittel, Rechnungen, Kündigung).
// null = Billing nicht konfiguriert oder noch kein Stripe-Kunde.
export async function createPortalUrl(
  org: { stripeCustomerId: string | null },
  returnUrl: string,
): Promise<string | null> {
  const stripe = stripeOrNull();
  if (!stripe || !org.stripeCustomerId) return null;
  const session = await stripe.billingPortal.sessions.create({
    customer: org.stripeCustomerId,
    return_url: returnUrl,
  });
  return session.url;
}
