import { redirect } from "next/navigation";
import { Card, EmptyState, PageTitle } from "@/components/ui";
import { ownedProperties } from "@/lib/access";
import { db } from "@/lib/db";
import { ticketStatusLabels, tradeLabels } from "@/lib/labels";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function StatisticsPage() {
  const user = await requireUser();
  if (user.role !== "EIGENTUEMER" && user.role !== "VERWALTER") {
    redirect("/dashboard");
  }

  const properties =
    user.role === "VERWALTER"
      ? await db.property.findMany({ orderBy: { name: "asc" } })
      : await ownedProperties(user.id);

  return (
    <>
      <PageTitle>Statistiken</PageTitle>
      {properties.length === 0 ? (
        <EmptyState>Keine Objekte vorhanden.</EmptyState>
      ) : (
        <div className="space-y-5">
          {properties.map((p) => (
            <PropertyStats key={p.id} propertyId={p.id} name={`${p.name} · ${p.street}, ${p.zip} ${p.city}`} />
          ))}
        </div>
      )}
    </>
  );
}

async function PropertyStats({ propertyId, name }: { propertyId: string; name: string }) {
  const [unitCount, activeTenancies, openTickets, byStatus, byTrade, resolved] =
    await Promise.all([
      db.unit.count({ where: { propertyId } }),
      db.tenancy.count({ where: { active: true, unit: { propertyId } } }),
      db.ticket.count({
        where: { propertyId, status: { notIn: ["ERLEDIGT", "GESCHLOSSEN"] } },
      }),
      db.ticket.groupBy({
        by: ["status"],
        where: { propertyId },
        _count: { _all: true },
      }),
      db.ticket.groupBy({
        by: ["trade"],
        where: { propertyId, trade: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { trade: "desc" } },
        take: 5,
      }),
      db.ticket.findMany({
        where: { propertyId, status: { in: ["ERLEDIGT", "GESCHLOSSEN"] } },
        select: { createdAt: true, updatedAt: true },
      }),
    ]);

  const totalTickets = byStatus.reduce((sum, s) => sum + s._count._all, 0);
  const occupancy = unitCount > 0 ? Math.round((activeTenancies / unitCount) * 100) : null;
  const avgDays =
    resolved.length > 0
      ? (
          resolved.reduce(
            (sum, t) => sum + (t.updatedAt.getTime() - t.createdAt.getTime()),
            0
          ) /
          resolved.length /
          (1000 * 60 * 60 * 24)
        ).toFixed(1)
      : null;

  const kpis = [
    { label: "Einheiten", value: String(unitCount) },
    {
      label: "Vermietungsquote",
      value: occupancy !== null ? `${occupancy} %` : "–",
    },
    { label: "Offene Vorgänge", value: String(openTickets) },
    { label: "Vorgänge gesamt", value: String(totalTickets) },
    {
      label: "Ø Bearbeitungszeit",
      value: avgDays !== null ? `${avgDays} Tage` : "–",
    },
  ];

  return (
    <Card title={name}>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-md bg-gray-50 p-3 text-center">
            <p className="text-xl font-semibold text-gray-900">{k.value}</p>
            <p className="text-xs text-gray-500">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-medium text-gray-700">
            Vorgänge nach Status
          </h3>
          {totalTickets === 0 ? (
            <p className="text-sm text-gray-500">Noch keine Vorgänge.</p>
          ) : (
            <ul className="space-y-2">
              {byStatus.map((s) => (
                <Bar
                  key={s.status}
                  label={ticketStatusLabels[s.status]}
                  value={s._count._all}
                  max={totalTickets}
                />
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="mb-2 text-sm font-medium text-gray-700">
            Häufigste Schadenskategorien
          </h3>
          {byTrade.length === 0 ? (
            <p className="text-sm text-gray-500">Noch keine kategorisierten Vorgänge.</p>
          ) : (
            <ul className="space-y-2">
              {byTrade.map((c) => (
                <Bar
                  key={c.trade ?? "unbekannt"}
                  label={c.trade ? tradeLabels[c.trade] : "Sonstiges"}
                  value={c._count._all}
                  max={byTrade[0]._count._all}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const width = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <li className="text-sm">
      <div className="mb-0.5 flex justify-between text-gray-600">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100">
        <div
          className="h-2 rounded-full bg-brand-green"
          style={{ width: `${width}%` }}
        />
      </div>
    </li>
  );
}
