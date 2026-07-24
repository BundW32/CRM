import Link from "next/link";
import { Building2, ClipboardCheck, Clock, Home, Inbox, Megaphone, Pin } from "lucide-react";
import type { User } from "@/generated/prisma/client";
import { PropertyStats } from "@/components/property-stats";
import { StatTile } from "@/components/stat-tile";
import { Alert, Card, EmptyState, PageTitle, StatusBadge, buttonClass } from "@/components/ui";
import {
  announcementWhereForUser,
  isSelfManaged,
  noteWhereForVerwalter,
  ownedProperties,
  propertyIdsForVerwalter,
  propertyWhereForVerwalter,
  tenantUnits,
  ticketWhereForUser,
} from "@/lib/access";
import { db } from "@/lib/db";
import { formatDate, ticketTypeLabels, unitPublicLabel } from "@/lib/labels";
import { getOrganization, requireUser } from "@/lib/session";
import { resendVerification } from "./verify-actions";
import { SelfManagedDashboard } from "./SelfManagedDashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ verify?: string }>;
}) {
  const user = await requireUser();
  const { verify } = await searchParams;
  const org = await getOrganization();

  // Selbstverwaltete WEG: eigene WEG-Übersicht statt der Ticket-Statistik.
  if (isSelfManaged(org) && (user.role === "VERWALTER" || user.role === "EIGENTUEMER")) {
    return <SelfManagedDashboard user={user} />;
  }

  // SuperAdmins, deren Mandant noch kein Branding (Farbe/Logo) gesetzt hat,
  // bekommen einen Hinweis-Banner zum Onboarding.
  const brandingIncomplete = Boolean(
    user.isSuperAdmin && org && !org.primaryColor && !org.logoStoredName,
  );
  // Hinweis auf ausstehende E-Mail-Bestätigung (Self-Service-Registrierung).
  const emailUnverified = Boolean(user.email && !user.emailVerifiedAt);

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

      {verify === "gesendet" ? (
        <div className="mb-4">
          <Alert variant="success">
            Bestätigungs-E-Mail gesendet. Bitte prüfen Sie Ihr Postfach.
          </Alert>
        </div>
      ) : null}

      {emailUnverified ? (
        <div className="mb-5">
          <Alert
            variant="warning"
            title="E-Mail bestätigen:"
            action={
              <form action={resendVerification}>
                <button
                  type="submit"
                  className="shrink-0 rounded-lg border border-amber-400 px-3 py-1.5 text-sm font-medium text-amber-900 transition hover:bg-amber-100"
                >
                  Erneut senden
                </button>
              </form>
            }
          >
            Wir haben Ihnen einen Bestätigungslink an {user.email} geschickt.
          </Alert>
        </div>
      ) : null}

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

      {/* Kennzahlen zuerst – der Verwalter erfasst den Zustand auf einen Blick. */}
      {user.role === "VERWALTER" ? <VerwalterStats user={user} /> : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title={`Aktuelle Vorgänge (${openTickets} offen)`}>
            {latestTickets.length === 0 ? (
              <EmptyState icon={<Inbox className="h-5 w-5" />}>
                Es liegen noch keine Vorgänge vor.
              </EmptyState>
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

          {user.role === "VERWALTER" ? <WartungReminder user={user} /> : null}
          {user.role === "MIETER" ? <MieterWohnung userId={user.id} /> : null}
        </div>

        <div className="space-y-5">
          <Card title="Aktuelle Aushänge">
            {announcements.length === 0 ? (
              <EmptyState icon={<Megaphone className="h-5 w-5" />}>
                Keine Aushänge vorhanden.
              </EmptyState>
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
                <EmptyState icon={<Pin className="h-5 w-5" />}>Keine gepinnten Notizen.</EmptyState>
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
        <div key={p.id} className="space-y-2">
          {p.titleImageStoredName ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/files/property-image/${p.id}`}
              alt=""
              className="h-36 w-full rounded-xl object-cover"
            />
          ) : null}
          <PropertyStats propertyId={p.id} name={`${p.name} · ${p.street}, ${p.zip} ${p.city}`} />
        </div>
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
  const iconClass = "h-[18px] w-[18px]";
  const stats = [
    { label: "Neue Vorgänge", value: neu, icon: <Inbox className={iconClass} />, href: "/vorgaenge?status=NEU" },
    { label: "In Bearbeitung", value: inBearbeitung, icon: <Clock className={iconClass} />, href: "/vorgaenge?status=IN_BEARBEITUNG" },
    { label: "Beauftragt", value: beauftragt, icon: <ClipboardCheck className={iconClass} />, href: "/vorgaenge?status=BEAUFTRAGT" },
    { label: "Objekte", value: objekte, icon: <Building2 className={iconClass} /> },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {stats.map((s) => (
        <StatTile key={s.label} label={s.label} value={s.value} icon={s.icon} href={s.href} />
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
        <EmptyState icon={<Home className="h-5 w-5" />}>
          Ihnen ist noch keine Wohnung zugeordnet.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {units.map((u) => (
            <li key={u.id} className="flex items-center gap-3 text-sm text-gray-700">
              {u.property.titleImageStoredName ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/files/property-image/${u.propertyId}`}
                  alt=""
                  className="h-12 w-12 flex-shrink-0 rounded-lg object-cover"
                />
              ) : null}
              <span>
                <span className="font-medium text-gray-900">{unitPublicLabel(u)}</span>
                {u.floor ? ` (${u.floor})` : ""} · {u.property.name}, {u.property.street},{" "}
                {u.property.zip} {u.property.city}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
