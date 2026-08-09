import { redirect } from "next/navigation";
import { PendingButton } from "@/components/pending-button";
import { Alert, Card, PageTitle, buttonClass, buttonSecondaryClass } from "@/components/ui";
import { Badge } from "@/components/data-display";
import {
  PLANS,
  STELLPLATZ_CENTS,
  aktiverPlan,
  checkoutJeEinheitCents,
  isBillingEnabled,
  istTestphaseAbgelaufen,
  planLabel,
  subscriptionStatusLabel,
  type Plan,
} from "@/lib/billing";
import { MAX_EINHEITEN } from "@/app/preise/preise-daten";
import { zaehleWegMengen } from "@/lib/billing-mengen";
import { isWegSaas } from "@/lib/app-mode";
import { formatDate } from "@/lib/labels";
import { getOrganization, requireVerwalter } from "@/lib/session";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { openBillingPortal, startCheckout, wechsleTarif } from "./actions";

export const dynamic = "force-dynamic";

const euro = (cents: number) =>
  (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });

// Preiszeile einer Tarifkarte: pauschale Tarife je Monat, die
// wegportal24-Tarife je Einheit und Monat (Staffel siehe Preisseite).
function preisZeile(plan: Plan): string {
  if (plan.perUnitCents != null) return `${euro(plan.perUnitCents)} je Einheit / Monat`;
  if (plan.monthlyPriceCents === 0) return "kostenlos";
  if (plan.monthlyPriceCents == null) return "Preis folgt";
  return `${euro(plan.monthlyPriceCents)} / Monat`;
}

