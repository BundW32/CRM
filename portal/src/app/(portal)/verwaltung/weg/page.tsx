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
        back={{ href: "/verwaltung", label: "Verwaltung" }}
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
        <div className="grid gap-4 lg:grid-cols-2">
          {properties.map((p) => {
            // Themengruppen für eine übersichtliche Struktur statt einer langen
            // Button-Reihe: Stammdaten · Laufendes Jahr · Abrechnung · Pflichten.
            const groups: { label: string; items: { href: string; label: string }[] }[] = [
              {
                label: "Stammdaten & Konten",
                items: [{ href: `/verwaltung/weg/${p.id}/stammdaten`, label: "Stammdaten" }],
              },
              {
                label: "Laufendes Jahr",
                items: [
                  { href: `/verwaltung/weg/${p.id}/buchhaltung`, label: "Buchhaltung" },
                  { href: `/verwaltung/weg/${p.id}/hausgeld`, label: "Hausgeld & offene Posten" },
                  { href: `/verwaltung/weg/${p.id}/sonderumlagen`, label: "Sonderumlagen" },
                  { href: `/verwaltung/weg/${p.id}/lastschrift`, label: "SEPA-Lastschrift" },
                ],
              },
              {
                label: "Planung & Abrechnung",
                items: [
                  { href: `/verwaltung/weg/${p.id}/wirtschaftsplan`, label: "Wirtschaftsplan" },
                  { href: `/verwaltung/weg/${p.id}/jahresabrechnung`, label: "Jahresabrechnung" },
                  { href: `/verwaltung/weg/${p.id}/betriebskosten`, label: "Betriebskosten (Mieter)" },
                  { href: `/verwaltung/weg/${p.id}/co2`, label: "CO₂-Aufteilung" },
                ],
              },
              {
                label: "Pflichten & Erhaltung",
                items: [
                  { href: `/verwaltung/weg/${p.id}/pruefpflichten`, label: "Prüfpflichten" },
                  { href: `/verwaltung/weg/${p.id}/erhaltungsplanung`, label: "Erhaltungsplanung" },
                ],
              },
            ];
            return (
              <Card key={p.id} title={p.name}>
                <p className="text-sm text-gray-500">
                  {p.street}, {p.zip} {p.city}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {p._count.units} Einheit{p._count.units !== 1 ? "en" : ""} ·{" "}
                  {p.meaTotal ? `MEA-Nenner ${p.meaTotal}` : "MEA-Nenner fehlt"} ·{" "}
                  {p._count.ledgerAccounts} Konto{p._count.ledgerAccounts !== 1 ? "s" : ""}
                </p>
                <div className="mt-4 space-y-3">
                  {groups.map((g) => (
                    <div key={g.label}>
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                        {g.label}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {g.items.map((it) => (
                          <Link key={it.href} href={it.href} className={buttonSecondaryClass}>
                            {it.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
