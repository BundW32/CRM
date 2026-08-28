import Link from "next/link";
import type { MeterType, Prisma } from "@/generated/prisma/client";
import { Alert, Card, EmptyState, PageTitle, Pagination, buttonSecondaryClass } from "@/components/ui";
import { FilterBar, type FilterConfig } from "@/components/filter-bar";
import { ownedProperties, propertyWhereForVerwalter, tenantUnits } from "@/lib/access";
import { db } from "@/lib/db";
import { formatDateOnly, meterTypeLabels } from "@/lib/labels";
import { mitFreitext } from "@/lib/sonstiges";
import { optionsFrom, propertyScopeFilters } from "@/lib/list-filters";
import { normalizeSearch, parsePage, pageHrefFor } from "@/lib/list-query";
import { requireUser } from "@/lib/session";
import { latestConsumptionInfo } from "@/lib/weg/consumption";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

// Ablesungen je Zähler begrenzen. Die Auswertung braucht die jüngste Periode,
// die Vorperiode UND die Periode von vor ~einem Jahr – die letzten drei Stände
// reichen also nicht. 400 jüngste Stände decken monatliche Ablesung (die nach
// § 6a HeizkostenV maximal geforderte Taktung) über 30 Jahre ab; bei selteneren
// Ablesungen greift die Grenze ohnehin nie. Vorher wurden ALLE Stände ALLER
// Zähler geladen – das wuchs mit jedem Jahr Betrieb.
const READINGS_PER_METER = 400;

// Einheit je Zählerart (für die Anzeige des Verbrauchs).
const meterUnit: Record<MeterType, string> = {
  STROM: "kWh",
  GAS: "m³",
  WASSER_KALT: "m³",
  WASSER_WARM: "m³",
  HEIZUNG: "Einh.",
  WAERMEMENGE: "kWh",
  ABWASSER: "m³",
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
export default async function VerbrauchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const currentPage = parsePage(sp.page);
  const isVerwalter = user.role === "VERWALTER";
  const isMieter = user.role === "MIETER";

  let accessWhere: Prisma.MeterWhereInput = {};
  if (isMieter) {
    const myUnits = await tenantUnits(user.id);
    accessWhere = { unitId: { in: myUnits.map((u) => u.id) } };
  } else if (isVerwalter) {
    const where = await propertyWhereForVerwalter(user);
    accessWhere = { OR: [{ property: where ?? {} }, { unit: { property: where ?? {} } }] };
  } else {
    const props = await ownedProperties(user.id);
    const ids = props.map((p) => p.id);
    accessWhere = { OR: [{ propertyId: { in: ids } }, { unit: { propertyId: { in: ids } } }] };
  }

  // ── Filter: Suche, Zählerart, Objekt → Einheit (verengt nur den Zugriff) ──
  const scope = await propertyScopeFilters(user, sp, { withUnit: true });
  const q = normalizeSearch(sp.q);
  const art = sp.art && sp.art in meterTypeLabels ? sp.art : undefined;

  const meterAnd: Prisma.MeterWhereInput[] = [accessWhere];
  if (q) {
    meterAnd.push({
      OR: [
        { meterNumber: { contains: q, mode: "insensitive" } },
        { location: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  if (art) meterAnd.push({ type: art as Prisma.MeterWhereInput["type"] });
  if (scope.objektId) {
    meterAnd.push({
      OR: [{ propertyId: scope.objektId }, { unit: { propertyId: scope.objektId } }],
    });
  }
  if (scope.einheitId) meterAnd.push({ unitId: scope.einheitId });
  const meterWhere: Prisma.MeterWhereInput = { AND: meterAnd };
  const hasFilter = Boolean(q || art || scope.active);

  const [total, meters] = await Promise.all([
    db.meter.count({ where: meterWhere }),
    db.meter.findMany({
      where: meterWhere,
      orderBy: [{ remoteReadable: "desc" }, { createdAt: "asc" }],
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        unit: { include: { property: { select: { name: true } } } },
        property: { select: { name: true } },
        // Absteigend + begrenzt: liefert die JÜNGSTEN Stände. Die Auswertung
        // sortiert intern selbst, die Reihenfolge hier ist also unkritisch.
        readings: {
          orderBy: { readingDate: "desc" },
          take: READINGS_PER_METER,
          select: { value: true, readingDate: true },
        },
      },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const pageHref = pageHrefFor(`/verbrauch`, sp);

  const meterFilters: FilterConfig[] = [
    {
      key: "art",
      label: "Zählerart",
      allLabel: "Alle Arten",
      primary: true,
      options: optionsFrom(meterTypeLabels),
    },
  ];

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

      <FilterBar
        searchPlaceholder="Suchen"
        searchHint="Nach Zählernummer oder Einbauort suchen"
        filters={meterFilters}
        comboboxes={scope.comboboxes}
      />
      <p className="mb-3 mt-2 px-1 text-xs text-gray-400">
        {total} {total === 1 ? "Zähler" : "Zähler"}
        {hasFilter ? " (gefiltert)" : ""}
      </p>

      {rows.length === 0 ? (
        <Card>
          <EmptyState>
            {hasFilter ? "Keine Zähler gefunden." : "Keine Zähler hinterlegt."}
          </EmptyState>
        </Card>
      ) : (
        <div className="grid gap-3">
          {rows.map(({ meter, info, place }) => (
            <Card key={meter.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {mitFreitext(meterTypeLabels[meter.type], meter.typeOther)}
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

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        total={total}
        itemLabel="Zähler"
        hrefFor={pageHref}
      />
    </>
  );
}
