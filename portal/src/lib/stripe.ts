import Stripe from "stripe";
import type { PlanId, SubscriptionStatus } from "./billing";

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
//   STRIPE_PRICE_BASIC     – Preis-ID des Basic-Abos je Einheit (price_…),
//                            in Stripe als Volumen-Staffel angelegt
//   STRIPE_PRICE_PLUS      – Preis-ID des Verwalter-Plus-Abos je Einheit
//   STRIPE_PRICE_PRO       – Preis-ID des pauschalen Pro-Abos (B&W-Variante)
//   STRIPE_PRICE_STELLPLATZ – Preis-ID der Stellplatz-Position (1 €/Monat je
//                            Stellplatz, flach); ohne sie wird der Preis wie
//                            bei den Tarifen inline aus preise-daten erzeugt
//   PORTAL_BASE_URL        – Basis-URL für Success/Cancel/Return
//   BILLING_ALERT_EMAIL    – Empfänger der Billing-Alarme (Webhook-Fehler,
//                            Drift im täglichen Abgleich); ersatzweise geht der
//                            Alarm an die erste Adresse aus PLATFORM_ADMIN_EMAILS
export function stripePricePro(): string | null {
  return process.env.STRIPE_PRICE_PRO || null;
}

export function stripePriceBasic(): string | null {
  return process.env.STRIPE_PRICE_BASIC || null;
}

export function stripePricePlus(): string | null {
  return process.env.STRIPE_PRICE_PLUS || null;
}

export function stripePriceStellplatz(): string | null {
  return process.env.STRIPE_PRICE_STELLPLATZ || null;
}

// Kennzeichen der Stellplatz-Position am Stripe-Produkt. Der Mengenabgleich
// und der Tarifwechsel müssen die beiden Abo-Posten (Tarif je Einheit,
// Stellplätze) auseinanderhalten — bei inline erzeugten Preisen verrät die
// Preis-Id nichts, deshalb trägt das Produkt dieses Metadatum.
export const STELLPLATZ_PRODUKT_METADATUM = { posten: "stellplatz" } as const;

/** Ist dieser Abo-Posten die Stellplatz-Position? (Preis-Id oder Produkt-Metadatum) */
export function istStellplatzPosten(item: {
  price: { id: string; product: string | { id: string; metadata?: Record<string, string> } };
}): boolean {
  const envId = stripePriceStellplatz();
  if (envId && item.price.id === envId) return true;
  const product = item.price.product;
  return (
    typeof product !== "string" &&
    product.metadata?.posten === STELLPLATZ_PRODUKT_METADATUM.posten
  );
}

export function stripeWebhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET || null;
}

// Leitet den Tarif aus der Stripe-Preis-Id ab. Nötig überall dort, wo es KEINE
// Checkout-Metadaten gibt: bei `customer.subscription.updated` und im täglichen
// Abgleich. Ohne diese Ableitung stünde dort nur ein pauschales „pro" — und
// jedes Abo-Update überschriebe den gebuchten Basic-/Plus-Tarif.
// null = Preis keinem Tarif zuordenbar (dann den gespeicherten Plan lassen).
export function planFromPriceId(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null;
  if (priceId === stripePriceBasic()) return "basic";
  if (priceId === stripePricePlus()) return "plus";
  if (priceId === stripePricePro()) return "pro";
  return null;
}

// Erzeugt eine Customer-Portal-Session (Zahlungsmittel, Rechnungen, Kündigung).
// Von der Abrechnungsseite UND der Sperrseite (/abo) genutzt.
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