const FEHLER_TEXTE: Record<string, string> = {
  kein_kunde: "Noch kein Abo vorhanden – bitte zuerst einen Tarif buchen.",
  nicht_konfiguriert:
    "Die Online-Buchung ist noch nicht fertig eingerichtet. Bitte versuchen " +
    "Sie es später erneut – Ihr Portal-Zugang läuft davon unabhängig weiter.",
  zahlung:
    "Die Verbindung zur Zahlungsabwicklung ist fehlgeschlagen – es wurde " +
    "nichts gebucht. Bitte versuchen Sie es erneut; bleibt der Fehler, " +
    "wenden Sie sich an uns.",
  keine_einheiten:
    "Es sind noch keine Einheiten angelegt – der Preis rechnet je Einheit. " +
    "Bitte legen Sie zuerst Ihr WEG-Objekt mit seinen Einheiten an.",
  zu_viele_einheiten:
    `Ihre Gemeinschaft hat mehr als ${MAX_EINHEITEN} Einheiten – dafür gibt es keinen ` +
    "Self-Service-Tarif. Bitte wenden Sie sich an uns, wir melden uns mit " +
    "einem Angebot.",
  checkout_fehlgeschlagen:
    "Die Weiterleitung zur Zahlung ist fehlgeschlagen. Bitte versuchen Sie es " +
    "erneut – bleibt der Fehler, prüfen wir die Konfiguration (die Ursache " +
    "steht in unseren Logs).",
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ erfolg?: string; abbruch?: string; fehler?: string }>;
}) {
  const verwalter = await requireVerwalter();
  if (!verwalter.isSuperAdmin) redirect("/verwaltung");

  const org = await getOrganization();
  if (!org) redirect("/verwaltung");

  const sp = await searchParams;
  const billingReady = isBillingEnabled();
  const weg = isWegSaas();
  // Der Tarif, der GERADE gilt — in der Testphase ist das der volle Umfang.
  // In `org.plan` steht dagegen, worauf die Gemeinschaft nach der Testphase
  // zurückfällt, solange nichts gebucht wurde.
  const genutzt = aktiverPlan(org);
  // „In der Testphase" heißt: sie läuft NOCH — abgelaufen zählt nicht mehr,
  // sonst behauptete die Seite den vollen Umfang, den aktiverPlan längst
  // entzogen hat.
  const inTestphase = org.subscriptionStatus === "trialing" && !istTestphaseAbgelaufen(org);
  // Die generische Testphase heißt intern "pro"; auf wegportal24 entspricht
  // der volle Umfang dem Verwalter-Plus-Tarif — die Karten unten kennen dort
  // kein "pro".
  const hervorgehoben = weg && inTestphase ? "plus" : genutzt;
  const hatAktivesAbo = org.subscriptionStatus === "active" && Boolean(org.stripeSubscriptionId);

  // Die wegportal24-Tarife rechnen je Einheit — die Zahlen gehören auf die
  // Seite, damit niemand raten muss, was der Checkout gleich berechnet.
  // Stellplätze sind eine eigene Position (1 € je Stellplatz, ohne Staffel).
  const { einheiten, stellplaetze } = weg
    ? await zaehleWegMengen(org.id)
    : { einheiten: 0, stellplaetze: 0 };

  const sichtbarePlaene = weg
    ? [PLANS.basic, PLANS.plus]
    : [PLANS.free, PLANS.pro];

  return (
    <>
      <PageTitle
        back={{ href: "/verwaltung/einstellungen", label: "Einstellungen" }}
      >
        Abrechnung
      </PageTitle>

      <Card>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-400">Aktueller Tarif</dt>
            {/* Auf wegportal24 heißt der volle Umfang der Testphase nach außen
                „Verwalter-Plus" — das interne „Pro" ist dort kein Tarifname. */}
            <dd className="text-lg font-semibold text-gray-900">{planLabel(hervorgehoben)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-400">Status</dt>
            <dd className="text-lg font-semibold text-gray-900">
              {subscriptionStatusLabel(org.subscriptionStatus)}
            </dd>
          </div>
          {org.trialEndsAt ? (
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-400">Testphase bis</dt>
              <dd className="text-gray-800">{formatDate(org.trialEndsAt)}</dd>
            </div>
          ) : null}
          {weg ? (
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-400">
                Einheiten (Abrechnungsgröße)
              </dt>
              <dd className="text-gray-800">{einheiten}</dd>
            </div>
          ) : null}
          {weg && stellplaetze > 0 ? (
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-400">
                Stellplätze &amp; Garagen
              </dt>
              <dd className="text-gray-800">
                {stellplaetze} · je {euro(STELLPLATZ_CENTS)} / Monat
              </dd>
            </div>
          ) : null}
          {/* Der Gesamtbetrag, den die Preisseite verspricht („58 €"), gehört
              auch HIER hin — nach der Buchung sah man sonst nur Mengen, nie
              die Summe. Dieselbe Rechnung wie im Checkout: Staffelpreis je
              Einheit × Einheiten + 1 € je Stellplatz. */}
          {weg &&
          (hervorgehoben === "basic" || hervorgehoben === "plus") &&
          einheiten >= 1 &&
          einheiten <= MAX_EINHEITEN ? (
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-400">
                {hatAktivesAbo ? "Monatlicher Gesamtbetrag" : "Gesamtbetrag bei Buchung"}
              </dt>
              <dd className="text-gray-800">
                {euro(
                  checkoutJeEinheitCents(hervorgehoben, einheiten) * einheiten +
                    stellplaetze * STELLPLATZ_CENTS,
                )}{" "}
                / Monat
              </dd>
            </div>
          ) : null}
        </dl>

        {sp.erfolg ? (
          <Alert variant="success" className="mt-4">
            Vielen Dank! Ihr Abo wird nun aktiviert – das kann einen Moment dauern.
          </Alert>
        ) : null}
        {sp.abbruch ? (
          <p className="mt-4 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600">
            Vorgang abgebrochen – es wurde nichts berechnet.
          </p>
        ) : null}
        {sp.fehler ? (
          <Alert variant="error" className="mt-4">
            {FEHLER_TEXTE[sp.fehler] ?? "Die Zahlungsabwicklung ist derzeit nicht verfügbar."}
          </Alert>
        ) : null}

        {billingReady ? (
          <div className="mt-6 flex flex-wrap gap-2">
            {/* Die Buchungs-Knöpfe der wegportal24-Tarife sitzen unten in den
                Tarifkarten — direkt bei der Erklärung dessen, was man bucht.
                Hier oben bleibt nur, was das laufende Abo betrifft. */}
            {!hatAktivesAbo && !weg && genutzt !== "pro" ? (
              <form action={startCheckout}>
                <input type="hidden" name="tarif" value="pro" />
                <PendingButton className={buttonClass}>Auf Pro upgraden</PendingButton>
              </form>
            ) : null}
            {/* Tarifwechsel im laufenden Abo — kein neuer Checkout, der
                bestehende Abo-Posten wird umgestellt und anteilig verrechnet. */}
            {hatAktivesAbo && weg && (org.plan === "basic" || org.plan === "plus") ? (
              <form action={wechsleTarif}>
                <input type="hidden" name="tarif" value={org.plan === "basic" ? "plus" : "basic"} />
                <ConfirmActionButton
                  className={buttonSecondaryClass}
                  confirmLabel={
                    org.plan === "basic"
                      ? "Zu Verwalter-Plus wechseln?"
                      : "Zu Basic wechseln?"
                  }
                >
                  {org.plan === "basic" ? "Zu Verwalter-Plus wechseln" : "Zu Basic wechseln"}
                </ConfirmActionButton>
              </form>
            ) : null}
            {org.stripeCustomerId ? (
              <form action={openBillingPortal}>
                <PendingButton className={buttonSecondaryClass}>Abo verwalten</PendingButton>
              </form>
            ) : null}
          </div>
        ) : (
          <div className="mt-6 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
            {inTestphase ? (
              <>
                <strong>In der Testphase steht Ihnen der volle Funktionsumfang
                offen.</strong>{" "}
                Es entsteht daraus keine Zahlungspflicht — die Testphase geht nicht
                selbsttätig in einen kostenpflichtigen Tarif über.{" "}
              </>
            ) : null}
            Die Online-Buchung und Zahlungsabwicklung wird derzeit eingerichtet. Sie nutzen das
            Portal bis dahin uneingeschränkt. Bei Fragen zur Abrechnung wenden Sie sich an uns.
          </div>
        )}
      </Card>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {sichtbarePlaene.map((plan) => (
          <div
            key={plan.id}
            className={`rounded-2xl border p-5 ${
              hervorgehoben === plan.id
                ? "border-brand-orange/50 bg-brand-orange-light"
                : "border-gray-200 bg-white"
            }`}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">{plan.name}</h2>
              {hervorgehoben === plan.id ? (
                <Badge tone="onAccent">{inTestphase ? "in der Testphase" : "aktuell"}</Badge>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-gray-600">{plan.description}</p>
            <p className="mt-3 text-sm font-medium text-gray-700">{preisZeile(plan)}</p>
            {plan.perUnitCents != null ? (
              <p className="mt-1 text-xs text-gray-500">
                Mengenrabatt ab 5 Einheiten — Details auf der Preisseite.
              </p>
            ) : null}
            {/* Der Buchen-Knopf gehört zur Erklärung des Tarifs. Mit aktivem
                Abo verschwindet er — ein zweites Abo daneben wäre eine
                Doppelbuchung; dafür gibt es oben den Tarifwechsel-Knopf. */}
            {billingReady &&
            !hatAktivesAbo &&
            (plan.id === "basic" || plan.id === "plus") ? (
              <form action={startCheckout} className="mt-4">
                <input type="hidden" name="tarif" value={plan.id} />
                <PendingButton className={buttonClass}>{plan.name} buchen</PendingButton>
              </form>
            ) : null}
          </div>
        ))}
      </div>
    </>
  );
}
