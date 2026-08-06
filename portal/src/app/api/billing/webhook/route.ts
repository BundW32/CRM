import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { isBillingEnabled } from "@/lib/billing";
import { alertBetreiber, mailOrgSuperAdmins } from "@/lib/billing-notify";
import { mapStripeStatus, stripeOrNull, stripeWebhookSecret } from "@/lib/stripe";
import { portalUrl } from "@/lib/url";

export const dynamic = "force-dynamic";

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

  // Idempotenz-Wand: Stripe liefert Events mehrfach. Die Event-Id wird VOR der
  // Verarbeitung eingetragen; ein zweites Eintreffen scheitert am Unique und
  // wird ohne Wirkung beantwortet. Schlägt die Verarbeitung fehl, wird der
  // Eintrag im Fehlerpfad wieder entfernt, damit der Stripe-Retry nicht als
  // „schon verarbeitet" durchfällt.
  try {
    await db.stripeEvent.create({ data: { id: event.id, type: event.type } });
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error("Stripe-Webhook: Idempotenz-Eintrag fehlgeschlagen", err);
    return NextResponse.json({ error: "Verarbeitung fehlgeschlagen" }, { status: 500 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const organizationId = session.client_reference_id;
        if (organizationId) {
          await db.organization.updateMany({
            where: { id: organizationId },
            data: {
              plan: "pro",
              subscriptionStatus: "active",
              // Ids nur setzen, wenn Stripe sie liefert — nie eine vorhandene
              // Zuordnung mit null überschreiben (expandierte Objekte statt
              // Strings sind bei Stripe eine Frage der API-Konfiguration).
              ...(typeof session.customer === "string"
                ? { stripeCustomerId: session.customer }
                : {}),
              ...(typeof session.subscription === "string"
                ? { stripeSubscriptionId: session.subscription }
                : {}),
            },
          });
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const status =
          event.type === "customer.subscription.deleted"
            ? "canceled"
            : mapStripeStatus(sub.status);
        const customerId = typeof sub.customer === "string" ? sub.customer : null;
        // Zuordnung über die Subscription-Id, ersatzweise über die Customer-Id.
        const result = await db.organization.updateMany({
          where: customerId
            ? { OR: [{ stripeSubscriptionId: sub.id }, { stripeCustomerId: customerId }] }
            : { stripeSubscriptionId: sub.id },
          data: {
            subscriptionStatus: status,
            // Reaktivierung nach Kündigung: „canceled" hatte den Plan auf free
            // zurückgesetzt — wird das Abo wieder aktiv, gehört er zurück auf pro.
            ...(status === "active" ? { plan: "pro" } : {}),
            ...(status === "canceled" ? { plan: "free" } : {}),
          },
        });
        if (result.count === 0) {
          // Kein Treffer heißt: Das Event kam vor dem checkout.completed an
          // (Reihenfolge ist bei Stripe nicht garantiert) oder die Zuordnung
          // ist verloren. Beides driftet still — deshalb Alarm; der tägliche
          // Abgleich (api/cron/billing-abgleich) zieht den Zustand gerade.
          await alertBetreiber(
            "Abo-Event ohne zugeordnete Organisation",
            `Event ${event.id} (${event.type}) traf keine Organisation.\n` +
              `Subscription: ${sub.id}\nCustomer: ${customerId ?? "unbekannt"}\n` +
              `Der tägliche Billing-Abgleich sollte den Zustand geradeziehen.`,
          );
        }
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : null;
        if (!customerId) break;
        const orgs = await db.organization.findMany({
          where: { stripeCustomerId: customerId },
          select: { id: true, name: true },
        });
        if (orgs.length === 0) {
          await alertBetreiber(
            "Fehlgeschlagene Zahlung ohne zugeordnete Organisation",
            `Event ${event.id}: invoice.payment_failed für Customer ${customerId}.`,
          );
          break;
        }
        for (const org of orgs) {
          // Status sofort auf Kulanz — nicht erst, wenn Stripe irgendwann das
          // subscription.updated nachliefert.
          await db.organization.updateMany({
            where: { id: org.id, subscriptionStatus: { not: "canceled" } },
            data: { subscriptionStatus: "past_due" },
          });
          // Dunning-Anstoß: Wer zahlen kann, muss es sofort erfahren — mit dem
          // direkten Weg zur Zahlungsmethode, nicht über ein Support-Ticket.
          await mailOrgSuperAdmins(
            org.id,
            "Ihre Abo-Zahlung ist fehlgeschlagen",
            `die letzte Zahlung für Ihr Abo (${org.name}) konnte nicht eingezogen werden.\n\n` +
              `Der Einzug wird automatisch wiederholt. Bitte prüfen Sie Ihre ` +
              `Zahlungsmethode, damit der Zugang nicht unterbrochen wird:\n\n` +
              `${portalUrl("/verwaltung/abrechnung")}\n\n` +
              `Dort öffnen Sie über „Zahlungsmittel & Rechnungen" das Stripe-Kundenportal.`,
          );
        }
        break;
      }
      case "customer.subscription.trial_will_end": {
        // Stripe meldet das drei Tage vor Trial-Ende — nur für Abos, die BEI
        // Stripe im Trial laufen. Die portalinterne Testphase (trialEndsAt ohne
        // Stripe-Abo) erinnert der tägliche Billing-Abgleich.
        const sub = event.data.object as Stripe.Subscription;
        const customerId = typeof sub.customer === "string" ? sub.customer : null;
        const orgs = await db.organization.findMany({
          where: customerId
            ? { OR: [{ stripeSubscriptionId: sub.id }, { stripeCustomerId: customerId }] }
            : { stripeSubscriptionId: sub.id },
          select: { id: true, name: true },
        });
        for (const org of orgs) {
          await mailOrgSuperAdmins(
            org.id,
            "Ihre Testphase endet in wenigen Tagen",
            `die Testphase für ${org.name} endet in wenigen Tagen.\n\n` +
              `Damit Sie ohne Unterbrechung weiterarbeiten, buchen Sie das Abo unter:\n\n` +
              `${portalUrl("/verwaltung/abrechnung")}`,
          );
        }
        break;
      }
      default:
        // Andere Events ignorieren wir bewusst.
        break;
    }
  } catch (err) {
    console.error("Stripe-Webhook-Verarbeitung fehlgeschlagen", err);
    // Idempotenz-Eintrag zurücknehmen, damit der Stripe-Retry erneut verarbeitet
    // wird — sonst fiele die Wiederholung als „schon gesehen" durch.
    await db.stripeEvent.deleteMany({ where: { id: event.id } }).catch(() => {});
    await alertBetreiber(
      "Webhook-Verarbeitung fehlgeschlagen",
      `Event ${event.id} (${event.type}) konnte nicht verarbeitet werden:\n${String(err)}\n\n` +
        `Stripe wiederholt die Zustellung automatisch.`,
    );
    return NextResponse.json({ error: "Verarbeitung fehlgeschlagen" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
