"use server";

import { redirect } from "next/navigation";
import { MAX_EINHEITEN } from "@/app/preise/preise-daten";
import { isBillingEnabled, type PlanId } from "@/lib/billing";
import { db } from "@/lib/db";
import { getOrganization, requireVerwalter } from "@/lib/session";
import { stripeOrNull, stripePriceBasic, stripePricePlus, stripePricePro } from "@/lib/stripe";

function baseUrl(): string {
  return (process.env.PORTAL_BASE_URL ?? "").replace(/\/$/, "");
}

// Startet den Stripe-Checkout. Nur SuperAdmin, nur wenn Billing konfiguriert
// ist (sonst bleibt die Seite beim „wird eingerichtet"-Hinweis).
//
// Zwei Modelle:
// - `basic` / `plus` (wegportal24): Preis JE EINHEIT — die Menge ist die
//   Einheitenzahl der WEG-Objekte der Organisation, die Mengenstaffel liegt
//   als Volumen-Preisstufen am Stripe-Preis selbst.
// - `pro` (B&W-Variante): pauschal je Organisation, Menge 1.
export async function startCheckout(formData: FormData) {
  const actor = await requireVerwalter();
  if (!actor.isSuperAdmin) redirect("/verwaltung");
  const org = await getOrganization();
  if (!org) redirect("/verwaltung");

  const tarifRaw = String(formData.get("tarif") ?? "pro");
  const tarif: PlanId = tarifRaw === "basic" ? "basic" : tarifRaw === "plus" ? "plus" : "pro";

  const stripe = stripeOrNull();
  const price =
    tarif === "basic" ? stripePriceBasic() : tarif === "plus" ? stripePricePlus() : stripePricePro();
  if (!isBillingEnabled() || !stripe || !price) {
    // Welche Variable fehlt, gehört in die Logs — auf der Seite steht sonst
    // nur „nicht verfügbar", und die Fehlersuche beginnt beim Raten.
    console.error(
      `Checkout nicht konfiguriert: tarif=${tarif}, key=${Boolean(stripe)}, price=${Boolean(price)}`,
    );
    redirect("/verwaltung/abrechnung?fehler=nicht_konfiguriert");
  }
  // Ohne Basis-URL lehnt Stripe die success_url ab und die Session-Erstellung
  // wirft — der Klick bliebe ohne jede Rückmeldung stecken.
  if (!baseUrl()) {
    console.error("Checkout nicht konfiguriert: PORTAL_BASE_URL fehlt");
    redirect("/verwaltung/abrechnung?fehler=nicht_konfiguriert");
  }

  let quantity = 1;
  if (tarif === "basic" || tarif === "plus") {
    // Die Einheit ist die Abrechnungsgröße: Sie steht in der Teilungserklärung
    // und ändert sich nicht — gezählt wird über alle WEG-Objekte der
    // Organisation (selbstverwaltete WEGs haben in aller Regel genau eines).
    quantity = await db.unit.count({
      where: { property: { organizationId: org.id, managementType: "WEG" } },
    });
    if (quantity < 1) redirect("/verwaltung/abrechnung?fehler=keine_einheiten");
    // Oberhalb der Grenze ist Selbstverwaltung kein Self-Service-Fall mehr —
    // dieselbe Grenze wie auf der Preisseite.
    if (quantity > MAX_EINHEITEN) redirect("/verwaltung/abrechnung?fehler=zu_viele_einheiten");
  }

  const base = baseUrl();
  // Scheitert die Session-Erstellung (falsche Preis-ID, Test-Preis mit
  // Live-Schlüssel, Währungs-Konflikt …), soll der Klick eine verständliche
  // Meldung zeigen — nicht in einem unbehandelten Serverfehler enden. Der
  // eigentliche Grund steht in den Vercel-Logs und im Stripe-Dashboard.
  let checkoutUrl: string | null = null;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity }],
      client_reference_id: org.id,
      customer: org.stripeCustomerId ?? undefined,
      // Der Webhook liest den gebuchten Tarif aus den Metadaten — die Preis-Id
      // allein verrät ihn nicht, ohne sie erneut gegen die Env zu halten.
      metadata: { tarif },
      // Nach dem Bezahlen auf die Danke-Seite — nicht zurück in die nüchterne
      // Abrechnungs-Übersicht. Der Abbruch bleibt dort, wo man weitermacht.
      success_url: `${base}/verwaltung/abrechnung/danke`,
      cancel_url: `${base}/verwaltung/abrechnung?abbruch=1`,
    });
    checkoutUrl = session.url;
  } catch (err) {
    console.error(`Stripe-Checkout fehlgeschlagen (tarif=${tarif}, quantity=${quantity})`, err);
    redirect("/verwaltung/abrechnung?fehler=checkout_fehlgeschlagen");
  }
  if (!checkoutUrl) redirect("/verwaltung/abrechnung?fehler=checkout_fehlgeschlagen");
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

  const session = await stripe.billingPortal.sessions.create({
    customer: org.stripeCustomerId,
    return_url: `${baseUrl()}/verwaltung/abrechnung`,
  });
  redirect(session.url);
}
