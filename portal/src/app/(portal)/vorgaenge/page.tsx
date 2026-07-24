import Link from "next/link";
import type { Prisma, TicketPriority, TicketStatus, TicketType, Trade } from "@/generated/prisma/client";
import { Pagination, Alert, EmptyState, PageTitle, StatusBadge, buttonClass } from "@/components/ui";
import { FilterBar, type FilterConfig } from "@/components/filter-bar";
import { ticketWhereForUser } from "@/lib/access";
import { db } from "@/lib/db";
import {
  formatDate,
  ticketPriorityLabels,
  ticketStatusLabels,
  ticketTypeLabels,
  tradeLabels,
  unitPublicLabel,
} from "@/lib/labels";
import { normalizeSearch, parsePage, resolveSort, toOrderBy } from "@/lib/list-query";
import { requireUser } from "@/lib/session";
import { searchTicketTargets } from "./actions";

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

function optionsFrom(map: Record<string, string>) {
  return Object.entries(map).map(([value, label]) => ({ value, label }));
}

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
  const ziel = isVerwalter ? sp.ziel : undefined;
  const zielProp = ziel?.startsWith("p:") ? ziel.slice(2) : undefined;
  const zielUnit = ziel?.startsWith("u:") ? ziel.slice(2) : undefined;

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
  if (zielProp) and.push({ propertyId: zielProp });
  if (zielUnit) and.push({ unitId: zielUnit });
  const ticketWhere: Prisma.TicketWhereInput = { AND: and };

  const [total, tickets, zielLabel] = await Promise.all([
    db.ticket.count({ where: ticketWhere }),
    db.ticket.findMany({
      where: ticketWhere,
      orderBy: toOrderBy(sort.field, sort.dir) as Prisma.TicketOrderByWithRelationInput,
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { property: true, unit: true, createdBy: true, assignedTo: true },
    }),
    // Label des aktiven Objekt/Einheit-Filters für den Chip auflösen.
    zielProp
      ? db.property.findUnique({ where: { id: zielProp }, select: { name: true } }).then((p) => p?.name)
      : zielUnit
        ? db.unit
            .findUnique({ where: { id: zielUnit }, select: { label: true, externalLabel: true, property: { select: { name: true } } } })
            .then((u) => (u ? `${u.property.name} · ${unitPublicLabel(u)}` : undefined))
        : Promise.resolve(undefined),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Paginierung muss alle aktiven Filter mittragen.
  function pageHref(p: number) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (v && k !== "page") params.set(k, v);
    }
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/vorgaenge${qs ? `?${qs}` : ""}`;
  }

  const filters: FilterConfig[] = [
    { key: "status", label: "Status", options: optionsFrom(ticketStatusLabels) },
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
        className="mb-4"
        searchPlaceholder="Nr., Titel oder Beschreibung suchen…"
        filters={filters}
        sortOptions={sortOptions}
        defaultSort="aktualisiert"
        entity={
          isVerwalter
            ? {
                key: "ziel",
                placeholder: "Objekt / Einheit …",
                currentValue: ziel ?? undefined,
                currentLabel: zielLabel ?? undefined,
                search: searchTicketTargets,
              }
            : undefined
        }
      />

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
