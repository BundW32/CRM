import Link from "next/link";
import { Card, EmptyState, PageTitle, buttonSecondaryClass } from "@/components/ui";
import { propertyWhereForVerwalter } from "@/lib/access";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";

export const dynamic = "force-dynamic";

// WEG-Finanzbereich: Einstieg über die Objektauswahl (nur WEG-Objekte im Scope).
export default async function WegOverviewPage() {
  const verwalter = await requireVerwalter();
  const where = await propertyWhereForVerwalter(verwalter);
  const properties = await db.property.findMany({
    where: { ...where, managementType: "WEG" },
    select: {
      id: true,
      name: true,
      street: true,
      zip: true,
      city: true,
      meaTotal: true,
      _count: { select: { units: true, ledgerAccounts: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageTitle
        action={
          <Link href="/verwaltung" className={buttonSecondaryClass}>
            ← Verwaltung
          </Link>
        }
      >
        WEG-Finanzen
      </PageTitle>

      {properties.length === 0 ? (
        <Card>
          <EmptyState>
            Kein WEG-Objekt vorhanden. Legen Sie unter „Objekte“ ein Objekt mit
            Verwaltungsart „WEG“ an, um Finanzen zu verwalten.
          </EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {properties.map((p) => (
            <Card key={p.id} title={p.name}>
              <p className="text-sm text-gray-500">
                {p.street}, {p.zip} {p.city}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {p._count.units} Einheit{p._count.units !== 1 ? "en" : ""} ·{" "}
                {p.meaTotal ? `MEA-Nenner ${p.meaTotal}` : "MEA-Nenner fehlt"} ·{" "}
                {p._count.ledgerAccounts} Konto{p._count.ledgerAccounts !== 1 ? "s" : ""}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/verwaltung/weg/${p.id}/stammdaten`}
                  className={buttonSecondaryClass}
                >
                  Stammdaten
                </Link>
                <Link
                  href={`/verwaltung/weg/${p.id}/buchhaltung`}
                  className={buttonSecondaryClass}
                >
                  Buchhaltung
                </Link>
                <Link
                  href={`/verwaltung/weg/${p.id}/wirtschaftsplan`}
                  className={buttonSecondaryClass}
                >
                  Wirtschaftsplan
                </Link>
                <Link
                  href={`/verwaltung/weg/${p.id}/hausgeld`}
                  className={buttonSecondaryClass}
                >
                  Hausgeld
                </Link>
                <Link
                  href={`/verwaltung/weg/${p.id}/sonderumlagen`}
                  className={buttonSecondaryClass}
                >
                  Sonderumlagen
                </Link>
                <Link
                  href={`/verwaltung/weg/${p.id}/jahresabrechnung`}
                  className={buttonSecondaryClass}
                >
                  Jahresabrechnung
                </Link>
                <Link
                  href={`/verwaltung/weg/${p.id}/pruefpflichten`}
                  className={buttonSecondaryClass}
                >
                  Prüfpflichten
                </Link>
                <Link
                  href={`/verwaltung/weg/${p.id}/erhaltungsplanung`}
                  className={buttonSecondaryClass}
                >
                  Erhaltungsplanung
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
