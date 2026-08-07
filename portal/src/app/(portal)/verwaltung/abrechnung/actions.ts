"use server";

import { redirect } from "next/navigation";
import { isBillingEnabled } from "@/lib/billing";
import { parseTarif, starteCheckout } from "@/lib/billing-checkout";
import { getOrganization, requireVerwalter } from "@/lib/session";
import { createPortalUrl } from "@/lib/stripe";

function baseUrl(): string {
  return (process.env.PORTAL_BASE_URL ?? "").replace(/\/$/, "");
}

// Startet den Stripe-Checkout. Nur SuperAdmin, nur wenn Billing konfiguriert
// ist (sonst bleibt die Seite beim „wird eingerichtet"-Hinweis). Tarifwahl,
// Einheitenzählung und Session-Aufbau liegen in lib/billing-checkout.ts —
// gemeinsam mit der Sperrseite /abo.
export async function startCheckout(formData: FormData) {
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
  const ergebnis = await starteCheckout(
    org,
    parseTarif(formData.get("tarif")),
    `${base}/verwaltung/abrechnung/danke`,
    `${base}/verwaltung/abrechnung?abbruch=1`,
  );
  if ("fehler" in ergebnis) redirect(`/verwaltung/abrechnung?fehler=${ergebnis.fehler}`);
  redirect(ergebnis.url);
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
