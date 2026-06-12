import Link from "next/link";
import { Card, EmptyState, PageTitle, StatusBadge, buttonClass } from "@/components/ui";
import {
  announcementWhereForUser,
  ownedProperties,
  tenantUnits,
  ticketWhereForUser,
} from "@/lib/access";
import { db } from "@/lib/db";
import { formatDate, ticketTypeLabels } from "@/lib/labels";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();

  const ticketWhere = await ticketWhereForUser(user);
  const [openTickets, latestTickets, announcements] = await Promise.all([
    db.ticket.count({
      where: { ...ticketWhere, status: { notIn: ["ERLEDIGT", "GESCHLOSSEN"] } },
    }),
    db.ticket.findMany({
      where: ticketWhere,
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: { property: true, unit: true },
    }),
    db.announcement.findMany({
      where: await announcementWhereForUser(user),
      orderBy: { createdAt: "desc" },
      take: 3,
      include: { property: true },
    }),
  ]);

  return (
    <>
      <PageTitle
        action={
          user.role === "MIETER" || user.role === "EIGENTUEMER" ? (
            <Link href="/vorgaenge/neu" className={buttonClass}>
              {user.role === "MIETER" ? "Schaden melden" : "Anfrage stellen"}
            </Link>
          ) : undefined
        }
      >
        Guten Tag, {user.name}
      </PageTitle>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title={`Aktuelle Vorgänge (${openTickets} offen)`}>
            {latestTickets.length === 0 ? (
              <EmptyState>Es liegen noch keine Vorgänge vor.</EmptyState>
            ) : (
              <ul className="divide-y divide-gray-100">
                {latestTickets.map((ticket) => (
                  <li key={ticket.id}>
                    <Link
                      href={`/vorgaenge/${ticket.id}`}
                      className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-gray-50"
                    >
                      <span>
                        <span className="block text-sm font-medium text-gray-900">
                          #{ticket.number} · {ticket.title}
                        </span>
                        <span className="block text-xs text-gray-500">
                          {ticketTypeLabels[ticket.type]} · {ticket.property.name}
                          {ticket.unit ? ` · ${ticket.unit.label}` : ""} ·{" "}
                          {formatDate(ticket.updatedAt)}
                        </span>
                      </span>
                      <StatusBadge status={ticket.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {user.role === "VERWALTER" ? <VerwalterStats /> : null}
          {user.role === "EIGENTUEMER" ? <EigentuemerObjekte userId={user.id} /> : null}
          {user.role === "MIETER" ? <MieterWohnung userId={user.id} /> : null}
        </div>

        <Card title="Aktuelle Aushänge">
          {announcements.length === 0 ? (
            <EmptyState>Keine Aushänge vorhanden.</EmptyState>
          ) : (
            <ul className="space-y-4">
              {announcements.map((a) => (
                <li key={a.id}>
                  <p className="text-sm font-medium text-gray-900">{a.title}</p>
                  <p className="text-xs text-gray-500">
                    {a.property.name} · {formatDate(a.createdAt)}
                  </p>
                  <p className="mt-1 line-clamp-3 text-sm text-gray-600">{a.body}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

async function VerwalterStats() {
  const [neu, inBearbeitung, beauftragt, objekte] = await Promise.all([
    db.ticket.count({ where: { status: "NEU" } }),
    db.ticket.count({ where: { status: "IN_BEARBEITUNG" } }),
    db.ticket.count({ where: { status: "BEAUFTRAGT" } }),
    db.property.count(),
  ]);
  const stats = [
    { label: "Neue Vorgänge", value: neu },
    { label: "In Bearbeitung", value: inBearbeitung },
    { label: "Beauftragt", value: beauftragt },
    { label: "Objekte", value: objekte },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-lg border border-gray-200 bg-white p-4 text-center shadow-sm"
        >
          <p className="text-2xl font-semibold text-gray-900">{s.value}</p>
          <p className="text-xs text-gray-500">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

async function EigentuemerObjekte({ userId }: { userId: string }) {
  const properties = await ownedProperties(userId);
  const counts = await Promise.all(
    properties.map((p) =>
      db.ticket.count({
        where: { propertyId: p.id, status: { notIn: ["ERLEDIGT", "GESCHLOSSEN"] } },
      })
    )
  );
  return (
    <Card title="Ihre Objekte">
      {properties.length === 0 ? (
        <EmptyState>Ihnen sind noch keine Objekte zugeordnet.</EmptyState>
      ) : (
        <ul className="divide-y divide-gray-100">
          {properties.map((p, i) => (
            <li key={p.id} className="flex items-center justify-between py-3">
              <span>
                <span className="block text-sm font-medium text-gray-900">{p.name}</span>
                <span className="block text-xs text-gray-500">
                  {p.street}, {p.zip} {p.city}
                </span>
              </span>
              <span className="text-sm text-gray-600">{counts[i]} offene Vorgänge</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

async function MieterWohnung({ userId }: { userId: string }) {
  const units = await tenantUnits(userId);
  return (
    <Card title="Ihre Wohnung">
      {units.length === 0 ? (
        <EmptyState>Ihnen ist noch keine Wohnung zugeordnet.</EmptyState>
      ) : (
        <ul className="space-y-2">
          {units.map((u) => (
            <li key={u.id} className="text-sm text-gray-700">
              <span className="font-medium text-gray-900">{u.label}</span>
              {u.floor ? ` (${u.floor})` : ""} · {u.property.name}, {u.property.street},{" "}
              {u.property.zip} {u.property.city}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
