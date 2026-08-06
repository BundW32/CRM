"use server";

import { redirect } from "next/navigation";
import { isBillingEnabled } from "@/lib/billing";
import { getOrganization, requireVerwalter } from "@/lib/session";
import { stripeOrNull, stripePricePro } from "@/lib/stripe";

function baseUrl(): string {
  return (process.env.PORTAL_BASE_URL ?? "").replace(/\/$/, "");
}

// Startet den Stripe-Checkout für das Pro-Abo. Nur SuperAdmin, nur wenn Billing
// konfiguriert ist (sonst bleibt die Seite beim „wird eingerichtet"-Hinweis).
export async function startCheckout() {
  const actor = await requireVerwalter();
  if (!actor.isSuperAdmin) redirect("/verwaltung");
  const org = await getOrganization();
  if (!org) redirect("/verwaltung");

  const stripe = stripeOrNull();
  const price = stripePricePro();
  if (!isBillingEnabled() || !stripe || !price) {
    redirect("/verwaltung/abrechnung?fehler=nicht_konfiguriert");
  }

  const base = baseUrl();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    client_reference_id: org.id,
    customer: org.stripeCustomerId ?? undefined,
    // Nach dem Bezahlen auf die Danke-Seite — nicht zurück in die nüchterne
    // Abrechnungs-Übersicht. Der Abbruch bleibt dort, wo man weitermacht.
    success_url: `${base}/verwaltung/abrechnung/danke`,
    cancel_url: `${base}/verwaltung/abrechnung?abbruch=1`,
  });
  if (!session.url) redirect("/verwaltung/abrechnung?fehler=nicht_konfiguriert");
  redirect(session.url);
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

  const session = await stripe.billingPortal.sessions.create({
    customer: org.stripeCustomerId,
    return_url: `${baseUrl()}/verwaltung/abrechnung`,
  });
  redirect(session.url);
}
