"use server";

import { redirect } from "next/navigation";
import { isBillingEnabled } from "@/lib/billing";
import { getOrganization, requireVerwalter } from "@/lib/session";
import { createCheckoutUrl, createPortalUrl } from "@/lib/stripe";

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

  if (!isBillingEnabled()) {
    redirect("/verwaltung/abrechnung?fehler=nicht_konfiguriert");
  }

  const base = baseUrl();
  // Nach dem Bezahlen auf die Danke-Seite — nicht zurück in die nüchterne
  // Abrechnungs-Übersicht. Der Abbruch bleibt dort, wo man weitermacht.
  const url = await createCheckoutUrl(
    org,
    `${base}/verwaltung/abrechnung/danke`,
    `${base}/verwaltung/abrechnung?abbruch=1`,
  );
  if (!url) redirect("/verwaltung/abrechnung?fehler=nicht_konfiguriert");
  redirect(url);
}

// Öffnet das Stripe-Kundenportal (Zahlungsmittel/Kündigung/Rechnungen).
export async function openBillingPortal() {
  const actor = await requireVerwalter();
  if (!actor.isSuperAdmin) redirect("/verwaltung");
  const org = await getOrganization();
  if (!org) redirect("/verwaltung");

  if (!isBillingEnabled() || !org.stripeCustomerId) {
    redirect("/verwaltung/abrechnung?fehler=kein_kunde");
  }

  const url = await createPortalUrl(org, `${baseUrl()}/verwaltung/abrechnung`);
  if (!url) redirect("/verwaltung/abrechnung?fehler=kein_kunde");
  redirect(url);
}
