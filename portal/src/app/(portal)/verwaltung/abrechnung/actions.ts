"use server";

import { redirect } from "next/navigation";
import type Stripe from "stripe";
import { MAX_EINHEITEN } from "@/app/preise/preise-daten";
import { checkoutJeEinheitCents, isBillingEnabled, type PlanId } from "@/lib/billing";
import { db } from "@/lib/db";
import { getOrganization, requireVerwalter } from "@/lib/session";
import { stripeOrNull, stripePriceBasic, stripePricePlus, stripePricePro } from "@/lib/stripe";
import { portalUrlFromRequest } from "@/lib/url-server";

// Startet den Stripe-Checkout. Nur SuperAdmin, nur wenn Billing konfiguriert
// ist (sonst bleibt die Seite beim „wird eingerichtet"-Hinweis).
//
// Zwei Modelle:
// - `basic` / `plus` (wegportal24): Preis JE EINHEIT — die Menge ist die
//   Einheitenzahl der WEG-Objekte der Organisation. Preis und Mengenstaffel
//   kommen aus `preise-daten.ts` und gehen als `price_data` inline an Stripe;
//   eine optional gesetzte STRIPE_PRICE_BASIC/_PLUS-Id hat Vorrang (dann liegt
//   die Staffel als Volumen-Preisstufen am Stripe-Preis selbst).
// - `pro` (B&W-Variante): pauschal je Organisation, Menge 1 — hier gibt es
//   keinen Preis im Code, die STRIPE_PRICE_PRO-Id bleibt Pflicht.
export async function startCheckout(formData: FormData) {
  const actor = await requireVerwalter();
  if (!actor.isSuperAdmin) redirect("/verwaltung");
  const org = await getOrganization();
  if (!org) redirect("/verwaltung");

  const tarifRaw = String(formData.get("tarif") ?? "pro");
  const tarif: PlanId = tarifRaw === "basic" ? "basic" : tarifRaw === "plus" ? "plus" : "pro";

  const stripe = stripeOrNull();
  if (!isBillingEnabled() || !stripe) {
    redirect("/verwaltung/abrechnung?fehler=nicht_konfiguriert");
  }

  let lineItem: Stripe.Checkout.SessionCreateParams.LineItem;
  if (tarif === "basic" || tarif === "plus") {
    // Die Einheit ist die Abrechnungsgröße: Sie steht in der Teilungserklärung
    // und ändert sich nicht — gezählt wird über alle WEG-Objekte der
    // Organisation (selbstverwaltete WEGs haben in aller Regel genau eines).
    const quantity = await db.unit.count({
      where: { property: { organizationId: org.id, managementType: "WEG" } },
    });
    if (quantity < 1) redirect("/verwaltung/abrechnung?fehler=keine_einheiten");
    // Oberhalb der Grenze ist Selbstverwaltung kein Self-Service-Fall mehr —
    // dieselbe Grenze wie auf der Preisseite.
    if (quantity > MAX_EINHEITEN) redirect("/verwaltung/abrechnung?fehler=zu_viele_einheiten");

    const preisId = tarif === "basic" ? stripePriceBasic() : stripePricePlus();
    lineItem = preisId
      ? { price: preisId, quantity }
      : {
          price_data: {
            currency: "eur",
            unit_amount: checkoutJeEinheitCents(tarif, quantity),
            recurring: { interval: "month" },
            product_data: {
              name: tarif === "basic" ? "wegportal24 Basic" : "wegportal24 Verwalter-Plus",
            },
          },
          quantity,
        };
  } else {
    const preisId = stripePricePro();
    if (!preisId) redirect("/verwaltung/abrechnung?fehler=nicht_konfiguriert");
    lineItem = { price: preisId, quantity: 1 };
  }

  // Erfolgs-/Abbruch-URL aus dem AKTUELLEN Host — so stimmt die Rückkehr-Domain
  // auf beiden Türen, ohne dass PORTAL_BASE_URL je Deployment gepflegt sein muss.
  const successUrl = await portalUrlFromRequest("/verwaltung/abrechnung/danke");
  const cancelUrl = await portalUrlFromRequest("/verwaltung/abrechnung?abbruch=1");

  // redirect() wirft NEXT_REDIRECT und darf deshalb nicht im try stehen —
  // sonst meldete der eigene catch den Erfolgsfall als Stripe-Fehler.
  let checkoutUrl: string | null = null;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [lineItem],
      client_reference_id: org.id,
      customer: org.stripeCustomerId ?? undefined,
      // Der Webhook liest den gebuchten Tarif aus den Metadaten — die Preis-Id
      // allein verrät ihn nicht, ohne sie erneut gegen die Env zu halten.
      metadata: { tarif },
      // Nach dem Bezahlen auf die Danke-Seite — nicht zurück in die nüchterne
      // Abrechnungs-Übersicht. Der Abbruch bleibt dort, wo man weitermacht.
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
    checkoutUrl = session.url;
  } catch (err) {
    console.error("Stripe-Checkout konnte nicht gestartet werden", err);
  }
  if (!checkoutUrl) redirect("/verwaltung/abrechnung?fehler=zahlung");
  redirect(checkoutUrl);
}

// Öffnet das Stripe-Kundenportal (Zahlungsmittel/Kündigung/Rechnungen).
export async function openBillingPortal() {
  const actor = await requireVerwalter();
  if (!actor.isSuperAdmin) redirect("/verwaltung");
  const org = await getOrganization();
  if (!org) redirect("/verwaltung");

  const stripe = stripeOrNull();
  if (!isBillingEnabled() || !stripe || !org.stripeCustomerId) {
    redirect("/verwaltung/abrechnung?fehler=kein_kunde");
  }

  const returnUrl = await portalUrlFromRequest("/verwaltung/abrechnung");
  let portalUrl: string | null = null;
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: returnUrl,
    });
    portalUrl = session.url;
  } catch (err) {
    console.error("Stripe-Kundenportal konnte nicht geöffnet werden", err);
  }
  if (!portalUrl) redirect("/verwaltung/abrechnung?fehler=zahlung");
  redirect(portalUrl);
}
