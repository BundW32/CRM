import type { Prisma } from "@/generated/prisma/client";
import { propertyWhereForVerwalter } from "@/lib/access";
import { db } from "@/lib/db";
import { normalizeSearch, pageHrefFor, parsePage, resolveSort, toOrderBy } from "@/lib/list-query";
import { requireVerwalter } from "@/lib/session";
import { Pagination, buttonClass } from "@/components/ui";
import { FilterBar, SortControl } from "@/components/filter-bar";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

// Whitelist der Sortierfelder (verhindert beliebige Felder aus der URL).
// Gilt nur für die abgeschlossenen Protokolle – die Entwürfe stehen bewusst
// weiter nach letzter Bearbeitung, das ist dort die Arbeitsreihenfolge.
const SORT_FIELDS = { bearbeitet: "updatedAt", uebergabe: "handoverDate", art: "type" } as const;

const sortOptions = [
  { value: "bearbeitet", label: "Zuletzt bearbeitet" },
  { value: "uebergabe", label: "Übergabedatum" },
  { value: "art", label: "Art (Ein-/Auszug)" },
];

const typeLabels: Record<string, string> = {
  EINZUG: "Einzug",
  AUSZUG: "Auszug",
  ZWISCHENZUSTAND: "Zwischenzustand",
};

const typeColors: Record<string, string> = {
  EINZUG: "bg-green-100 text-green-700",
  AUSZUG: "bg-orange-100 text-orange-700",
  ZWISCHENZUSTAND: "bg-blue-100 text-blue-700",
};

function resumeHref(h: {
  id: string;
  rooms: { id: string }[];
  checklist: unknown;
  meters: { reading: string | null }[];
  tenantSignature: string | null;
  managerSignature: string | null;
}): string {
  const cl = h.checklist as Record<string, string> | null;
  if (h.tenantSignature || h.managerSignature) return `/uebergabe/${h.id}/unterschriften`;
  if (h.meters.some((m) => m.reading !== null)) return `/uebergabe/${h.id}/unterschriften`;
  if (cl && Object.keys(cl).some((k) => !k.startsWith("note_"))) return `/uebergabe/${h.id}/zaehler`;
  if (h.rooms.length > 0) return `/uebergabe/${h.id}/checkliste`;
  return `/uebergabe/${h.id}/stammdaten`;
}

function stepInfo(h: Parameters<typeof resumeHref>[0]): { step: number; label: string } {
  const href = resumeHref(h);
  if (href.endsWith("unterschriften")) return { step: 5, label: "Unterschriften" };
  if (href.endsWith("zaehler")) return { step: 4, label: "Zählerstände" };
  if (href.endsWith("checkliste")) return { step: 3, label: "Checkliste" };
  if (href.endsWith("raeume")) return { step: 2, label: "Räume" };
  return { step: 1, label: "Stammdaten" };
}

