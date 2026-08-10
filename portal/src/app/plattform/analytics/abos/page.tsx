import { Suspense } from "react";
import { BarChart } from "@/components/bar-chart";
import { DataTable, KeyFigure, KeyFigures } from "@/components/data-display";
import { Card, EmptyState, cardSurfaceClass } from "@/components/ui";
import { churnQuote, formatProzent } from "@/lib/analytics/business";
import { vergleichsText } from "@/lib/analytics/first-party";
import { type Zeitraum, parseZeitraum } from "@/lib/analytics/zeitraum";
import { db } from "@/lib/db";
import { formatCents, requirePlatformAdmin } from "@/lib/platform";
import { lastNMonths, monthKey } from "@/lib/platform-stats";
import { AnalyticsShell } from "../analytics-shell";

export const dynamic = "force-dynamic";

const TAG_MS = 86_400_000;
const TAG_LABEL = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
});

// Jüngster Tagesstand bis einschließlich `bis` — der Bestand (MRR, Abos)
// ist ein Schnappschuss, für Vergleiche zählt der letzte bekannte Stand.
function letzterStand(bis: Date) {
  return db.businessDaily.findFirst({
    where: { date: { lte: bis } },
    orderBy: { date: "desc" },
  });
}

async function AboDaten({ zeitraum }: { zeitraum: Zeitraum }) {
  const [reihe, vorReihe, stand, vorStand, standZuBeginn, orgs] = await Promise.all([
    db.businessDaily.findMany({
      where: { date: { gte: zeitraum.von, lte: zeitraum.bis } },
      orderBy: { date: "asc" },
    }),
    db.businessDaily.findMany({
      where: { date: { gte: zeitraum.vorVon, lte: zeitraum.vorBis } },
      select: { newSubs: true, canceledSubs: true, signups: true },
    }),
    letzterStand(zeitraum.bis),
    letzterStand(zeitraum.vorBis),
    letzterStand(new Date(zeitraum.von.getTime() - TAG_MS)),
    db.organization.findMany({ select: { createdAt: true, subscriptionStatus: true } }),
  ]);

  const summe = (rows: { newSubs: number; canceledSubs: number; signups: number }[]) => ({
    newSubs: rows.reduce((s, r) => s + r.newSubs, 0),
    canceledSubs: rows.reduce((s, r) => s + r.canceledSubs, 0),
    signups: rows.reduce((s, r) => s + r.signups, 0),
  });
  const s = summe(reihe);
  const vor = summe(vorReihe);
  const churn = churnQuote(s.canceledSubs, standZuBeginn?.activeSubs ?? 0);

  // Kohorten: Registrierungsmonat → wie viele davon haben HEUTE ein aktives
  // Abo. Eine echte Verlaufs-Kohorte (Abo nach 30/60/90 Tagen) braucht
  // Historie, die erst mit den BusinessDaily-Tagen entsteht — der heutige
  // Stand beantwortet die Kernfrage „welcher Jahrgang konvertiert".
  const monate = lastNMonths(new Date(), 12);
  const kohorten = monate.map((m) => {
    const imMonat = orgs.filter((o) => monthKey(o.createdAt) === m.key);
    const aktiv = imMonat.filter((o) => o.subscriptionStatus === "active").length;
    return { monat: m.label, registriert: imMonat.length, aktiv };
  });

  const chart = (wert: (r: (typeof reihe)[number]) => number) =>
    reihe.map((r) => ({ label: TAG_LABEL.format(r.date), value: wert(r) }));

  return (
    <div className="space-y-5">
      <Card title="Kennzahlen — alle Beträge brutto inkl. 19 % USt.">
        <KeyFigures>
          <KeyFigure
            label="MRR (brutto)"
            value={stand ? formatCents(stand.mrrCents) : "–"}
            hint={
              stand && vorStand
                ? (vergleichsText(stand.mrrCents, vorStand.mrrCents) ?? "unverändert")
                : "Stand: noch kein Ingest-Lauf"
            }
          />
          <KeyFigure
            label="Aktive Abos"
            value={stand?.activeSubs ?? "–"}
            hint={stand ? `dazu ${stand.activeTrials} laufende Testphasen` : undefined}
          />
          <KeyFigure
            label="Neue Abos"
            value={s.newSubs}
            hint={vergleichsText(s.newSubs, vor.newSubs) ?? "im gewählten Zeitraum"}
          />
          <KeyFigure
            label="Gekündigte Abos"
            value={s.canceledSubs}
            hint={vergleichsText(s.canceledSubs, vor.canceledSubs) ?? "im gewählten Zeitraum"}
          />
          <KeyFigure
            label="Churn-Quote"
            value={churn == null ? "–" : formatProzent(churn)}
            hint="Kündigungen ÷ Bestand zu Beginn"
          />
          <KeyFigure
            label="Einheiten · Stellplätze"
            value={stand ? `${stand.billedUnits} · ${stand.billedStellplaetze}` : "–"}
            hint="abgerechnet, Stand des jüngsten Laufs"
          />
        </KeyFigures>
      </Card>

      {reihe.length === 0 ? (
        <Card title="Noch keine Tageswerte">
          <EmptyState>
            Für den gewählten Zeitraum liegen keine BusinessDaily-Zeilen vor.
            Der stündliche Ingest füllt sie ab jetzt; unter System lässt er
            sich sofort anstoßen (Re-Sync bei „Geschäftszahlen“).
          </EmptyState>
        </Card>
      ) : (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="MRR-Verlauf (brutto)">
              <BarChart data={chart((r) => r.mrrCents)} formatValue={(v) => formatCents(v)} />
            </Card>
            <Card title="Aktive Abos je Tag">
              <BarChart data={chart((r) => r.activeSubs)} barClass="bg-brand-green" />
            </Card>
            <Card title="Registrierungen je Tag">
              <BarChart data={chart((r) => r.signups)} />
            </Card>
            <Card title="Abgerechnete Einheiten je Tag">
              <BarChart data={chart((r) => r.billedUnits)} barClass="bg-brand-green" />
            </Card>
          </div>
        </>
      )}

      <Card title="Kohorten nach Registrierungsmonat">
        <DataTable
          caption="Registrierungen je Monat und wie viele davon heute ein aktives Abo haben"
          rows={kohorten}
          getKey={(k) => k.monat}
          minWidth="28rem"
          columns={[
            { header: "Monat", cell: (k) => <span className="font-medium text-gray-900">{k.monat}</span> },
            { header: "Registrierungen", align: "right", cell: (k) => k.registriert },
            { header: "Heute aktives Abo", align: "right", cell: (k) => k.aktiv },
            {
              header: "Quote",
              align: "right",
              cell: (k) =>
                k.registriert > 0 ? formatProzent(k.aktiv / k.registriert) : "–",
            },
          ]}
        />
        <p className="mt-3 text-xs text-gray-400">
          Gezählt wird der heutige Abo-Status je Registrierungsjahrgang. Eine
          Verlaufs-Kohorte (Abo nach 30/60/90 Tagen) entsteht, sobald genug
          BusinessDaily-Historie aufgelaufen ist.
        </p>
      </Card>
    </div>
  );
}

function DatenSkeleton() {
  return (
    <div className="space-y-5">
      {[0, 1].map((i) => (
        <div key={i} className={`space-y-3 p-5 ${cardSurfaceClass}`}>
          <div className="h-4 w-40 animate-pulse rounded bg-gray-100" />
          {[...Array(4)].map((_, j) => (
            <div key={j} className="h-3.5 w-full animate-pulse rounded bg-gray-100" />
          ))}
        </div>
      ))}
    </div>
  );
}

export default async function AnalyticsAbosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePlatformAdmin();
  const zeitraum = parseZeitraum(await searchParams);

  return (
    <AnalyticsShell titel="Abos & Umsatz" pfad="/plattform/analytics/abos" zeitraum={zeitraum}>
      <Suspense fallback={<DatenSkeleton />}>
        <AboDaten zeitraum={zeitraum} />
      </Suspense>
    </AnalyticsShell>
  );
}
