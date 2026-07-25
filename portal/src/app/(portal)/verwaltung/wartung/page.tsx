import type { Prisma } from "@/generated/prisma/client";
import { Pagination, Alert, Card, EmptyState, Field, PageTitle, inputClass } from "@/components/ui";
import { FilterBar, SortControl, type FilterConfig } from "@/components/filter-bar";
import { SubmitButton } from "@/components/submit-button";
import { craftsmanWhereForVerwalter, propertyIdsForVerwalter } from "@/lib/access";
import { db } from "@/lib/db";
import {
  formatDate,
  maintenanceIntervalLabels,
  ticketStatusLabels,
  tradeLabels,
} from "@/lib/labels";
import { optionsFrom, propertyScopeFilters } from "@/lib/list-filters";
import { normalizeSearch, parsePage, resolveSort, toOrderBy } from "@/lib/list-query";
import { requireVerwalter } from "@/lib/session";
import {
  completeMaintenanceTask,
  createMaintenanceTask,
  createTicketFromTask,
  deleteMaintenanceTask,
} from "./actions";

export const dynamic = "force-dynamic";

const DAY = 1000 * 60 * 60 * 24;

const PAGE_SIZE = 30;

// Whitelist der Sortierfelder (verhindert beliebige Felder aus der URL).
const SORT_FIELDS = { faellig: "dueDate", titel: "title", erledigt: "lastDoneAt" } as const;

const sortOptions = [
  { value: "faellig", label: "Fällig am" },
  { value: "titel", label: "Titel" },
  { value: "erledigt", label: "Zuletzt erledigt" },
];

const faelligOptions = [
  { value: "ueberfaellig", label: "Überfällig" },
  { value: "bald", label: "Bald fällig (14 Tage)" },
];

