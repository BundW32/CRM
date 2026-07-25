import Link from "next/link";
import { Alert, Card, PageTitle, buttonSecondaryClass, inputClass } from "@/components/ui";
import { propertyWhereForVerwalter } from "@/lib/access";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";
import { updateBoardMember, updateVotingPrinciple } from "./actions";

export const dynamic = "force-dynamic";

export default async function EigentuemerPage({
  searchParams,
}: {
  searchParams: Promise<{ objekt?: string; fehler?: string }>;
}) {
  const verwalter = await requireVerwalter();
  const { objekt, fehler } = await searchParams;

  // Nur WEG-Objekte im eigenen Zuständigkeitsbereich.
  const properties = await db.property.findMany({
    where: { ...(await propertyWhereForVerwalter(verwalter)), managementType: "WEG" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, votingPrinciple: true },
  });

  const selected = properties.find((p) => p.id === objekt) ?? properties[0] ?? null;

  const owners = selected
    ? await db.ownership.findMany({
        where: { propertyId: selected.id },
        include: { user: { select: { name: true, email: true } } },
        orderBy: { user: { name: "asc" } },
      })
    : [];
  const totalMea = owners.reduce((s, o) => s + (o.mea ?? 0), 0);

  // Läuft am gewählten Objekt eine Abstimmung? Dann Stimmgewichte/-prinzip sperren.
  const openVotes = selected
    ? await db.resolution.count({ where: { propertyId: selected.id, status: "OFFEN" } })
    : 0;
  const locked = openVotes > 0;

  return (
    <>
      <PageTitle
      >
        Eigentümer &amp; Miteigentumsanteile
      </PageTitle>

      {properties.length === 0 ? (
        <Card>
          <p className="text-sm text-gray-500">
            Keine WEG-Objekte vorhanden. Legen Sie ein Objekt mit Verwaltungsart WEG an.
          </p>
        </Card>
      ) : (
        <>
          {/* Objektauswahl */}
          <div className="mb-4 flex flex-wrap gap-2">
            {properties.map((p) => (
              <Link
                key={p.id}
                href={`/verwaltung/eigentuemer?objekt=${p.id}`}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  selected?.id === p.id
                    ? "border-brand-orange bg-brand-orange text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                }`}
              >
                {p.name}
              </Link>
            ))}
          </div>

          {selected ? (
            <Card title={selected.name}>
              {locked ? (
                <Alert variant="warning" className="mb-4">
                  An diesem Objekt läuft aktuell eine Abstimmung. Stimmgewichte und
                  Stimmprinzip sind gesperrt, damit abgegebene Stimmen nicht rückwirkend
                  umgewichtet werden.{" "}
                  <Link href="/beschluesse" className="underline">
                    Zu den Abstimmungen
                  </Link>
                </Alert>
              ) : null}
              {fehler === "offen" ? (
                <Alert variant="error" className="mb-4">
                  Änderung nicht möglich – am Objekt läuft eine Abstimmung.
                </Alert>
              ) : null}
              {/* Stimmprinzip */}
              <form action={updateVotingPrinciple} className="mb-4 flex flex-wrap items-end gap-2">
                <input type="hidden" name="propertyId" value={selected.id} />
                <label className="text-sm text-gray-600">
                  Stimmprinzip
                  <select
                    name="votingPrinciple"
                    defaultValue={selected.votingPrinciple}
                    disabled={locked}
                    className={`${inputClass} mt-1 w-auto`}
                  >
                    <option value="KOPF">Kopfprinzip (eine Stimme je Eigentümer)</option>
                    <option value="MEA">Wertprinzip (nach Miteigentumsanteilen)</option>
                    <option value="OBJEKT">Objektprinzip (eine Stimme je Einheit)</option>
                  </select>
                </label>
                <button type="submit" className={buttonSecondaryClass} disabled={locked}>
                  Übernehmen
                </button>
                <a
                  href={`/verwaltung/eigentuemer/export?objekt=${selected.id}`}
                  className={`${buttonSecondaryClass} ml-auto`}
                >
                  CSV-Export
                </a>
              </form>

              {owners.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Diesem Objekt sind noch keine Eigentümer zugeordnet (im Bereich Nutzer).
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                        <th className="px-3 py-2">Eigentümer</th>
                        <th className="px-3 py-2">MEA</th>
                        <th className="px-3 py-2">Stimmanteil</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {owners.map((o) => {
                        const share =
                          totalMea > 0 && o.mea != null
                            ? `${((o.mea / totalMea) * 100).toLocaleString("de-DE", {
                                maximumFractionDigits: 2,
                              })} %`
                            : "—";
                        return (
                          <tr key={o.id}>
                            <td className="px-3 py-2 text-gray-800">
                              <span className="flex flex-wrap items-center gap-2">
                                {o.user.name}
                                {o.isBoardMember ? (
                                  <span className="rounded-full bg-brand-green/10 px-2 py-0.5 text-xs font-medium text-brand-green">
                                    Beirat
                                  </span>
                                ) : null}
                              </span>
                              {o.user.email ? (
                                <span className="block text-xs text-gray-400">{o.user.email}</span>
                              ) : null}
                              <form action={updateBoardMember} className="mt-1">
                                <input type="hidden" name="ownershipId" value={o.id} />
                                <input type="hidden" name="isBoardMember" value={o.isBoardMember ? "0" : "1"} />
                                <button type="submit" className="text-xs text-gray-400 hover:text-brand-green hover:underline">
                                  {o.isBoardMember ? "aus Beirat entfernen" : "zum Beirat hinzufügen"}
                                </button>
                              </form>
                            </td>
                            <td className="px-3 py-2" colSpan={2}>
                              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700">
                                <span>
                                  <span className="text-xs text-gray-400">MEA </span>
                                  {o.mea ?? "—"}
                                </span>
                                <span>
                                  <span className="text-xs text-gray-400">Einheiten </span>
                                  {o.voteUnits ?? "—"}
                                </span>
                                <span className="text-xs text-gray-400">{share}</span>
                              </div>
                            </td>
                            <td />
                          </tr>
                        );
                      })}
                      <tr className="border-t border-gray-200">
                        <td className="px-3 py-2 font-medium text-gray-700">Summe</td>
                        <td className="px-3 py-2 font-medium text-gray-700" colSpan={2}>
                          {totalMea} MEA
                        </td>
                        <td />
                      </tr>
                    </tbody>
                  </table>
                  <p className="mt-3 text-xs text-gray-400">
                    MEA und Einheiten je Eigentümer ergeben sich automatisch aus den
                    Miteigentumsanteilen der Einheiten und der Einheiten-Eigentümerschaft. Gepflegt
                    werden sie unter{" "}
                    <Link
                      href={`/verwaltung/weg/${selected.id}/stammdaten`}
                      className="text-brand-green hover:underline"
                    >
                      WEG-Finanzen → Stammdaten
                    </Link>{" "}
                    (Einheiten-MEA und Eigentümer je Einheit) — so vermeiden Sie doppelte Eingaben.
                    Stimmgewicht je Prinzip: Kopfprinzip = eine Stimme je Eigentümer · Wertprinzip =
                    nach MEA · Objektprinzip = nach Einheiten.
                  </p>
                </div>
              )}
            </Card>
          ) : null}
        </>
      )}
    </>
  );
}
