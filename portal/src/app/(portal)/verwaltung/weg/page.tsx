import Link from "next/link";
import { Card, EmptyState, PageTitle } from "@/components/ui";
import { isSelfManaged, propertyWhereForVerwalter } from "@/lib/access";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { getOrganization, requireVerwalter } from "@/lib/session";
import { WegArbeitsbereich } from "./Arbeitsbereich";

export const dynamic = "force-dynamic";

// WEG-Finanzbereich: Einstieg über die Objektauswahl (nur WEG-Objekte im Scope).
export default async function WegOverviewPage() {
  const verwalter = await requireVerwalter();
  const selfManaged = isSelfManaged(await getOrganization());
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

  // Selbstverwaltete WEG mit genau einem Objekt: Statt einer Auswahlliste mit
  // einem einzigen Eintrag ist die Seite direkt der Finanz-Einstieg dieses
  // Objekts. Kein Weiterleiten – die Unterseiten springen über ihren
  // „WEG-Finanzen"-Rückweg hierher zurück und landen sonst im Kreis.
  const einzelnesObjekt = selfManaged && properties.length === 1;

  // Mehrere Objekte: Die Auswahl bleibt eine Auswahl, zeigt aber die Zahlen, nach
  // denen ohnehin gesucht wird. Der Arbeitsbereich steckt hinter dem Klick.
  const ids = einzelnesObjekt ? [] : properties.map((p) => p.id);
  const [accounts, sums] = await Promise.all([
    db.ledgerAccount.findMany({
      where: { propertyId: { in: ids }, active: true },
      select: { id: true, propertyId: true, kind: true, openingBalanceCents: true },
    }),
    db.booking.groupBy({
      by: ["accountId", "kind", "transferOut"],
      where: { propertyId: { in: ids } },
      _sum: { amountCents: true },
    }),
  ]);

  const saldoJeKonto = new Map(accounts.map((a) => [a.id, a.openingBalanceCents]));
  for (const s of sums) {
    const current = saldoJeKonto.get(s.accountId);
    if (current === undefined) continue;
    const amount = s._sum.amountCents ?? 0;
    const delta =
      s.kind === "EINNAHME"
        ? amount
        : s.kind === "AUSGABE"
          ? -amount
          : s.transferOut
            ? -amount
            : amount;
    saldoJeKonto.set(s.accountId, current + delta);
  }
  const summeJeObjekt = (propertyId: string, kind: "GIRO" | "RUECKLAGE") =>
    accounts
      .filter((a) => a.propertyId === propertyId && a.kind === kind)
      .reduce((sum, a) => sum + (saldoJeKonto.get(a.id) ?? 0), 0);

  return (
    <>
      <PageTitle>{einzelnesObjekt ? `Finanzen · ${properties[0].name}` : "WEG-Finanzen"}</PageTitle>

      {properties.length === 0 ? (
        <Card>
          <EmptyState>
            {selfManaged ? (
              <>
                Hier entstehen die Finanzen Ihrer Gemeinschaft – sobald das Objekt angelegt
                ist. Die{" "}
                <Link href="/dashboard" className="underline">
                  Übersicht
                </Link>{" "}
                führt Sie Schritt für Schritt hindurch.
              </>
            ) : (
              <>
                Kein WEG-Objekt vorhanden. Legen Sie unter &bdquo;Objekte&ldquo; ein Objekt
                mit Verwaltungsart &bdquo;WEG&ldquo; an, um Finanzen zu verwalten.
              </>
            )}
          </EmptyState>
        </Card>
      ) : einzelnesObjekt ? (
        <WegArbeitsbereich property={properties[0]} selfManaged />
      ) : (
        <div className="grid gap-3">
          {properties.map((p) => (
            <Link
              key={p.id}
              href={`/verwaltung/weg/${p.id}`}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-5 transition hover:shadow-md"
            >
              <div className="min-w-0">
                <span className="font-semibold text-gray-900">{p.name}</span>
                <span className="block text-sm text-gray-500">
                  {p.street}, {p.zip} {p.city}
                </span>
                <span className="block text-xs text-gray-400">
                  {p._count.units} Einheit{p._count.units !== 1 ? "en" : ""}
                  {p.meaTotal == null ? " · MEA-Nenner fehlt" : ""}
                </span>
              </div>
              <div className="flex gap-6 text-right">
                <div>
                  <span className="block text-xs tracking-wide text-gray-400 uppercase">
                    Laufend
                  </span>
                  <span className="text-lg font-semibold text-gray-900">
                    {formatCents(summeJeObjekt(p.id, "GIRO"))}
                  </span>
                </div>
                <div>
                  <span className="block text-xs tracking-wide text-gray-400 uppercase">
                    Rücklage
                  </span>
                  <span className="text-lg font-semibold text-gray-900">
                    {formatCents(summeJeObjekt(p.id, "RUECKLAGE"))}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