export default async function WartungPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const verwalter = await requireVerwalter();
  const params = await searchParams;
  const { fehler } = params;
  const currentPage = parsePage(params.page);
  const assignedIds = await propertyIdsForVerwalter(verwalter);
  // Org-Filter gilt auch für SuperAdmin (sonst objekt-/mandantenübergreifende Liste).
  const propWhere =
    assignedIds === null
      ? { organizationId: verwalter.organizationId }
      : { id: { in: assignedIds } };
  const baseTaskWhere: Prisma.MaintenanceTaskWhereInput =
    assignedIds === null
      ? { active: true, organizationId: verwalter.organizationId }
      : { active: true, property: { id: { in: assignedIds } } };

  // ── Filter: Suche, Intervall, Fälligkeit, Objekt ──
  const scope = await propertyScopeFilters(verwalter, params, { withUnit: false });
  const q = normalizeSearch(params.q);
  const intervall =
    params.intervall && params.intervall in maintenanceIntervalLabels ? params.intervall : undefined;
  const faellig = params.faellig === "ueberfaellig" || params.faellig === "bald" ? params.faellig : undefined;
  const sort = resolveSort(params.sort, params.dir, SORT_FIELDS, "faellig", "asc");

  const taskAnd: Prisma.MaintenanceTaskWhereInput[] = [baseTaskWhere];
  if (q) {
    taskAnd.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  if (intervall) {
    taskAnd.push({ interval: intervall as Prisma.MaintenanceTaskWhereInput["interval"] });
  }
  const today = new Date();
  if (faellig === "ueberfaellig") taskAnd.push({ dueDate: { lt: today } });
  if (faellig === "bald") {
    taskAnd.push({ dueDate: { gte: today, lte: new Date(today.getTime() + 14 * DAY) } });
  }
  if (scope.objektId) taskAnd.push({ propertyId: scope.objektId });
  const taskWhere: Prisma.MaintenanceTaskWhereInput = { AND: taskAnd };
  const hasFilter = Boolean(q || intervall || faellig || scope.active);

  const [total, tasks, properties, craftsmen] = await Promise.all([
    db.maintenanceTask.count({ where: taskWhere }),
    db.maintenanceTask.findMany({
      where: taskWhere,
      orderBy: toOrderBy(sort.field, sort.dir) as Prisma.MaintenanceTaskOrderByWithRelationInput,
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        property: true,
        craftsman: true,
        generatedTickets: {
          where: { status: { notIn: ["GESCHLOSSEN"] } },
          select: { id: true, status: true, number: true },
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    db.property.findMany({ where: propWhere, orderBy: { name: "asc" } }),
    db.craftsman.findMany({
      where: { active: true, ...(await craftsmanWhereForVerwalter(verwalter)) },
      orderBy: { name: "asc" },
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
    return `/verwaltung/wartung${qs ? `?${qs}` : ""}`;
  }

  const taskFilters: FilterConfig[] = [
    { key: "faellig", label: "Fälligkeit", allLabel: "Alle", primary: true, options: faelligOptions },
    { key: "intervall", label: "Intervall", allLabel: "Alle Intervalle", options: optionsFrom(maintenanceIntervalLabels) },
  ];

  const now = new Date().getTime();

  return (
    <>
      <PageTitle
      >
        Wartung &amp; Prüfungen
      </PageTitle>
      <p className="mb-6 max-w-3xl text-sm text-gray-300">
        Wiederkehrende Wartungen und Prüfungen (z. B. Heizung, Rauchmelder,
        Legionellenprüfung) mit Fälligkeitsdatum. Überfällige Einträge sind rot,
        bald fällige orange markiert.
      </p>

      {fehler ? (
        <Alert variant="error" className="mb-4">
          Bitte Titel, Intervall und Fälligkeitsdatum angeben.
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <div>
            <FilterBar
              searchPlaceholder="Suchen"
              searchHint="Nach Titel oder Beschreibung suchen"
              filters={taskFilters}
              comboboxes={scope.comboboxes}
            />
            <div className="mt-2 flex items-center justify-between gap-3 px-1">
              <p className="text-xs text-gray-400">
                {total} {total === 1 ? "Aufgabe" : "Aufgaben"}
                {hasFilter ? " (gefiltert)" : ""}
              </p>
              {total > 0 ? <SortControl sortOptions={sortOptions} defaultSort="faellig" /> : null}
            </div>
          </div>

          {tasks.length === 0 ? (
            <EmptyState>
              {hasFilter ? "Keine Aufgaben gefunden." : "Noch keine Wartungsaufgaben angelegt."}
            </EmptyState>
          ) : (
            tasks.map((t) => {
              const days = Math.floor((t.dueDate.getTime() - now) / DAY);
              const tone =
                days < 0
                  ? "border-red-300 bg-red-50"
                  : days <= 14
                    ? "border-orange-300 bg-orange-50"
                    : "border-gray-200 bg-white";
              const statusText =
                days < 0
                  ? `überfällig seit ${Math.abs(days)} Tag(en)`
                  : days === 0
                    ? "heute fällig"
                    : `fällig in ${days} Tag(en)`;
              return (
                <div key={t.id} className={`rounded-2xl border p-4 shadow-sm ${tone}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{t.title}</p>
                      <p className="text-xs text-gray-500">
                        {maintenanceIntervalLabels[t.interval]} · fällig am{" "}
                        {formatDate(t.dueDate)} · {statusText}
                      </p>
                      <p className="text-xs text-gray-500">
                        {t.property ? t.property.name : "Allgemein"}
                        {t.craftsman
                          ? ` · ${t.craftsman.company ? t.craftsman.company + " / " : ""}${t.craftsman.name} (${tradeLabels[t.craftsman.trade]})`
                          : ""}
                        {t.lastDoneAt ? ` · zuletzt erledigt ${formatDate(t.lastDoneAt)}` : ""}
                      </p>
                      {t.description ? (
                        <p className="mt-1 text-sm text-gray-700">{t.description}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-3">
                      {t.generatedTickets[0] ? (
                        <a
                          href={`/vorgaenge/${t.generatedTickets[0].id}`}
                          className="rounded-lg border border-purple-300 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100"
                        >
                          Vorgang #{t.generatedTickets[0].number} ({ticketStatusLabels[t.generatedTickets[0].status]})
                        </a>
                      ) : (
                        <form action={createTicketFromTask}>
                          <input type="hidden" name="id" value={t.id} />
                          <button
                            type="submit"
                            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                          >
                            Vorgang anlegen
                          </button>
                        </form>
                      )}
                      <form action={completeMaintenanceTask}>
                        <input type="hidden" name="id" value={t.id} />
                        <button
                          type="submit"
                          className="rounded-lg bg-brand-orange px-3 py-1.5 text-xs font-semibold text-brand-green-dark hover:bg-brand-orange-dark"
                        >
                          Erledigt
                        </button>
                      </form>
                      <form action={deleteMaintenanceTask}>
                        <input type="hidden" name="id" value={t.id} />
                        <button type="submit" className="text-xs text-red-600 hover:underline">
                          Löschen
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          <Pagination currentPage={currentPage} totalPages={totalPages} total={total} hrefFor={pageHref} />
        </div>

        <Card title="Wartung anlegen">
          <form action={createMaintenanceTask} className="space-y-3">
            <Field label="Titel">
              <input type="text" name="title" required minLength={2} className={inputClass} placeholder="z. B. Heizungswartung" />
            </Field>
            <Field label="Intervall">
              <select name="interval" required className={inputClass} defaultValue="JAEHRLICH">
                {Object.entries(maintenanceIntervalLabels).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Nächste Fälligkeit">
              <input type="date" name="dueDate" required className={inputClass} />
            </Field>
            <Field label="Objekt (optional)">
              <select name="propertyId" className={inputClass} defaultValue="">
                <option value="">– Allgemein –</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Handwerker (optional)">
              <select name="craftsmanId" className={inputClass} defaultValue="">
                <option value="">– keiner –</option>
                {craftsmen.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company ? `${c.company} / ` : ""}
                    {c.name} ({tradeLabels[c.trade]})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Notiz (optional)">
              <textarea name="description" rows={2} className={inputClass} />
            </Field>
            <SubmitButton pendingLabel="Wird angelegt…">Anlegen</SubmitButton>
          </form>
        </Card>
      </div>
    </>
  );
}
