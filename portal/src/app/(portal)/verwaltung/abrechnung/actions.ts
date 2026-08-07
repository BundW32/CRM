"use server";

import { redirect } from "next/navigation";
import { MAX_EINHEITEN } from "@/app/preise/preise-daten";
import { checkoutJeEinheitCents, isBillingEnabled } from "@/lib/billing";
import { parseTarif, starteCheckout } from "@/lib/billing-checkout";
import { zaehleWegMengen } from "@/lib/billing-mengen";
import { db } from "@/lib/db";
import { getOrganization, requireVerwalter } from "@/lib/session";
import {
  createPortalUrl,
  istStellplatzPosten,
  stripeOrNull,
  stripePriceBasic,
  stripePricePlus,
} from "@/lib/stripe";
import { portalUrlFromRequest } from "@/lib/url-server";

// Startet den Stripe-Checkout. Nur SuperAdmin, nur wenn Billing konfiguriert
// ist (sonst bleibt die Seite beim „wird eingerichtet"-Hinweis). Tarifwahl,
// Einheitenzählung, Konfigurations-Logging und Session-Aufbau liegen in
// lib/billing-checkout.ts — gemeinsam mit der Sperrseite /abo.
export async function startCheckout(formData: FormData) {
  const actor = await requireVerwalter();
  if (!actor.isSuperAdmin) redirect("/verwaltung");
  const org = await getOrganization();
  if (!org) redirect("/verwaltung");

  if (!isBillingEnabled()) {
    redirect("/verwaltung/abrechnung?fehler=nicht_konfiguriert");
  }

  // Rücksprung-Adressen aus dem AKTUELLEN Host — so stimmt die Domain auf
  // beiden Türen, ohne dass PORTAL_BASE_URL je Deployment gepflegt sein muss
  // (Fallback bleibt PORTAL_BASE_URL). Nach dem Bezahlen auf die Danke-Seite —
  // nicht zurück in die nüchterne Abrechnungs-Übersicht.
  const ergebnis = await starteCheckout(
    org,
    parseTarif(formData.get("tarif")),
    await portalUrlFromRequest("/verwaltung/abrechnung/danke"),
    await portalUrlFromRequest("/verwaltung/abrechnung?abbruch=1"),
  );
  if ("fehler" in ergebnis) redirect(`/verwaltung/abrechnung?fehler=${ergebnis.fehler}`);
  redirect(ergebnis.url);
}

// Wechselt ein LAUFENDES Abo zwischen Basic und Verwalter-Plus — ohne neuen
// Checkout: Der bestehende Abo-Posten bekommt den neuen Preis (Env-Preis-Id,
// sonst inline aus preise-daten), die Differenz wird anteilig verrechnet.
export async function wechsleTarif(formData: FormData) {
  const actor = await requireVerwalter();
  if (!actor.isSuperAdmin) redirect("/verwaltung");
  const org = await getOrganization();
  if (!org) redirect("/verwaltung");

  const zielRaw = String(formData.get("tarif") ?? "");
  if (zielRaw !== "basic" && zielRaw !== "plus") redirect("/verwaltung/abrechnung");
  const ziel = zielRaw;
  if (org.plan === ziel) redirect("/verwaltung/abrechnung");

  const stripe = stripeOrNull();
  if (!isBillingEnabled() || !stripe || !org.stripeSubscriptionId) {
    redirect("/verwaltung/abrechnung?fehler=kein_kunde");
  }

  // Nur die Wohn-/Gewerbeeinheiten — Stellplätze haben ihren eigenen flachen
  // Abo-Posten, der beim Tarifwechsel unangetastet bleibt.
  const { einheiten: quantity } = await zaehleWegMengen(org.id);
  if (quantity < 1) redirect("/verwaltung/abrechnung?fehler=keine_einheiten");
  if (quantity > MAX_EINHEITEN) redirect("/verwaltung/abrechnung?fehler=zu_viele_einheiten");

  const preisId = ziel === "basic" ? stripePriceBasic() : stripePricePlus();
  let ok = false;
  try {
    // Produkt-Expansion, um den Tarif-Posten vom Stellplatz-Posten zu
    // unterscheiden — items[0] wäre bei einem Abo mit Stellplätzen mehrdeutig.
    const sub = await stripe.subscriptions.retrieve(org.stripeSubscriptionId, {
      expand: ["items.data.price.product"],
    });
    const item = sub.items.data.find((i) => !istStellplatzPosten(i));
    if (item) {
      await stripe.subscriptions.update(sub.id, {
        items: [
          preisId
            ? { id: item.id, price: preisId, quantity }
            : {
                id: item.id,
                quantity,
                price_data: {
                  currency: "eur",
                  // Frisches Produkt mit dem neuen Tarifnamen — das alte hieße
                  // auf jeder künftigen Rechnung weiter „Basic".
                  product: (
                    await stripe.products.create({
                      name: ziel === "basic" ? "wegportal24 Basic" : "wegportal24 Verwalter-Plus",
                    })
                  ).id,
                  recurring: { interval: "month" },
                  unit_amount: checkoutJeEinheitCents(ziel, quantity),
                },
              },
        ],
        // Webhook und Cron-Abgleich lesen den Tarif notfalls aus den Metadaten,
        // wenn die Preis-Id (inline erzeugt) ihn nicht verrät.
        metadata: { tarif: ziel },
        proration_behavior: "create_prorations",
      });
      ok = true;
    }
  } catch (err) {
    console.error("Stripe-Tarifwechsel fehlgeschlagen", err);
  }
  if (!ok) redirect("/verwaltung/abrechnung?fehler=checkout_fehlgeschlagen");

  // Sofort speichern — der Webhook (subscription.updated) bestätigt es nur noch.
  await db.organization.update({ where: { id: org.id }, data: { plan: ziel } });
  redirect("/verwaltung/abrechnung?flash=tarif-gewechselt");
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

  const url = await createPortalUrl(org, await portalUrlFromRequest("/verwaltung/abrechnung"));
  if (!url) redirect("/verwaltung/abrechnung?fehler=kein_kunde");
  redirect(url);
}
