import type { Prisma } from "@/generated/prisma/client";
import { Pagination, Card, EmptyState, PageTitle } from "@/components/ui";
import { FilterBar, type FilterConfig } from "@/components/filter-bar";
import { noteWhereForVerwalter, propertyWhereForVerwalter } from "@/lib/access";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";
import { formatDate } from "@/lib/labels";
import { propertyScopeFilters } from "@/lib/list-filters";
import { normalizeSearch, parsePage } from "@/lib/list-query";
import { deleteNote, togglePinNote } from "./actions";
import { NoteForm } from "./note-form";

export const dynamic = "force-dynamic";

type FilterType = "alle" | "objekte" | "einheiten" | "personen";

function buildWhere(type: FilterType) {
  if (type === "objekte") return { propertyId: { not: null as string | null } };
  if (type === "einheiten") return { unitId: { not: null as string | null } };
  if (type === "personen") return { targetUserId: { not: null as string | null } };
  return {};
}

const PAGE_SIZE = 30;

export default async function NotizenPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const verwalter = await requireVerwalter();
  const propWhere = await propertyWhereForVerwalter(verwalter);

  const params = await searchParams;
  const type = (params.type ?? "alle") as FilterType;
  const currentPage = parsePage(params.page);

  // ── Filter: Suche, Bezug (Objekt/Einheit/Person), Objekt/Einheit ──
  const scope = await propertyScopeFilters(verwalter, params, { withUnit: true });
  const q = normalizeSearch(params.q);

  const noteAnd: Prisma.NoteWhereInput[] = [
    buildWhere(type),
    await noteWhereForVerwalter(verwalter),
  ];
  if (q) noteAnd.push({ body: { contains: q, mode: "insensitive" } });
  if (scope.objektId) {
    noteAnd.push({
      OR: [{ propertyId: scope.objektId }, { unit: { propertyId: scope.objektId } }],
    });
  }
  if (scope.einheitId) noteAnd.push({ unitId: scope.einheitId });
  const noteWhere: Prisma.NoteWhereInput = { AND: noteAnd };
  const hasFilter = Boolean(q || type !== "alle" || scope.active);

  const [total, notes, properties] = await Promise.all([
    db.note.count({ where: noteWhere }),
    db.note.findMany({
      where: noteWhere,
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        property: true,
        unit: { include: { property: true } },
        targetUser: true,
        author: true,
      },
    }),
    // Nur die Objektliste ausliefern; Einheiten und Personen lädt das Formular
    // bei Objektauswahl on demand nach (skaliert auch bei sehr großen Beständen).
    db.property.findMany({
      where: propWhere,
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Paginierung muss alle aktiven Filter mittragen.
  function pageHref(p: number) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v && k !== "page") sp.set(k, v);
    }
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return `/verwaltung/notizen${qs ? `?${qs}` : ""}`;
  }

  const noteFilters: FilterConfig[] = [
    {
      key: "type",
      label: "Bezug",
      allLabel: "Alle",
      primary: true,
      options: [
        { value: "objekte", label: "Objekte" },
        { value: "einheiten", label: "Einheiten" },
        { value: "personen", label: "Mieter/Eigentümer" },
      ],
    },
  ];

  return (
    <>
      <PageTitle
        back={{ href: "/verwaltung", label: "Verwaltung" }}
      >
        Notizen
      </PageTitle>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Note list – takes up 2 columns on large screens */}
        <div className="space-y-4 lg:col-span-2">
          <div>
            <FilterBar
              searchPlaceholder="Suchen"
              searchHint="In Notiztexten suchen"
              filters={noteFilters}
              comboboxes={scope.comboboxes}
            />
            <p className="mt-2 px-1 text-xs text-gray-400">
              {total} {total === 1 ? "Notiz" : "Notizen"}
              {hasFilter ? " (gefiltert)" : ""}
            </p>
          </div>

          {/* Notes */}
          {notes.length === 0 ? (
            <EmptyState>
              {hasFilter ? "Keine Notizen gefunden." : "Keine Notizen vorhanden."}
            </EmptyState>
          ) : (
            <ul className="space-y-3">
              {notes.map((note) => {
                const contextLabel = note.property
                  ? note.property.name
                  : note.unit
                    ? `${note.unit.label} · ${note.unit.property.name}`
                    : note.targetUser
                      ? note.targetUser.name
                      : null;

                // Inline server action wrappers using .bind()
                const boundDelete = deleteNote.bind(null, note.id);
                const boundTogglePin = togglePinNote.bind(null, note.id, note.pinned);

                return (
                  <li
                    key={note.id}
                    className={`rounded-2xl border bg-white p-4 shadow-sm ${
                      note.pinned ? "border-orange-300" : "border-gray-200"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Pin button */}
                      <form action={boundTogglePin}>
                        <button
                          type="submit"
                          title={note.pinned ? "Anpinnen aufheben" : "Anpinnen"}
                          className="mt-0.5 flex-shrink-0 text-xl leading-none transition hover:scale-110"
                        >
                          {note.pinned ? (
                            <span className="text-orange-500">★</span>
                          ) : (
                            <span className="text-gray-300 hover:text-orange-400">☆</span>
                          )}
                        </button>
                      </form>

                      {/* Body */}
                      <div className="min-w-0 flex-1">
                        <p className="whitespace-pre-wrap text-sm text-gray-900">{note.body}</p>
                        <p className="mt-2 text-xs text-gray-400">
                          {contextLabel ? (
                            <>
                              <span className="font-medium text-gray-500">{contextLabel}</span>
                              {" · "}
                            </>
                          ) : null}
                          {note.author.name} · {formatDate(note.createdAt)}
                        </p>
                      </div>

                      {/* Delete button */}
                      <form action={boundDelete}>
                        <button
                          type="submit"
                          title="Notiz löschen"
                          className="flex-shrink-0 rounded px-1.5 py-0.5 text-sm font-bold text-red-400 transition hover:bg-red-50 hover:text-red-600"
                        >
                          ×
                        </button>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <Pagination currentPage={currentPage} totalPages={totalPages} total={total} itemLabel="Notizen" hrefFor={pageHref} />
        </div>

        {/* Create form */}
        <Card title="Neue Notiz">
          <NoteForm properties={properties} />
        </Card>
      </div>
    </>
  );
}
