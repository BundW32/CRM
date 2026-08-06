"use server";

// Actions der Sperrseite. Bewusst eigene Rücksprung-Adressen: Die Aktionen der
// Abrechnungsseite kehren bei Fehlern nach /verwaltung/abrechnung zurück — die
// liegt hinter dem Abo-Gate und wäre für eine gesperrte Organisation gerade
// nicht erreichbar. Hier führt jeder Fehler zurück auf /abo.

import { redirect } from "next/navigation";
import { isBillingEnabled } from "@/lib/billing";
import { getOrganization, requireUser } from "@/lib/session";
import { createCheckoutUrl, createPortalUrl } from "@/lib/stripe";

function baseUrl(): string {
  return (process.env.PORTAL_BASE_URL ?? "").replace(/\/$/, "");
}

// Bucht das Pro-Abo aus der Sperre heraus. Nur der SuperAdmin der Organisation
// darf das — für alle anderen zeigt die Seite gar keinen Knopf, aber die
// Server-Prüfung bleibt maßgeblich (Knöpfe verstecken ist keine Berechtigung).
export async function startCheckoutAusSperre() {
  const actor = await requireUser();
  if (actor.role !== "VERWALTER" || !actor.isSuperAdmin) redirect("/abo");
  const org = await getOrganization();
  if (!org) redirect("/login");

  if (!isBillingEnabled()) redirect("/abo?fehler=nicht_konfiguriert");

  const base = baseUrl();
  const url = await createCheckoutUrl(
    org,
    // Nach dem Bezahlen zurück ins Portal: Der Webhook schaltet den Status um;
    // die Danke-Seite liegt hinter dem Gate und ist der falsche Landeplatz,
    // falls das Event ein paar Sekunden braucht.
    `${base}/abo?gebucht=1`,
    `${base}/abo`,
  );
  if (!url) redirect("/abo?fehler=nicht_konfiguriert");
  redirect(url);
}

// Öffnet das Stripe-Kundenportal aus der Sperre (Zahlungsmittel aktualisieren,
// Rechnungen, Reaktivierung).
export async function openPortalAusSperre() {
  const actor = await requireUser();
  if (actor.role !== "VERWALTER" || !actor.isSuperAdmin) redirect("/abo");
  const org = await getOrganization();
  if (!org) redirect("/login");

  if (!isBillingEnabled() || !org.stripeCustomerId) redirect("/abo?fehler=kein_kunde");

  const url = await createPortalUrl(org, `${baseUrl()}/abo`);
  if (!url) redirect("/abo?fehler=kein_kunde");
  redirect(url);
}
