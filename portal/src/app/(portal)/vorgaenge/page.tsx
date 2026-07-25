import Link from "next/link";
import type { Prisma, TicketPriority, TicketStatus, TicketType, Trade } from "@/generated/prisma/client";
import { Pagination, Alert, EmptyState, PageTitle, StatusBadge, buttonClass } from "@/components/ui";
import { FilterBar, SortControl, type ComboboxFilterConfig, type FilterConfig } from "@/components/filter-bar";
import { propertyWhereForVerwalter, ticketWhereForUser, userWhereForVerwalter } from "@/lib/access";
import { db } from "@/lib/db";
import {
  formatDate,
  roleLabels,
  ticketPriorityLabels,
  ticketStatusLabels,
  ticketTypeLabels,
  tradeLabels,
  unitPublicLabel,
} from "@/lib/labels";
import { normalizeSearch, parsePage, resolveSort, toOrderBy } from "@/lib/list-query";
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

  // ── Objekt → Einheit → Nutzer (Kaskade, nur Verwalter) ──
  // Objektliste wird immer geladen (Combobox-Optionen). Einheiten/Nutzer erst
  // nach gültiger Objektwahl – dadurch bleibt „Einheit" gesperrt und „Nutzer"
  // ausgeblendet, solange kein Objekt gewählt ist. Alle Werte werden gegen den
  // Scope des Verwalters bzw. die geladenen Listen validiert (kein Fremdzugriff).
  let properties: { id: string; name: string; street: string; zip: string; city: string }[] = [];
  let unitOptions: { value: string; label: string }[] = [];
  let nutzerOptions: { value: string; label: string; sublabel?: string }[] = [];
  let objektId: string | undefined;
  let einheitId: string | undefined;
  let nutzerId: string | undefined;

  if (isVerwalter) {
    properties = await db.property.findMany({
      where: await propertyWhereForVerwalter(user),
      select: { id: true, name: true, street: true, zip: true, city: true },
      orderBy: { name: "asc" },
    });
    objektId = sp.objekt && properties.some((p) => p.id === sp.objekt) ? sp.objekt : undefined;

    if (objektId) {
      const [units, nutzer] = await Promise.all([
        db.unit.findMany({
          where: { propertyId: objektId },
          select: { id: true, label: true, externalLabel: true },
          orderBy: { label: "asc" },
        }),
        db.user.findMany({
          where: {
            AND: [
              await userWhereForVerwalter(user),
              {
                OR: [
                  { tenancies: { some: { unit: { propertyId: objektId } } } },
                  { ownerships: { some: { propertyId: objektId } } },
                ],
              },
            ],
          },
          select: { id: true, name: true, role: true },
          orderBy: { name: "asc" },
        }),
      ]);
      unitOptions = units.map((u) => ({ value: u.id, label: unitPublicLabel(u) }));
      nutzerOptions = nutzer.map((n) => ({ value: n.id, label: n.name, sublabel: roleLabels[n.role] }));
      einheitId = sp.einheit && units.some((u) => u.id === sp.einheit) ? sp.einheit : undefined;
      nutzerId = sp.nutzer && nutzer.some((n) => n.id === sp.nutzer) ? sp.nutzer : undefined;
    }
  }

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
    { key: "status", label: "Status", options: optionsFrom(ticketStatusLabels), primary: true },
    { key: "typ", label: "Art", options: optionsFrom(ticketTypeLabels) },
    { key: "prio", label: "Priorität", options: optionsFrom(ticketPriorityLabels) },
    ...(isVerwalter
      ? [{ key: "gewerk", label: "Gewerk", options: optionsFrom(tradeLabels) } as FilterConfig]
      : []),
  ];

  // Objekt (immer sichtbar) → Einheit (gesperrt bis Objekt) → Nutzer (erst nach Objekt).
  const comboboxes: ComboboxFilterConfig[] = isVerwalter
    ? [
        {
          key: "objekt",
          label: "Objekt",
          placeholder: "Objekt wählen",
          options: properties.map((p) => ({
            value: p.id,
            label: p.name,
            sublabel: [p.street, [p.zip, p.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || undefined,
          })),
          currentValue: objektId,
          clears: ["einheit", "nutzer"],
        },
        {
          key: "einheit",
          label: "Einheit",
          placeholder: "Einheit wählen",
          options: unitOptions,
          currentValue: einheitId,
          disabled: !objektId,
          disabledHint: "Erst Objekt wählen",
        },
        {
          key: "nutzer",
          label: "Nutzer",
          placeholder: "Nutzer wählen",
          options: nutzerOptions,
          currentValue: nutzerId,
          hidden: !objektId,
        },
      ]
    : [];

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
        searchPlaceholder="Nr., Titel oder Beschreibung suchen…"
        filters={filters}
        comboboxes={comboboxes}
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
