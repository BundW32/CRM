import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { isBillingEnabled } from "@/lib/billing";
import type { SubscriptionStatus } from "@/lib/billing";
import { stripeOrNull, stripeWebhookSecret } from "@/lib/stripe";

export const dynamic = "force-dynamic";

// Stripe-Abo-Status → unser subscriptionStatus.
function mapStatus(s: Stripe.Subscription.Status): SubscriptionStatus {
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

export async function POST(request: Request) {
  const stripe = stripeOrNull();
  const secret = stripeWebhookSecret();
  if (!isBillingEnabled() || !stripe || !secret) {
    // Ohne konfiguriertes Stripe ist der Endpoint bewusst inaktiv.
    return NextResponse.json({ error: "Billing nicht konfiguriert" }, { status: 501 });
  }

  const sig = request.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Signatur fehlt" }, { status: 400 });

  const raw = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    console.error("Stripe-Webhook: Signatur ungültig", err);
    return NextResponse.json({ error: "Ungültige Signatur" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const organizationId = session.client_reference_id;
        if (organizationId) {
          // Welcher Tarif gebucht wurde, steht in den Metadaten der Session
          // (gesetzt in abrechnung/actions.ts). Unbekannte Werte fallen auf
          // "pro" zurück — das ist der Alt-Zustand vor den Einheiten-Tarifen.
          const tarifRaw = session.metadata?.tarif;
          const plan = tarifRaw === "basic" || tarifRaw === "plus" ? tarifRaw : "pro";
          await db.organization.updateMany({
            where: { id: organizationId },
            data: {
              plan,
              subscriptionStatus: "active",
              stripeCustomerId: typeof session.customer === "string" ? session.customer : null,
              stripeSubscriptionId:
                typeof session.subscription === "string" ? session.subscription : null,
            },
          });
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const status = event.type === "customer.subscription.deleted" ? "canceled" : mapStatus(sub.status);
        const customerId = typeof sub.customer === "string" ? sub.customer : null;
        // Der Tarif steht seit dem Checkout auch am Abo selbst (subscription_data
        // bzw. Tarifwechsel-Update) — so hält der Webhook `plan` auch dann
        // richtig, wenn der Wechsel woanders passierte (z. B. Stripe-Dashboard).
        const tarifMeta = sub.metadata?.tarif;
        const planAusMeta =
          tarifMeta === "basic" || tarifMeta === "plus" || tarifMeta === "pro"
            ? { plan: tarifMeta }
            : {};
        await db.organization.updateMany({
          where: customerId
            ? { OR: [{ stripeSubscriptionId: sub.id }, { stripeCustomerId: customerId }] }
            : { stripeSubscriptionId: sub.id },
          data: {
            subscriptionStatus: status,
            // Gekündigt heißt Start-Umfang — das gewinnt gegen jedes Metadatum.
            ...(status === "canceled" ? { plan: "free" } : planAusMeta),
          },
        });
        break;
      }
      default:
        // Andere Events ignorieren wir bewusst.
        break;
    }
  } catch (err) {
    console.error("Stripe-Webhook-Verarbeitung fehlgeschlagen", err);
    return NextResponse.json({ error: "Verarbeitung fehlgeschlagen" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
