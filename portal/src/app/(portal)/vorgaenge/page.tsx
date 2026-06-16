import Link from "next/link";
import type { TicketStatus } from "@/generated/prisma/client";
import { EmptyState, PageTitle, StatusBadge, buttonClass, inputClass } from "@/components/ui";
import { ticketWhereForUser } from "@/lib/access";
import { db } from "@/lib/db";
import {
  formatDate,
  ticketPriorityLabels,
  ticketStatusLabels,
  ticketTypeLabels,
  tradeLabels,
} from "@/lib/labels";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const statusFilters: TicketStatus[] = [
  "NEU",
  "IN_BEARBEITUNG",
  "BEAUFTRAGT",
  "ERLEDIGT",
  "GESCHLOSSEN",
];

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; propertyId?: string }>;
}) {
  const user = await requireUser();
  const { status, propertyId } = await searchParams;
  const statusFilter = statusFilters.find((s) => s === status);

  const where = await ticketWhereForUser(user);

  const properties =
    user.role === "VERWALTER"
      ? await db.property.findMany({ orderBy: { name: "asc" } })
      : [];

  const propertyFilter =
    user.role === "VERWALTER" && propertyId
      ? properties.find((p) => p.id === propertyId)
      : undefined;

  const tickets = await db.ticket.findMany({
    where: {
      ...where,
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(propertyFilter ? { propertyId: propertyFilter.id } : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: { property: true, unit: true, createdBy: true, assignedTo: true },
  });

  function filterHref(params: { status?: string; propertyId?: string }) {
    const p = new URLSearchParams();
    if (params.status) p.set("status", params.status);
    if (params.propertyId) p.set("propertyId", params.propertyId);
    const q = p.toString();
    return `/vorgaenge${q ? `?${q}` : ""}`;
  }

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

      <div className="mb-3 flex flex-wrap gap-2 text-sm">
        <Link
          href={filterHref({ propertyId: propertyFilter?.id })}
          className={`rounded-full px-3 py-1 font-medium ${!statusFilter ? "bg-brand-orange text-brand-green-dark" : "bg-white/90 text-gray-600 border border-white/20"}`}
        >
          Alle
        </Link>
        {statusFilters.map((s) => (
          <Link
            key={s}
            href={filterHref({ status: s, propertyId: propertyFilter?.id })}
            className={`rounded-full px-3 py-1 font-medium ${statusFilter === s ? "bg-brand-orange text-brand-green-dark" : "bg-white/90 text-gray-600 border border-white/20"}`}
          >
            {ticketStatusLabels[s]}
          </Link>
        ))}
      </div>

      {user.role === "VERWALTER" && properties.length > 1 ? (
        <div className="mb-4">
          <form method="get" className="flex items-center gap-2">
            {statusFilter ? (
              <input type="hidden" name="status" value={statusFilter} />
            ) : null}
            <select
              name="propertyId"
              className={`${inputClass} w-auto`}
              defaultValue={propertyFilter?.id ?? ""}
            >
              <option value="">Alle Objekte</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button type="submit" className="text-sm font-medium text-brand-orange hover:underline">
              Filtern
            </button>
            {propertyFilter ? (
              <Link
                href={filterHref({ status: statusFilter })}
                className="text-sm text-gray-300 hover:text-brand-orange hover:underline"
              >
                ✕ Filter aufheben
              </Link>
            ) : null}
          </form>
        </div>
      ) : null}

      {tickets.length === 0 ? (
        <EmptyState>Keine Vorgänge gefunden.</EmptyState>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <ul className="divide-y divide-gray-100">
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  href={`/vorgaenge/${ticket.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-gray-50"
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
                      {user.role === "VERWALTER"
                        ? ` · von ${ticket.createdBy.name}`
                        : ""}{" "}
                      · {formatDate(ticket.updatedAt)}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    {ticket.priority !== "NORMAL" ? (
                      <span className="text-xs text-gray-500">
                        {ticketPriorityLabels[ticket.priority]}
                      </span>
                    ) : null}
                    <StatusBadge status={ticket.status} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
