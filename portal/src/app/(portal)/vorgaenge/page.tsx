import Link from "next/link";
import type { TicketStatus } from "@/generated/prisma/client";
import { EmptyState, PageTitle, StatusBadge, buttonClass } from "@/components/ui";
import { ticketWhereForUser } from "@/lib/access";
import { db } from "@/lib/db";
import {
  formatDate,
  ticketPriorityLabels,
  ticketStatusLabels,
  ticketTypeLabels,
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
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireUser();
  const { status } = await searchParams;
  const statusFilter = statusFilters.find((s) => s === status);

  const where = await ticketWhereForUser(user);
  const tickets = await db.ticket.findMany({
    where: { ...where, ...(statusFilter ? { status: statusFilter } : {}) },
    orderBy: { updatedAt: "desc" },
    include: { property: true, unit: true, createdBy: true, assignedTo: true },
  });

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

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link
          href="/vorgaenge"
          className={`rounded-full px-3 py-1 ${!statusFilter ? "bg-blue-700 text-white" : "bg-white text-gray-600 border border-gray-300"}`}
        >
          Alle
        </Link>
        {statusFilters.map((s) => (
          <Link
            key={s}
            href={`/vorgaenge?status=${s}`}
            className={`rounded-full px-3 py-1 ${statusFilter === s ? "bg-blue-700 text-white" : "bg-white text-gray-600 border border-gray-300"}`}
          >
            {ticketStatusLabels[s]}
          </Link>
        ))}
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
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-gray-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-gray-900">
                      #{ticket.number} · {ticket.title}
                    </span>
                    <span className="block text-xs text-gray-500">
                      {ticketTypeLabels[ticket.type]}
                      {ticket.category ? ` · ${ticket.category}` : ""} ·{" "}
                      {ticket.property.name}
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
