import Link from "next/link";
import { EmptyState, PageTitle, buttonClass, buttonSecondaryClass, inputClass } from "@/components/ui";
import { propertyWhereForVerwalter } from "@/lib/access";
import { db } from "@/lib/db";
import { managementTypeLabels } from "@/lib/labels";
import { requireVerwalter } from "@/lib/session";
import { PropertyRow } from "./property-row";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string; eingerichtet?: string; q?: string; page?: string }>;
}) {
  const verwalter = await requireVerwalter();
  const { fehler, eingerichtet, q, page } = await searchParams;
  const propWhere = await propertyWhereForVerwalter(verwalter);

  const currentPage = Math.max(1, Number.parseInt(page ?? "1", 10) || 1);

  const combinedWhere = q
    ? {
        AND: [
          propWhere,
          {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { street: { contains: q, mode: "insensitive" as const } },
              { city: { contains: q, mode: "insensitive" as const } },
              { zip: { contains: q, mode: "insensitive" as const } },
            ],
          },
        ],
      }
    : propWhere;

  const [total, properties] = await Promise.all([
    db.property.count({ where: combinedWhere }),
    db.property.findMany({
      where: combinedWhere,
      orderBy: { name: "asc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        units: {
          include: { tenancies: { where: { active: true }, include: { user: true } } },
        },
        ownerships: { include: { user: true } },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function pageHref(p: number) {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return `/verwaltung/objekte${qs ? `?${qs}` : ""}`;
  }

  return (
    <>
      <PageTitle
        action={
          <span className="flex flex-wrap items-center gap-2">
            <Link href="/verwaltung" className={buttonSecondaryClass}>
              ← Verwaltung
            </Link>
            <a href="/verwaltung/objekte/neu" className={buttonClass}>
              + Objekt anlegen
            </a>
          </span>
        }
      >
        Objekte
      </PageTitle>

      {eingerichtet ? (
        <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Objekt wurde angelegt. Mieter können Sie jetzt unter „Nutzer“ hinzufügen.
        </p>
      ) : null}
      {fehler ? (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Bitte alle Pflichtfelder korrekt ausfüllen.
        </p>
      ) : null}

      <div className="space-y-4">
        {/* Search bar */}
          <form method="get" className="flex items-center gap-2">
            <input
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Suche nach Name, Straße, PLZ oder Stadt …"
              className={`${inputClass} flex-1`}
            />
            <button
              type="submit"
              className="text-sm font-medium text-brand-orange hover:underline"
            >
              Suchen
            </button>
            {q ? (
              <a
                href="/verwaltung/objekte"
                className="text-sm text-gray-400 hover:text-brand-orange hover:underline"
              >
                ✕ Zurücksetzen
              </a>
            ) : null}
          </form>

          <p className="text-xs text-gray-400">
            {total} Objekt{total !== 1 ? "e" : ""}
            {q ? ` für „${q}"` : ""}
          </p>

          {properties.length === 0 ? (
            <EmptyState>{q ? "Keine Objekte gefunden." : "Noch keine Objekte angelegt."}</EmptyState>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <ul className="divide-y divide-gray-100">
                {properties.map((p) => {
                  const ownersLabel =
                    p.ownerships.length > 0
                      ? p.ownerships.map((o) => o.user.name).join(", ")
                      : "– kein Eigentümer";
                  const details = [
                    p.buildYear ? `Baujahr ${p.buildYear}` : null,
                    p.livingArea ? `${p.livingArea} m²` : null,
                    p.floors != null ? `${p.floors} Etagen` : null,
                    p.buildingType ?? null,
                    p.heatingType ?? null,
                  ]
                    .filter(Boolean)
                    .join(" · ");

                  return (
                    <PropertyRow
                      key={p.id}
                      name={p.name}
                      address={`${p.street}, ${p.zip} ${p.city}`}
                      managementTypeBadge={
                        <span className="rounded-full bg-brand-orange-light px-2 py-0.5 text-xs font-medium text-brand-orange-dark">
                          {managementTypeLabels[p.managementType]}
                        </span>
                      }
                      unitCount={p.units.length}
                    >
                      <div className="space-y-3">
                        <p className="text-xs text-gray-500">
                          <span className="font-medium">Eigentümer:</span> {ownersLabel}
                        </p>
                        {details ? <p className="text-xs text-gray-500">{details}</p> : null}
                        {p.notes ? (
                          <p className="text-xs italic text-gray-400">{p.notes}</p>
                        ) : null}
                        {p.units.length === 0 ? (
                          <p className="text-sm text-gray-500">Keine Einheiten angelegt.</p>
                        ) : (
                          <ul className="divide-y divide-gray-100">
                            {p.units.map((u) => (
                              <li key={u.id} className="flex justify-between py-2 text-sm">
                                <span className="text-gray-900">
                                  {u.label}
                                  {u.floor ? ` (${u.floor})` : ""}
                                </span>
                                <span className="text-gray-500">
                                  {u.tenancies.length > 0
                                    ? u.tenancies.map((t) => t.user.name).join(", ")
                                    : "leer / kein Mieter"}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </PropertyRow>
                  );
                })}
              </ul>
            </div>
          )}

          {totalPages > 1 ? (
            <div className="mt-4 flex items-center justify-between">
              {currentPage > 1 ? (
                <a
                  href={pageHref(currentPage - 1)}
                  className="rounded-lg border border-white/20 bg-white/90 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-white"
                >
                  ← Zurück
                </a>
              ) : (
                <span />
              )}
              <span className="text-xs text-gray-400">
                Seite {currentPage} von {totalPages} · {total} Objekte
              </span>
              {currentPage < totalPages ? (
                <a
                  href={pageHref(currentPage + 1)}
                  className="rounded-lg border border-white/20 bg-white/90 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-white"
                >
                  Weiter →
                </a>
              ) : (
                <span />
              )}
            </div>
          ) : null}
      </div>
    </>
  );
}
