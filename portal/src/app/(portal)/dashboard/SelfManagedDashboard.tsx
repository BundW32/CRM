import Link from "next/link";
import type { User } from "@/generated/prisma/client";
import { CountUp } from "@/components/count-up";
import { Card, EmptyState, PageTitle } from "@/components/ui";
import { announcementWhereForUser, ownedProperties, propertyWhereForVerwalter } from "@/lib/access";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/labels";

// WEG-fokussierte Übersicht für selbstverwaltete Gemeinschaften (interner
// Verwalter oder Eigentümer) – statt der professionellen Ticket-Statistik.
export async function SelfManagedDashboard({ user }: { user: User }) {
  const isAdmin = user.role === "VERWALTER";

  // WEG-Objekte des Nutzers bestimmen.
  const propIds = isAdmin
    ? (
        await db.property.findMany({
          where: { ...(await propertyWhereForVerwalter(user)), managementType: "WEG" },
          select: { id: true },
        })
      ).map((p) => p.id)
    : (await ownedProperties(user.id)).filter((p) => p.managementType === "WEG").map((p) => p.id);

  const now = new Date();
  const [openResolutions, nextMeeting, openMotions, announcements] = await Promise.all([
    db.resolution.count({ where: { propertyId: { in: propIds }, status: "OFFEN" } }),
    db.ownersMeeting.findFirst({
      where: { propertyId: { in: propIds }, status: { in: ["GEPLANT", "EINBERUFEN"] }, scheduledAt: { gte: now } },
      orderBy: { scheduledAt: "asc" },
      select: { id: true, title: true, scheduledAt: true },
    }),
    // Admin: eingereichte Anträge im Scope; Eigentümer: eigene offene Anträge.
    isAdmin
      ? db.ownerMotion.count({ where: { propertyId: { in: propIds }, status: "EINGEREICHT" } })
      : db.ownerMotion.count({ where: { submittedById: user.id, status: "EINGEREICHT" } }),
    db.announcement.findMany({
      where: await announcementWhereForUser(user),
      orderBy: { createdAt: "desc" },
      take: 3,
      include: { property: true },
    }),
  ]);

  const stats = [
    { label: "Offene Beschlüsse", value: openResolutions, href: "/beschluesse" },
    { label: isAdmin ? "Eingereichte Anträge" : "Meine offenen Anträge", value: openMotions, href: "/antraege" },
  ];

  return (
    <>
      <PageTitle>Willkommen, {user.name}</PageTitle>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md"
          >
            <span className="absolute inset-x-0 top-0 h-1 bg-brand-orange" />
            <p className="text-3xl font-bold tracking-tight text-brand-green"><CountUp value={s.value} /></p>
            <p className="mt-1 text-xs font-medium text-gray-500">{s.label}</p>
          </Link>
        ))}
        <Link
          href="/versammlungen"
          className="col-span-2 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Nächste Versammlung</p>
          {nextMeeting ? (
            <>
              <p className="mt-1 text-base font-semibold text-gray-900">{nextMeeting.title}</p>
              <p className="text-sm text-gray-500">{formatDate(nextMeeting.scheduledAt)}</p>
            </>
          ) : (
            <p className="mt-1 text-sm text-gray-400">Keine geplant</p>
          )}
        </Link>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card title="Schnellzugriff">
          <div className="flex flex-wrap gap-2 text-sm">
            <Link href="/beschluesse" className="rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50">Beschlüsse</Link>
            <Link href="/versammlungen" className="rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50">Versammlungen</Link>
            <Link href="/antraege" className="rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50">Anträge</Link>
            <Link href="/gemeinschaft" className="rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50">Gemeinschaft</Link>
            {isAdmin ? (
              <Link href="/verwaltung" className="rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50">WEG-Verwaltung</Link>
            ) : null}
          </div>
        </Card>

        <Card title="Aushänge">
          {announcements.length === 0 ? (
            <EmptyState>Keine aktuellen Aushänge.</EmptyState>
          ) : (
            <ul className="space-y-2">
              {announcements.map((a) => (
                <li key={a.id} className="border-b border-gray-50 pb-2 last:border-0">
                  <p className="text-sm font-medium text-gray-800">{a.title}</p>
                  <p className="text-xs text-gray-400">{a.property?.name} · {formatDate(a.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
