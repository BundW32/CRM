import Link from "next/link";
import {
  Alert,
  Card,
  EmptyState,
  Field,
  PageTitle,
  buttonClass,
  buttonSecondaryClass,
  inputClass,
} from "@/components/ui";
import { db } from "@/lib/db";
import { formatDateOnly } from "@/lib/labels";
import { formatCents } from "@/lib/money";
import { requireWegProperty } from "@/lib/weg/scope";
import { createPlan } from "./actions";

export const dynamic = "force-dynamic";

export default async function WirtschaftsplanListPage({
  params,
  searchParams,
}: {
  params: Promise<{ propertyId: string }>;
  searchParams: Promise<{ fehler?: string; geloescht?: string }>;
}) {
  const { propertyId } = await params;
  const { property } = await requireWegProperty(propertyId);
  const sp = await searchParams;

  const plans = await db.economicPlan.findMany({
    where: { propertyId: property.id },
    orderBy: { year: "desc" },
    include: { items: true, _count: { select: { duePostings: true } } },
  });

  const currentYear = new Date().getFullYear();
  const suggestedYear = plans.some((p) => p.year === currentYear) ? currentYear + 1 : currentYear;

  return (
    <>
      <PageTitle
        action={
          <div className="flex gap-2">
            <Link href={`/verwaltung/weg/${property.id}/hausgeld`} className={buttonSecondaryClass}>
              Hausgeld & offene Posten
            </Link>
            <Link href="/verwaltung/weg" className={buttonSecondaryClass}>
              ← WEG-Finanzen
            </Link>
          </div>
        }
      >
        Wirtschaftsplan · {property.name}
      </PageTitle>

      {sp.geloescht ? (
        <Alert variant="success" className="mb-4">
          Entwurf gelöscht.
        </Alert>
      ) : null}
      {sp.fehler === "kostenarten" ? (
        <Alert variant="error" className="mb-4">
          Es sind noch keine Kostenarten angelegt — bitte zuerst in den{" "}
          <Link href={`/verwaltung/weg/${property.id}/stammdaten`} className="underline">
            Stammdaten
          </Link>{" "}
          den Kostenkatalog übernehmen.
        </Alert>
      ) : null}

      <div className="grid gap-4">
        <Card title="Neuen Wirtschaftsplan anlegen">
          <p className="mb-3 text-sm text-gray-600">
            Der Assistent befüllt die Planwerte mit den Istwerten des Vorjahres
            (Ausgaben je Kostenart) — anschließend anpassen, Hausgeld je Einheit
            prüfen und den Plan beschließen.
          </p>
          <form action={createPlan} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="propertyId" value={property.id} />
            <Field label="Wirtschaftsjahr (Beginn)">
              <input
                name="year"
                type="number"
                min={2000}
                max={2100}
                defaultValue={suggestedYear}
                className={`${inputClass} w-28`}
                required
              />
            </Field>
            <button type="submit" className={buttonClass}>
              Plan anlegen
            </button>
          </form>
        </Card>

        <Card title="Wirtschaftspläne">
          {plans.length === 0 ? (
            <EmptyState>Noch kein Wirtschaftsplan vorhanden.</EmptyState>
          ) : (
            <div className="grid gap-3">
              {plans.map((p) => {
                const total = p.items.reduce((sum, i) => sum + i.amountCents, 0);
                return (
                  <Link
                    key={p.id}
                    href={`/verwaltung/weg/${property.id}/wirtschaftsplan/${p.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 p-4 transition hover:shadow-md"
                  >
                    <div>
                      <span className="font-semibold text-gray-900">
                        Wirtschaftsjahr {p.year}
                      </span>
                      <span
                        className={`ml-3 rounded-full px-2 py-0.5 text-xs font-medium ${
                          p.status === "BESCHLOSSEN"
                            ? "bg-green-100 text-green-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {p.status === "BESCHLOSSEN" ? "beschlossen" : "Entwurf"}
                      </span>
                      {p.resolvedAt ? (
                        <span className="ml-2 text-xs text-gray-400">
                          am {formatDateOnly(p.resolvedAt)}
                          {p._count.duePostings > 0 ? ` · ${p._count.duePostings} Sollstellungen` : ""}
                        </span>
                      ) : null}
                    </div>
                    <span className="text-sm font-medium text-gray-700">{formatCents(total)} / Jahr</span>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
