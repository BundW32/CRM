import Link from "next/link";
import { PendingButton } from "@/components/pending-button";
import { Alert, Card, EmptyState, Field, PageTitle, buttonClass, buttonSecondaryClass, inputClass } from "@/components/ui";
import { FilterBar, type FilterConfig } from "@/components/filter-bar";
import { db } from "@/lib/db";
import { formatDateOnly } from "@/lib/labels";
import { requireWegProperty } from "@/lib/weg/scope";
import { createStatement } from "./actions";

export const dynamic = "force-dynamic";

export default async function JahresabrechnungListPage({
  params,
  searchParams,
}: {
  params: Promise<{ propertyId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { propertyId } = await params;
  const { property } = await requireWegProperty(propertyId);
  const sp = await searchParams;
  const jahr = /^\d{4}$/.test(sp.jahr ?? "") ? Number(sp.jahr) : undefined;

  const statements = await db.annualStatement.findMany({
    where: { propertyId: property.id, ...(jahr ? { year: jahr } : {}) },
    orderBy: { year: "desc" },
  });

  // Alle vorhandenen Jahrgänge für die Auswahl – unabhängig vom aktiven Filter.
  const allYears = await db.annualStatement.findMany({
    where: { propertyId: property.id },
    orderBy: { year: "desc" },
    select: { year: true },
  });

  const lastYear = new Date().getFullYear() - 1;
  // Bewusst gegen ALLE Jahrgänge geprüft, nicht gegen die gefilterte Liste –
  // sonst schlüge das Formular bei aktivem Filter ein falsches Jahr vor.
  const suggestedYear = allYears.some((s) => s.year === lastYear) ? lastYear + 1 : lastYear;

  const yearFilters: FilterConfig[] = [
    {
      key: "jahr",
      label: "Jahr",
      allLabel: "Alle Jahre",
      primary: true,
      options: allYears.map((s) => ({ value: String(s.year), label: String(s.year) })),
    },
  ];

  return (
    <>
      <PageTitle
        back={{ href: "/verwaltung/weg", label: "WEG-Finanzen" }}
        action={
          <div className="flex gap-2">
            <Link
              href={`/verwaltung/weg/${property.id}/wirtschaftsplan`}
              className={buttonSecondaryClass}
            >
              Wirtschaftsplan
            </Link>
          </div>
        }
      >
        Jahresabrechnung · {property.name}
      </PageTitle>

      {sp.geloescht ? (
        <Alert variant="success" className="mb-4">
          Entwurf gelöscht.
        </Alert>
      ) : null}

      <div className="grid gap-4">
        <Card title="Neue Jahresabrechnung anlegen">
          <p className="mb-3 text-sm text-gray-600">
            Die Abrechnung wird live aus der Buchhaltung gerechnet: Gesamtabrechnung mit
            Kontenprüfung, Einzelabrechnungen je Einheit nach Umlageschlüsseln,
            Abrechnungsspitze (§ 28 Abs. 2 WEG), §35a-Ausweis und Vermögensbericht.
          </p>
          <form action={createStatement} className="flex flex-wrap items-end gap-2">
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
            <PendingButton className={buttonClass}>Abrechnung anlegen</PendingButton>
          </form>
        </Card>

        <Card title="Abrechnungen">
          {allYears.length > 1 ? <FilterBar className="mb-3" filters={yearFilters} /> : null}

          {statements.length === 0 ? (
            <EmptyState>
              {jahr
                ? "Für dieses Jahr liegt keine Abrechnung vor."
                : "Noch keine Jahresabrechnung vorhanden."}
            </EmptyState>
          ) : (
            <div className="grid gap-3">
              {statements.map((s) => (
                <Link
                  key={s.id}
                  href={`/verwaltung/weg/${property.id}/jahresabrechnung/${s.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 p-4 transition hover:shadow-md"
                >
                  <span className="font-semibold text-gray-900">Wirtschaftsjahr {s.year}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      s.status === "FERTIG"
                        ? "bg-green-100 text-green-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {s.status === "FERTIG"
                      ? `fertig${s.finalizedAt ? ` (${formatDateOnly(s.finalizedAt)})` : ""}`
                      : "Entwurf"}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
