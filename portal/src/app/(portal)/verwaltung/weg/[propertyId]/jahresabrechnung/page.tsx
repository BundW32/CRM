import Link from "next/link";
import { Alert, Card, EmptyState, Field, PageTitle, buttonClass, buttonSecondaryClass, inputClass } from "@/components/ui";
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
  searchParams: Promise<{ geloescht?: string }>;
}) {
  const { propertyId } = await params;
  const { property } = await requireWegProperty(propertyId);
  const sp = await searchParams;

  const statements = await db.annualStatement.findMany({
    where: { propertyId: property.id },
    orderBy: { year: "desc" },
  });

  const lastYear = new Date().getFullYear() - 1;
  const suggestedYear = statements.some((s) => s.year === lastYear) ? lastYear + 1 : lastYear;

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
            <button type="submit" className={buttonClass}>
              Abrechnung anlegen
            </button>
          </form>
        </Card>

        <Card title="Abrechnungen">
          {statements.length === 0 ? (
            <EmptyState>Noch keine Jahresabrechnung vorhanden.</EmptyState>
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
