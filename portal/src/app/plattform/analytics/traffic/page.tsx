import { Suspense } from "react";
import { BarChart } from "@/components/bar-chart";
import { DataTable, KeyFigure, KeyFigures } from "@/components/data-display";
import { Card, EmptyState, cardSurfaceClass } from "@/components/ui";
import {
  type PageviewRow,
  geraete,
  laender,
  quellen,
  summen,
  tagesReihe,
  topSeiten,
  vergleichsText,
} from "@/lib/analytics/first-party";
import { type Zeitraum, parseZeitraum } from "@/lib/analytics/zeitraum";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platform";
import { AnalyticsShell } from "../analytics-shell";

export const dynamic = "force-dynamic";

const TAG_MS = 86_400_000;

// Pageviews eines Fensters (bis-inklusive), nur die Spalten der Aggregation.
function ladePageviews(von: Date, bis: Date): Promise<PageviewRow[]> {
  return db.trackEvent.findMany({
    where: { type: "pageview", ts: { gte: von, lt: new Date(bis.getTime() + TAG_MS) } },
    select: {
      ts: true,
      visitorHash: true,
      path: true,
      referrer: true,
      utmSource: true,
      utmMedium: true,
      device: true,
      country: true,
    },
  });
}

function GruppenTabelle({
  zeilen,
  spalte,
  leer,
}: {
  zeilen: ReturnType<typeof topSeiten>;
  spalte: string;
  leer: string;
}) {
  return (
    <DataTable
      caption={spalte}
      rows={zeilen}
      getKey={(z) => z.name}
      minWidth="20rem"
      empty={<EmptyState>{leer}</EmptyState>}
      columns={[
        {
          header: spalte,
          cell: (z) => <span className="font-medium break-all text-gray-900">{z.name}</span>,
        },
        { header: "Aufrufe", align: "right", cell: (z) => z.pageviews },
        { header: "Besucher", align: "right", cell: (z) => z.besucher },
      ]}
    />
  );
}

async function TrafficDaten({ zeitraum }: { zeitraum: Zeitraum }) {
  const [rows, vorRows] = await Promise.all([
    ladePageviews(zeitraum.von, zeitraum.bis),
    ladePageviews(zeitraum.vorVon, zeitraum.vorBis),
  ]);
  const s = summen(rows);
  const vor = summen(vorRows);
  const reihe = tagesReihe(rows, zeitraum);

  return (
    <div className="space-y-5">
      <Card title="Kennzahlen (First-Party)">
        <KeyFigures>
          <KeyFigure
            label="Besucher"
            value={s.besucher}
            hint={vergleichsText(s.besucher, vor.besucher) ?? "täglich eindeutig, cookiefrei"}
          />
          <KeyFigure
            label="Seitenaufrufe"
            value={s.pageviews}
            hint={vergleichsText(s.pageviews, vor.pageviews) ?? "im gewählten Zeitraum"}
          />
          <KeyFigure
            label="Aufrufe je Besucher"
            value={s.besucher > 0 ? (s.pageviews / s.besucher).toFixed(1) : "–"}
            hint="Ø im Zeitraum"
          />
        </KeyFigures>
        <p className="mt-3 text-xs text-gray-400">
          „Besucher“ heißt: täglich eindeutig. Die Kennung rotiert mit dem
          Tages-Salt — wer an mehreren Tagen kommt, zählt mehrfach. Das ist der
          Preis der cookiefreien Messung.
        </p>
      </Card>

      {rows.length === 0 ? (
        <Card title="Noch keine Ereignisse">
          <EmptyState>
            Im gewählten Zeitraum wurden keine Seitenaufrufe erfasst. Das
            Tracking zählt ab dem Deployment dieser Phase — der erste Aufruf
            einer öffentlichen Seite erscheint hier binnen Sekunden.
          </EmptyState>
        </Card>
      ) : (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Seitenaufrufe je Tag">
              <BarChart data={reihe.map((p) => ({ label: p.label, value: p.pageviews }))} />
            </Card>
            <Card title="Besucher je Tag">
              <BarChart
                data={reihe.map((p) => ({ label: p.label, value: p.besucher }))}
                barClass="bg-brand-green"
              />
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Meistbesuchte Seiten">
              <GruppenTabelle
                zeilen={topSeiten(rows, 15)}
                spalte="Seite"
                leer="Keine Aufrufe im Zeitraum."
              />
            </Card>
            <Card title="Quellen">
              <GruppenTabelle
                zeilen={quellen(rows, 15)}
                spalte="Quelle"
                leer="Keine Aufrufe im Zeitraum."
              />
              <p className="mt-3 text-xs text-gray-400">
                UTM-Parameter gewinnen vor dem Referrer; ohne beides zählt der
                Aufruf als „direkt“.
              </p>
            </Card>
            <Card title="Geräte">
              <GruppenTabelle
                zeilen={geraete(rows)}
                spalte="Gerät"
                leer="Keine Aufrufe im Zeitraum."
              />
            </Card>
            <Card title="Länder">
              <GruppenTabelle
                zeilen={laender(rows, 10)}
                spalte="Land"
                leer="Keine Aufrufe im Zeitraum."
              />
            </Card>
          </div>
        </>
      )}

      <Card title="GA4 und First-Party nebeneinander">
        <EmptyState>
          Sobald GA4 angebunden ist (Phase 4), stehen hier beide Besucherzahlen
          im selben Chart, dazu die Erfassungsquote von GA4 — sichtbar wird,
          wie viel Consent-Ablehnung und Adblocker verschlucken.
        </EmptyState>
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

export default async function AnalyticsTrafficPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePlatformAdmin();
  const zeitraum = parseZeitraum(await searchParams);

  return (
    <AnalyticsShell titel="Traffic" pfad="/plattform/analytics/traffic" zeitraum={zeitraum}>
      <Suspense fallback={<DatenSkeleton />}>
        <TrafficDaten zeitraum={zeitraum} />
      </Suspense>
    </AnalyticsShell>
  );
}
