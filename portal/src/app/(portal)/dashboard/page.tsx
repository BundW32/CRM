import Link from "next/link";
import type { User } from "@/generated/prisma/client";
import { CountUp } from "@/components/count-up";
import { PropertyStats } from "@/components/property-stats";
import { Card, EmptyState, PageTitle, StatusBadge, buttonClass } from "@/components/ui";
import {
  announcementWhereForUser,
  noteWhereForVerwalter,
  ownedProperties,
  propertyIdsForVerwalter,
  propertyWhereForVerwalter,
  tenantUnits,
  ticketWhereForUser,
} from "@/lib/access";
import { db } from "@/lib/db";
import { formatDate, ticketTypeLabels } from "@/lib/labels";
import { getOrganization, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();

  // SuperAdmins, deren Mandant noch kein Branding (Farbe/Logo) gesetzt hat,
  // bekommen einen Hinweis-Banner zum Onboarding.
  const org = user.isSuperAdmin ? await getOrganization() : null;
  const brandingIncomplete = Boolean(org && !org.primaryColor && !org.logoStoredName);

  const ticketWhere = await ticketWhereForUser(user);
  const [openTickets, latestTickets, announcements, pinnedNotes] = await Promise.all([
    db.ticket.count({
      where: { ...ticketWhere, status: { notIn: ["ERLEDIGT", "GESCHLOSSEN"] } },
    }),
    db.ticket.findMany({
      where: { ...ticketWhere, status: { not: "GESCHLOSSEN" } },
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
    user.role === "VERWALTER"
      ? db.note.findMany({
          where: { AND: [{ pinned: true }, await noteWhereForVerwalter(user)] },
          orderBy: { updatedAt: "desc" },
          take: 3,
          include: {
            property: true,
            unit: { include: { property: true } },
            targetUser: true,
          },
        })
      : Promise.resolve([]),
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

      {brandingIncomplete ? (
        <Link
          href="/onboarding"
          className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-brand-orange/40 bg-brand-orange-light px-4 py-3 transition hover:shadow-md"
        >
          <span className="text-sm text-brand-green">
            <span className="font-semibold">Portal einrichten:</span> Hinterlegen Sie Logo,
            Farbe und Impressum Ihrer Hausverwaltung.
          </span>
          <span className="shrink-0 text-sm font-medium text-brand-orange-dark">
            Jetzt einrichten →
          </span>
        </Link>
      ) : null}

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
                      className="flex flex-wrap items-center justify-between gap-2 py-3 transition-all hover:bg-gray-50 hover:-translate-y-px"
                    >
                      <span>
                        <span className="block text-sm font-medium text-gray-900">
                          #{ticket.number} · {ticket.title}
                        </span>
                        <span className="block text-xs text-gray-500">
                          {ticketTypeLabels[ticket.type]} ·{" "}
                          {ticket.property ? ticket.property.name : "nicht zugeordnet"}
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

          {user.role === "VERWALTER" ? <VerwalterStats user={user} /> : null}
          {user.role === "VERWALTER" ? <WartungReminder user={user} /> : null}
          {user.role === "MIETER" ? <MieterWohnung userId={user.id} /> : null}
        </div>

        <div className="space-y-5">
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

          {user.role === "VERWALTER" ? (
            <Card title="Pinnwand">
              {pinnedNotes.length === 0 ? (
                <EmptyState>Keine gepinnten Notizen.</EmptyState>
              ) : (
                <ul className="space-y-3">
                  {pinnedNotes.map((note) => {
                    const contextLabel = note.property
                      ? note.property.name
                      : note.unit
                        ? `${note.unit.label} · ${note.unit.property.name}`
                        : note.targetUser
                          ? note.targetUser.name
                          : null;
                    return (
                      <li key={note.id}>
                        <p className="line-clamp-3 text-sm text-gray-900">{note.body}</p>
                        {contextLabel ? (
                          <p className="mt-0.5 text-xs text-gray-400">{contextLabel}</p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
              <Link
                href="/verwaltung/notizen"
                className="mt-3 inline-block text-sm text-brand-green hover:underline"
              >
                Alle Notizen →
              </Link>
            </Card>
          ) : null}
        </div>
      </div>

      {user.role === "VERWALTER" || user.role === "EIGENTUEMER" ? (
        <StatistikSection user={user} />
      ) : null}
    </>
  );
}

async function StatistikSection({ user }: { user: User }) {
  const properties =
    user.role === "VERWALTER"
      ? await db.property.findMany({ where: await propertyWhereForVerwalter(user), orderBy: { name: "asc" } })
      : await ownedProperties(user.id);
  if (properties.length === 0) return null;
  return (
    <div className="mt-6 space-y-5">
      <h2 className="text-lg font-bold tracking-tight text-white">Statistiken</h2>
      {properties.map((p) => (
        <PropertyStats
          key={p.id}
          propertyId={p.id}
          name={`${p.name} · ${p.street}, ${p.zip} ${p.city}`}
        />
      ))}
    </div>
  );
}

async function VerwalterStats({ user }: { user: User }) {
  const ticketWhere = await ticketWhereForUser(user);
  const propWhere = await propertyWhereForVerwalter(user);
  const [neu, inBearbeitung, beauftragt, objekte] = await Promise.all([
    db.ticket.count({ where: { ...ticketWhere, status: "NEU" } }),
    db.ticket.count({ where: { ...ticketWhere, status: "IN_BEARBEITUNG" } }),
    db.ticket.count({ where: { ...ticketWhere, status: "BEAUFTRAGT" } }),
    db.property.count({ where: propWhere }),
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
          className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
        >
          <span className="absolute inset-x-0 top-0 h-1 bg-brand-orange" />
          <p className="text-3xl font-bold tracking-tight text-brand-green"><CountUp value={s.value} /></p>
          <p className="mt-1 text-xs font-medium text-gray-500">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

async function WartungReminder({ user }: { user: User }) {
  const soon = new Date();
  soon.setDate(soon.getDate() + 14);
  const assignedIds = await propertyIdsForVerwalter(user);
  const taskWhere =
    assignedIds === null
      ? { active: true, dueDate: { lte: soon }, organizationId: user.organizationId }
      : { active: true, dueDate: { lte: soon }, property: { id: { in: assignedIds } } };
  const tasks = await db.maintenanceTask.findMany({
    where: taskWhere,
    orderBy: { dueDate: "asc" },
    take: 6,
    include: { property: true },
  });
  if (tasks.length === 0) return null;
  const now = new Date().getTime();
  return (
    <Card title="Fällige Wartungen">
      <ul className="divide-y divide-gray-100">
        {tasks.map((t) => {
          const overdue = t.dueDate.getTime() < now;
          return (
            <li key={t.id} className="flex items-center justify-between py-2">
              <span>
                <span className="block text-sm font-medium text-gray-900">{t.title}</span>
                <span className="block text-xs text-gray-500">
                  {t.property ? `${t.property.name} · ` : ""}
                  fällig am {formatDate(t.dueDate)}
                </span>
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  overdue ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-800"
                }`}
              >
                {overdue ? "überfällig" : "bald fällig"}
              </span>
            </li>
          );
        })}
      </ul>
      <Link
        href="/verwaltung/wartung"
        className="mt-3 inline-block text-sm text-brand-green hover:underline"
      >
        Alle Wartungen ansehen →
      </Link>
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
