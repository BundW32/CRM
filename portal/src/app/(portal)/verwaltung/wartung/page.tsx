import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { PendingButton } from "@/components/pending-button";
import {
  Pagination,
  Alert,
  Card,
  EmptyState,
  Field,
  PageTitle,
  inputClass,
  buttonClass,
  buttonDangerClass,
  buttonSecondaryClass,
  buttonCompact,
} from "@/components/ui";
import {
  Badge,
  DataTable,
  stackTight,
  type BadgeTone,
  type Column,
} from "@/components/data-display";
import { DateField, SelectField } from "@/components/fields";
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
import { normalizeSearch, parsePage, resolveSort, toOrderBy, pageHrefFor } from "@/lib/list-query";
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

  const pageHref = pageHrefFor(`/verwaltung/wartung`, params);

  const taskFilters: FilterConfig[] = [
    { key: "faellig", label: "Fälligkeit", allLabel: "Alle", primary: true, options: faelligOptions },
    { key: "intervall", label: "Intervall", allLabel: "Alle Intervalle", options: optionsFrom(maintenanceIntervalLabels) },
  ];

  const now = new Date().getTime();

  // Fälligkeit als Etikett statt als eingefärbte Kachel: Vorher trug die ganze Karte
  // die Farbe, wodurch eine Liste mit vielen überfälligen Aufgaben zur roten Wand
  // wurde – und damit nichts mehr hervorhob. Jetzt trägt nur der Zustand Farbe.
  const faelligkeit = (dueDate: Date): { tone: BadgeTone; text: string } => {
    const days = Math.floor((dueDate.getTime() - now) / DAY);
    if (days < 0) {
      return { tone: "danger", text: `überfällig seit ${Math.abs(days)} Tag(en)` };
    }
    if (days === 0) return { tone: "warning", text: "heute fällig" };
    if (days <= 14) return { tone: "warning", text: `fällig in ${days} Tag(en)` };
    return { tone: "neutral", text: `fällig in ${days} Tag(en)` };
  };

  type Task = (typeof tasks)[number];

  const columns: readonly Column<Task>[] = [
    {
      header: "Aufgabe",
      cell: (t) => (
        <div className="min-w-0">
          <p className="font-medium text-gray-900">{t.title}</p>
          <p className="text-xs text-gray-500">
            {t.property ? t.property.name : "Allgemein"}
            {t.craftsman
              ? ` · ${t.craftsman.company ? t.craftsman.company + " / " : ""}${t.craftsman.name} (${tradeLabels[t.craftsman.trade]})`
              : ""}
          </p>
          {t.description ? (
            <p className="mt-1 text-xs text-gray-600">{t.description}</p>
          ) : null}
        </div>
      ),
    },
    {
      header: "Intervall",
      cell: (t) => maintenanceIntervalLabels[t.interval],
      className: "whitespace-nowrap",
    },
    {
      header: "Fällig",
      cell: (t) => {
        const f = faelligkeit(t.dueDate);
        return (
          <div className="space-y-1 whitespace-nowrap">
            <div>{formatDate(t.dueDate)}</div>
            <Badge tone={f.tone} dot>
              {f.text}
            </Badge>
          </div>
        );
      },
    },
    {
      header: "Zuletzt erledigt",
      cell: (t) =>
        t.lastDoneAt ? (
          formatDate(t.lastDoneAt)
        ) : (
          <span className="text-gray-400">–</span>
        ),
      className: "whitespace-nowrap",
    },
    {
      header: "Vorgang",
      cell: (t) =>
        t.generatedTickets[0] ? (
          <Link
            href={`/vorgaenge/${t.generatedTickets[0].id}`}
            className={`${buttonSecondaryClass} ${buttonCompact}`}
          >
            #{t.generatedTickets[0].number} ·{" "}
            {ticketStatusLabels[t.generatedTickets[0].status]}
          </Link>
        ) : (
          <form action={createTicketFromTask}>
            <input type="hidden" name="id" value={t.id} />
            <PendingButton className={`${buttonSecondaryClass} ${buttonCompact}`}>
              Vorgang anlegen
            </PendingButton>
          </form>
        ),
      className: "whitespace-nowrap",
    },
    {
      cell: (t) => (
        <div className="flex items-center justify-end gap-2 whitespace-nowrap">
          <form action={completeMaintenanceTask}>
            <input type="hidden" name="id" value={t.id} />
            <PendingButton className={`${buttonClass} ${buttonCompact}`}>
              Erledigt
            </PendingButton>
          </form>
          <form action={deleteMaintenanceTask}>
            <input type="hidden" name="id" value={t.id} />
            <ConfirmActionButton
              className={`${buttonDangerClass} ${buttonCompact}`}
              confirmLabel="Wirklich löschen?"
              pendingLabel="Wird gelöscht…"
            >
              Löschen
            </ConfirmActionButton>
          </form>
        </div>
      ),
      align: "right",
      className: "w-px",
    },
  ];

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

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
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
              <SortControl sortOptions={sortOptions} defaultSort="faellig" total={total} />
            </div>
          </div>

          <Card>
            <DataTable
              columns={columns}
              rows={tasks}
              getKey={(t) => t.id}
              minWidth="52rem"
              caption="Wartungs- und Prüfaufgaben"
              empty={
                <EmptyState>
                  {hasFilter
                    ? "Keine Aufgaben gefunden."
                    : "Noch keine Wartungsaufgaben angelegt."}
                </EmptyState>
              }
            />
          </Card>

          <Pagination currentPage={currentPage} totalPages={totalPages} total={total} hrefFor={pageHref} />
        </div>

        <Card title="Wartung anlegen">
          <form action={createMaintenanceTask} className={stackTight}>
            <Field label="Titel">
              <input type="text" name="title" required minLength={2} className={inputClass} placeholder="z. B. Heizungswartung" />
            </Field>
            <SelectField
              label="Intervall"
              name="interval"
              required
              defaultValue="JAEHRLICH"
              options={Object.entries(maintenanceIntervalLabels).map(([value, label]) => ({
                value,
                label,
              }))}
            />
            <DateField label="Nächste Fälligkeit" name="dueDate" required />
            <SelectField
              label="Objekt (optional)"
              name="propertyId"
              defaultValue=""
              options={[
                { value: "", label: "– Allgemein –" },
                ...properties.map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
            <SelectField
              label="Handwerker (optional)"
              name="craftsmanId"
              defaultValue=""
              options={[
                { value: "", label: "– keiner –" },
                ...craftsmen.map((c) => ({
                  value: c.id,
                  label: `${c.company ? `${c.company} / ` : ""}${c.name} (${tradeLabels[c.trade]})`,
                })),
              ]}
            />
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
