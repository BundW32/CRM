import Link from "next/link";
import type { Prisma, TicketPriority, TicketStatus, TicketType, Trade } from "@/generated/prisma/client";
import { Pagination, Alert, EmptyState, PageTitle, StatusBadge, buttonClass } from "@/components/ui";
import { FilterBar, SortControl, type FilterConfig } from "@/components/filter-bar";
import { ticketWhereForUser } from "@/lib/access";
import { db } from "@/lib/db";
import {
  formatDate,
  ticketPriorityLabels,
  ticketStatusLabels,
  ticketTypeLabels,
  tradeLabels,
} from "@/lib/labels";
import { optionsFrom, propertyScopeFilters } from "@/lib/list-filters";
import { normalizeSearch, parsePage, resolveSort, toOrderBy, pageHrefFor } from "@/lib/list-query";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

// Whitelist der Sortierfelder (verhindert beliebige Felder aus der URL).
const SORT_FIELDS = {
  aktualisiert: "updatedAt",
  erstellt: "createdAt",
  faellig: "dueAt",
  prioritaet: "priority",
  nummer: "number",
} as const;

const sortOptions = [
  { value: "aktualisiert", label: "Zuletzt aktualisiert" },
  { value: "erstellt", label: "Erstellt" },
  { value: "faellig", label: "Fällig bis" },
  { value: "prioritaet", label: "Priorität" },
  { value: "nummer", label: "Nummer" },
];

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const isVerwalter = user.role === "VERWALTER";

  // ── Filter-Parameter (jeweils gegen erlaubte Werte validiert) ──
  const q = normalizeSearch(sp.q);
  const status = sp.status && sp.status in ticketStatusLabels ? (sp.status as TicketStatus) : undefined;
  const typ = sp.typ && sp.typ in ticketTypeLabels ? (sp.typ as TicketType) : undefined;
  const prio = sp.prio && sp.prio in ticketPriorityLabels ? (sp.prio as TicketPriority) : undefined;
  const gewerk = isVerwalter && sp.gewerk && sp.gewerk in tradeLabels ? (sp.gewerk as Trade) : undefined;

  // Objekt → Einheit → Nutzer (Kaskade). Der Helfer prüft jede Auswahl gegen
  // den Scope der Rolle und blendet die Filter aus, wo sie nichts bringen.
  const scope = await propertyScopeFilters(user, sp, { withUnit: true, withUser: true });
  const { objektId, einheitId, nutzerId } = scope;

  const sort = resolveSort(sp.sort, sp.dir, SORT_FIELDS, "aktualisiert", "desc");
  const currentPage = parsePage(sp.page);

  // ── where zusammenbauen (Filter verengen nur das Access-where) ──
  const and: Prisma.TicketWhereInput[] = [await ticketWhereForUser(user)];
  if (q) {
    const or: Prisma.TicketWhereInput[] = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
    if (/^\d+$/.test(q)) or.push({ number: Number(q) });
    if (isVerwalter) or.push({ createdBy: { name: { contains: q, mode: "insensitive" } } });
    and.push({ OR: or });
  }
  if (status) and.push({ status });
  if (typ) and.push({ type: typ });
  if (prio) and.push({ priority: prio });
  if (gewerk) and.push({ trade: gewerk });
  if (objektId) and.push({ propertyId: objektId });
  if (einheitId) and.push({ unitId: einheitId });
  if (nutzerId) and.push({ createdById: nutzerId });
  const ticketWhere: Prisma.TicketWhereInput = { AND: and };

  const [total, tickets] = await Promise.all([
    db.ticket.count({ where: ticketWhere }),
    db.ticket.findMany({
      where: ticketWhere,
      orderBy: toOrderBy(sort.field, sort.dir) as Prisma.TicketOrderByWithRelationInput,
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { property: true, unit: true, createdBy: true, assignedTo: true },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const pageHref = pageHrefFor(`/vorgaenge`, sp);

  const filters: FilterConfig[] = [
    { key: "status", label: "Status", options: optionsFrom(ticketStatusLabels), primary: true },
    { key: "typ", label: "Art", options: optionsFrom(ticketTypeLabels) },
    { key: "prio", label: "Priorität", options: optionsFrom(ticketPriorityLabels) },
    ...(isVerwalter
      ? [{ key: "gewerk", label: "Gewerk", options: optionsFrom(tradeLabels) } as FilterConfig]
      : []),
  ];

  return (
    <>
      <PageTitle
        action={
          <Link href="/vorgaenge/neu" className={buttonClass}>
            Neuer Vorgang
          </Link>
        }
      >
        Vorgänge
      </PageTitle>

      {sp.geloescht ? (
        <Alert variant="success" className="mb-4">
          Vorgang wurde endgültig gelöscht.
        </Alert>
      ) : null}

      <FilterBar
        className="mb-3"
        searchPlaceholder="Suchen"
        searchHint="Nach Nummer, Titel oder Beschreibung suchen"
        filters={filters}
        comboboxes={scope.comboboxes}
      />

      {/* Ergebniszeile: Trefferzahl links, dezente Sortierung rechts eingebettet. */}
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <p className="text-xs text-gray-400">
          {total} {total === 1 ? "Vorgang" : "Vorgänge"}
          {q || status || typ || prio || gewerk || objektId || einheitId || nutzerId ? " (gefiltert)" : ""}
        </p>
        {total > 0 ? <SortControl sortOptions={sortOptions} defaultSort="aktualisiert" /> : null}
      </div>

      {tickets.length === 0 ? (
        <EmptyState>Keine Vorgänge gefunden.</EmptyState>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <ul className="divide-y divide-gray-100">
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  href={`/vorgaenge/${ticket.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 transition-all hover:bg-gray-50 hover:-translate-y-px"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-gray-900">
                      #{ticket.number} · {ticket.title}
                    </span>
                    <span className="block text-xs text-gray-500">
                      {ticketTypeLabels[ticket.type]}
                      {ticket.trade
                        ? ` · ${tradeLabels[ticket.trade]}`
                        : ticket.category
                          ? ` · ${ticket.category}`
                          : ""}{" "}
                      · {ticket.property ? ticket.property.name : "nicht zugeordnet"}
                      {ticket.unit ? ` · ${ticket.unit.label}` : ""}
                      {isVerwalter ? ` · von ${ticket.createdBy.name}` : ""} · {formatDate(ticket.updatedAt)}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    {ticket.priority !== "NORMAL" ? (
                      <span className="text-xs text-gray-500">{ticketPriorityLabels[ticket.priority]}</span>
                    ) : null}
                    <StatusBadge status={ticket.status} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Pagination currentPage={currentPage} totalPages={totalPages} total={total} itemLabel="Vorgänge" hrefFor={pageHref} />
    </>
  );
}
