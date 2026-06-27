import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, PageTitle, buttonSecondaryClass } from "@/components/ui";
import { PLANS, planLabel, subscriptionStatusLabel } from "@/lib/billing";
import { formatDate } from "@/lib/labels";
import { getOrganization, requireVerwalter } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const verwalter = await requireVerwalter();
  if (!verwalter.isSuperAdmin) redirect("/verwaltung");

  const org = await getOrganization();
  if (!org) redirect("/verwaltung");

  return (
    <>
      <PageTitle
        action={
          <Link href="/verwaltung" className={buttonSecondaryClass}>
            ← Verwaltung
          </Link>
        }
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

        <div className="mt-6 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
          Die Online-Buchung und Zahlungsabwicklung wird derzeit eingerichtet. Sie nutzen das
          Portal bis dahin uneingeschränkt. Bei Fragen zur Abrechnung wenden Sie sich an uns.
        </div>
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
