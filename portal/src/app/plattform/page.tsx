import Link from "next/link";
import { CountUp } from "@/components/count-up";
import { PageTitle } from "@/components/ui";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platform";

export const dynamic = "force-dynamic";

const tiles = [
  { href: "/plattform/organisationen", title: "Verwaltungen", desc: "Alle registrierten Kunden – Stammdaten, Nutzung, Tarif, Aktionen" },
  { href: "/plattform/rechnungen", title: "Rechnungen", desc: "Rechnungen erstellen, als PDF exportieren und Zahlungen erfassen" },
  { href: "/plattform/statistik", title: "Auswertungen", desc: "Neuanmeldungen & Umsatz im Zeitverlauf, CSV-/DATEV-Export" },
  { href: "/plattform/audit", title: "Audit-Log", desc: "Sicherheitsrelevante Ereignisse mandantenübergreifend" },
];

export default async function PlattformDashboard() {
  await requirePlatformAdmin();

  const now = new Date();
  const days = (n: number) => new Date(now.getTime() - n * 86_400_000);

  const [
    orgsTotal,
    orgsActive,
    trialsExpired,
    signups7,
    signups30,
    usersTotal,
    usersByRole,
    properties,
    units,
    statusGroups,
  ] = await Promise.all([
    db.organization.count(),
    db.organization.count({ where: { active: true } }),
    db.organization.count({ where: { subscriptionStatus: "trialing", trialEndsAt: { lt: now } } }),
    db.organization.count({ where: { createdAt: { gte: days(7) } } }),
    db.organization.count({ where: { createdAt: { gte: days(30) } } }),
    db.user.count(),
    db.user.groupBy({ by: ["role"], _count: { _all: true } }),
    db.property.count(),
    db.unit.count(),
    db.organization.groupBy({ by: ["subscriptionStatus"], _count: { _all: true } }),
  ]);

  const kpis = [
    { label: "Verwaltungen", value: orgsTotal },
    { label: "davon aktiv", value: orgsActive },
    { label: "Trials abgelaufen", value: trialsExpired, warn: trialsExpired > 0 },
    { label: "Neu (7 Tage)", value: signups7 },
    { label: "Neu (30 Tage)", value: signups30 },
    { label: "Nutzer gesamt", value: usersTotal },
    { label: "Objekte", value: properties },
    { label: "Einheiten", value: units },
  ];

  const roleCount = (role: string) =>
    usersByRole.find((r) => r.role === role)?._count._all ?? 0;

  return (
    <>
      <PageTitle>Plattform-Übersicht</PageTitle>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <span
              className={`absolute inset-x-0 top-0 h-1 ${k.warn ? "bg-red-500" : "bg-brand-orange"}`}
            />
            <p className={`text-3xl font-bold tracking-tight ${k.warn ? "text-red-600" : "text-brand-green"}`}>
              <CountUp value={k.value} />
            </p>
            <p className="mt-1 text-xs font-medium text-gray-500">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Abo-Status-Verteilung + Rollen */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Abo-Status</h2>
          <ul className="space-y-1 text-sm text-gray-600">
            {statusGroups.length === 0 ? (
              <li className="text-gray-400">Noch keine Verwaltungen.</li>
            ) : (
              statusGroups.map((s) => (
                <li key={s.subscriptionStatus} className="flex justify-between">
                  <span>{s.subscriptionStatus}</span>
                  <span className="font-medium text-gray-800">{s._count._all}</span>
                </li>
              ))
            )}
          </ul>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Nutzer nach Rolle</h2>
          <ul className="space-y-1 text-sm text-gray-600">
            {(["VERWALTER", "EIGENTUEMER", "MIETER", "HANDWERKER"] as const).map((role) => (
              <li key={role} className="flex justify-between">
                <span>{role}</span>
                <span className="font-medium text-gray-800">{roleCount(role)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">{t.title}</h2>
              <span className="text-gray-300 transition group-hover:text-brand-orange">→</span>
            </div>
            <p className="mt-1 text-sm text-gray-600">{t.desc}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