export default async function UebergabeOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const verwalter = await requireVerwalter();
  const propWhere = await propertyWhereForVerwalter(verwalter);
  const sp = await searchParams;
  const currentPage = parsePage(sp.page);
  const sort = resolveSort(sp.sort, sp.dir, SORT_FIELDS, "bearbeitet", "desc");
  const q = normalizeSearch(sp.q);

  // Bisher wurden ALLE Protokolle geladen und erst im Speicher getrennt. Die
  // abgeschlossenen wachsen mit jedem Ein-/Auszug dauerhaft – daher eigene,
  // paginierte Abfrage. Entwürfe sind der offene Arbeitsvorrat und bleiben
  // vollständig sichtbar.
  const include = {
    unit: { include: { property: { select: { name: true } } } },
    rooms: { select: { id: true } },
    meters: { select: { reading: true } },
  } as const;

  const doneWhere: Prisma.HandoverWhereInput = {
    AND: [
      { unit: { property: propWhere }, status: "ABGESCHLOSSEN" },
      ...(q
        ? [
            {
              unit: {
                OR: [
                  { label: { contains: q, mode: "insensitive" as const } },
                  { property: { name: { contains: q, mode: "insensitive" as const } } },
                ],
              },
            },
          ]
        : []),
    ],
  };

  const [entwurf, abgeschlossen, doneTotal] = await Promise.all([
    db.handover.findMany({
      where: { unit: { property: propWhere }, status: "ENTWURF" },
      include,
      orderBy: { updatedAt: "desc" },
    }),
    db.handover.findMany({
      where: doneWhere,
      include,
      orderBy: toOrderBy(sort.field, sort.dir),
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.handover.count({ where: doneWhere }),
  ]);

  const pageHref = pageHrefFor(`/uebergabe`, sp);

  return (
    <div className="min-h-screen bw-shell-bg px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-8 animate-page-in">

        {/* Page header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <a
              href="/verwaltung"
              className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors mb-2"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Verwaltung
            </a>
            <h1 className="text-xl font-bold text-white sm:text-2xl">Wohnungsübergaben</h1>
          </div>
          <a href="/uebergabe/neu" className={buttonClass}>
            <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Neue Übergabe
          </a>
        </div>

        {/* In-progress */}
        <section>
          <h2 className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-3 flex items-center gap-2">
            In Bearbeitung
            {entwurf.length > 0 && (
              <span className="inline-flex items-center justify-center rounded-full bg-brand-orange/20 text-brand-orange-ink text-xs font-bold w-5 h-5">
                {entwurf.length}
              </span>
            )}
          </h2>

          {entwurf.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-8 text-center space-y-3">
              <p className="text-sm text-white/40">Keine angefangenen Übergaben.</p>
              <a
                href="/uebergabe/neu"
                className="inline-flex items-center gap-1 text-sm text-brand-orange hover:text-brand-orange-dark transition-colors font-medium"
              >
                Jetzt neue Übergabe anlegen →
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              {entwurf.map((h) => {
                const { step, label } = stepInfo(h);
                const date = h.handoverDate.toLocaleDateString("de-DE", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                });
                const pct = Math.round(((step - 1) / 5) * 100);
                return (
                  <div
                    key={h.id}
                    className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden"
                  >
                    <div className="px-4 pt-4 pb-3 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${typeColors[h.type] ?? "bg-gray-100 text-gray-600"}`}
                          >
                            {typeLabels[h.type] ?? h.type}
                          </span>
                          <span className="text-xs text-gray-400">{date}</span>
                        </div>
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {h.unit.property.name} · {h.unit.label}
                        </p>
                        {h.tenantName && (
                          <p className="text-xs text-gray-500 mt-0.5">{h.tenantName}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs text-gray-400">Schritt {step} / 6</p>
                        <p className="text-xs font-medium text-gray-600">{label}</p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="h-1 bg-gray-100">
                      <div
                        className="h-1 bg-brand-orange transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <div className="px-4 py-3 bg-gray-50 flex items-center justify-between gap-2">
                      <span className="text-xs text-gray-400">
                        Bearbeitet: {h.updatedAt.toLocaleDateString("de-DE")}
                      </span>
                      <a
                        href={resumeHref(h)}
                        className="inline-flex items-center justify-center rounded-lg bg-brand-orange px-3 py-1.5 text-xs font-semibold text-brand-green-dark shadow-sm transition-all hover:bg-brand-orange-dark active:scale-[0.98]"
                      >
                        Fortsetzen →
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Completed */}
        {doneTotal > 0 || q ? (
          <section>
            <h2 className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-3 flex items-center gap-2">
              Abgeschlossen
              <span className="inline-flex items-center justify-center rounded-full bg-white/10 text-white/60 px-1.5 text-xs font-bold min-w-5 h-5">
                {doneTotal}
              </span>
            </h2>

            <div className="mb-3 flex items-center justify-between gap-3">
              <FilterBar
                className="flex-1"
                searchPlaceholder="Suchen"
                searchHint="Nach Objekt oder Einheit suchen"
              />
              <SortControl sortOptions={sortOptions} defaultSort="bearbeitet" total={doneTotal} />
            </div>

            {abgeschlossen.length === 0 ? (
              <p className="text-sm text-white/50">Keine Protokolle gefunden.</p>
            ) : null}

            <div className="space-y-2">
              {abgeschlossen.map((h) => {
                const date = h.handoverDate.toLocaleDateString("de-DE", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                });
                return (
                  <div
                    key={h.id}
                    className="rounded-2xl border border-gray-200 bg-white shadow-sm px-4 py-3 flex items-center gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${typeColors[h.type] ?? "bg-gray-100 text-gray-600"}`}
                        >
                          {typeLabels[h.type] ?? h.type}
                        </span>
                        <span className="text-xs text-gray-400">{date}</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Fertig
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {h.unit.property.name} · {h.unit.label}
                      </p>
                      {h.tenantName && (
                        <p className="text-xs text-gray-500">{h.tenantName}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {h.pdfStoredName && (
                        <a
                          href={`/api/files/handover-pdf/${h.id}?download=1`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-all hover:bg-gray-50 active:scale-[0.98]"
                        >
                          <svg viewBox="0 0 24 24" className="mr-1 h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          PDF
                        </a>
                      )}
                      <a
                        href={`/uebergabe/${h.id}/abschluss`}
                        className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-all hover:bg-gray-50 active:scale-[0.98]"
                      >
                        Ansehen
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>

            <Pagination
              currentPage={currentPage}
              totalPages={Math.max(1, Math.ceil(doneTotal / PAGE_SIZE))}
              total={doneTotal}
              itemLabel="Protokolle"
              hrefFor={pageHref}
            />
          </section>
        ) : null}
      </div>
    </div>
  );
}
