import Link from "next/link";
import type { MeterType } from "@/generated/prisma/client";
import { Alert, Card, EmptyState, PageTitle, buttonSecondaryClass } from "@/components/ui";
import { ownedProperties, propertyWhereForVerwalter, tenantUnits } from "@/lib/access";
import { db } from "@/lib/db";
import { formatDateOnly, meterTypeLabels } from "@/lib/labels";
import { requireUser } from "@/lib/session";
import { latestConsumptionInfo } from "@/lib/weg/consumption";

export const dynamic = "force-dynamic";

// Einheit je Zählerart (für die Anzeige des Verbrauchs).
const meterUnit: Record<MeterType, string> = {
  STROM: "kWh",
  GAS: "m³",
  WASSER_KALT: "m³",
  WASSER_WARM: "m³",
  HEIZUNG: "Einh.",
  SONSTIGES: "Einh.",
};

function fmt(n: number): string {
  return n.toLocaleString("de-DE", { maximumFractionDigits: 2 });
}

function DeltaBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs text-gray-400">–</span>;
  const tone = pct > 0 ? "text-red-600" : pct < 0 ? "text-green-600" : "text-gray-500";
  const sign = pct > 0 ? "+" : "";
  return <span className={`text-xs font-semibold ${tone}`}>{sign}{pct} %</span>;
}

// Unterjährige Verbrauchsinformation (§ 6a HeizkostenV) im Portal. Zeigt je
// zugänglichem Zähler den Verbrauch der jüngsten Periode und den Vergleich mit
// Vorperiode und Vorjahresperiode. Zugriff wie im Zählerbereich.
export default async function VerbrauchPage() {
  const user = await requireUser();
  const isVerwalter = user.role === "VERWALTER";
  const isMieter = user.role === "MIETER";

  let meterWhere = {};
  if (isMieter) {
    const myUnits = await tenantUnits(user.id);
    meterWhere = { unitId: { in: myUnits.map((u) => u.id) } };
  } else if (isVerwalter) {
    const where = await propertyWhereForVerwalter(user);
    meterWhere = { OR: [{ property: where ?? {} }, { unit: { property: where ?? {} } }] };
  } else {
    const props = await ownedProperties(user.id);
    const ids = props.map((p) => p.id);
    meterWhere = { OR: [{ propertyId: { in: ids } }, { unit: { propertyId: { in: ids } } }] };
  }

  const meters = await db.meter.findMany({
    where: meterWhere,
    orderBy: [{ remoteReadable: "desc" }, { createdAt: "asc" }],
    include: {
      unit: { include: { property: { select: { name: true } } } },
      property: { select: { name: true } },
      readings: { orderBy: { readingDate: "asc" }, select: { value: true, readingDate: true } },
    },
  });

  const rows = meters.map((m) => ({
    meter: m,
    info: latestConsumptionInfo(
      m.readings.map((r) => ({ value: r.value, date: r.readingDate })),
    ),
    place: m.unit
      ? `${m.unit.property.name} – ${m.unit.label}`
      : `${m.property?.name ?? "Objekt"} – Allgemein`,
  }));
  const hasRemote = rows.some((r) => r.meter.remoteReadable);

  return (
    <>
      <PageTitle
        action={
          <Link href="/zaehler" className={buttonSecondaryClass}>
            Zählerstände erfassen
          </Link>
        }
      >
        Verbrauchsinformation
      </PageTitle>

      <p className="mb-4 max-w-3xl text-sm text-gray-300">
        Unterjährige Verbrauchsinformation nach § 6a HeizkostenV: der Verbrauch der
        jüngsten erfassten Periode im Vergleich zur Vorperiode und zum Vorjahr. Für
        fernablesbare Zähler ist die monatliche Information verpflichtend.
      </p>

      {hasRemote ? (
        <Alert variant="info" className="mb-4">
          Fernablesbare Zähler sind mit „Fernablesbar&ldquo; gekennzeichnet — hier besteht die
          monatliche Informationspflicht.
        </Alert>
      ) : null}

      {rows.length === 0 ? (
        <Card>
          <EmptyState>Keine Zähler hinterlegt.</EmptyState>
        </Card>
      ) : (
        <div className="grid gap-3">
          {rows.map(({ meter, info, place }) => (
            <Card key={meter.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {meterTypeLabels[meter.type]}
                    {meter.remoteReadable ? (
                      <span className="ml-2 rounded-full bg-brand-orange-light px-2 py-0.5 text-xs text-brand-orange-dark">
                        Fernablesbar
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-gray-500">
                    {place}
                    {meter.meterNumber ? ` · Nr. ${meter.meterNumber}` : ""}
                    {meter.location ? ` · ${meter.location}` : ""}
                  </p>
                </div>
              </div>

              {info === null ? (
                <p className="mt-3 text-sm text-gray-500">
                  Noch nicht genügend Zählerstände für eine Verbrauchsangabe (mindestens zwei
                  Ablesungen nötig).
                </p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[420px] text-sm">
                    <tbody>
                      <tr className="border-b border-gray-100">
                        <td className="py-2 text-gray-600">
                          Aktuelle Periode ({formatDateOnly(info.latest.from)} –{" "}
                          {formatDateOnly(info.latest.to)})
                        </td>
                        <td className="py-2 text-right font-semibold text-gray-900">
                          {fmt(info.latest.consumption)} {meterUnit[meter.type]}
                        </td>
                      </tr>
                      <tr className="border-b border-gray-100">
                        <td className="py-2 text-gray-600">
                          Vorperiode
                          {info.previous
                            ? ` (${fmt(info.previous.consumption)} ${meterUnit[meter.type]})`
                            : ""}
                        </td>
                        <td className="py-2 text-right">
                          <DeltaBadge pct={info.deltaPreviousPct} />
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 text-gray-600">
                          Vorjahr
                          {info.sameLastYear
                            ? ` (${fmt(info.sameLastYear.consumption)} ${meterUnit[meter.type]})`
                            : ""}
                        </td>
                        <td className="py-2 text-right">
                          <DeltaBadge pct={info.deltaYearPct} />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
