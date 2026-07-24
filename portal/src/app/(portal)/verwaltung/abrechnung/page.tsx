import { redirect } from "next/navigation";
import { Alert, Card, PageTitle, buttonClass, buttonSecondaryClass } from "@/components/ui";
import { PLANS, isBillingEnabled, planLabel, subscriptionStatusLabel } from "@/lib/billing";
import { formatDate } from "@/lib/labels";
import { getOrganization, requireVerwalter } from "@/lib/session";
import { openBillingPortal, startCheckout } from "./actions";

export const dynamic = "force-dynamic";

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

  return (
    <>
      <PageTitle
      >
        Abrechnung
      </PageTitle>

      <Card>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-400">Aktueller Tarif</dt>
            <dd className="text-lg font-semibold text-gray-900">{planLabel(org.plan)}</dd>
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
            {sp.fehler === "kein_kunde"
              ? "Noch kein Abo vorhanden – bitte zuerst upgraden."
              : "Die Zahlungsabwicklung ist derzeit nicht verfügbar."}
          </Alert>
        ) : null}

        {billingReady ? (
          <div className="mt-6 flex flex-wrap gap-2">
            {org.plan !== "pro" ? (
              <form action={startCheckout}>
                <button type="submit" className={buttonClass}>Auf Pro upgraden</button>
              </form>
            ) : null}
            {org.stripeCustomerId ? (
              <form action={openBillingPortal}>
                <button type="submit" className={buttonSecondaryClass}>Abo verwalten</button>
              </form>
            ) : null}
          </div>
        ) : (
          <div className="mt-6 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
            Die Online-Buchung und Zahlungsabwicklung wird derzeit eingerichtet. Sie nutzen das
            Portal bis dahin uneingeschränkt. Bei Fragen zur Abrechnung wenden Sie sich an uns.
          </div>
        )}
      </Card>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {Object.values(PLANS).map((plan) => (
          <div
            key={plan.id}
            className={`rounded-2xl border p-5 ${
              org.plan === plan.id
                ? "border-brand-orange/50 bg-brand-orange-light"
                : "border-gray-200 bg-white"
            }`}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">{plan.name}</h2>
              {org.plan === plan.id ? (
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-brand-orange-dark">
                  aktuell
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-gray-600">{plan.description}</p>
            <p className="mt-3 text-sm font-medium text-gray-700">
              {plan.monthlyPriceCents === 0
                ? "kostenlos"
                : plan.monthlyPriceCents == null
                  ? "Preis folgt"
                  : `${(plan.monthlyPriceCents / 100).toLocaleString("de-DE", {
                      style: "currency",
                      currency: "EUR",
                    })} / Monat`}
            </p>
          </div>
        ))}
      </div>
    </>
  );
}
