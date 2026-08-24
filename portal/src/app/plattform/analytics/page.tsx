import { Suspense } from "react";
import { BarChart } from "@/components/bar-chart";
import { KeyFigure, KeyFigures } from "@/components/data-display";
import { Card, EmptyState, cardSurfaceClass } from "@/components/ui";
import { summen, tagesReihe, vergleichsText } from "@/lib/analytics/first-party";
import {
  type Zeitraum,
  parseZeitraum,
  zeitraumSpanne,
} from "@/lib/analytics/zeitraum";
import { db } from "@/lib/db";
import { formatCents, requirePlatformAdmin } from "@/lib/platform";
import { AnalyticsShell } from "./analytics-shell";

export const dynamic = "force-dynamic";

const TAG_MS = 86_400_000;

// Übersicht des Analytics-Dashboards. Besucher und Registrierungen kommen
// seit Phase 2 aus dem First-Party-Tracking; Abos/MRR folgen mit Phase 3,
// Ads-Kosten und CAC mit Phase 4/5 — diese Kacheln sagen ehrlich, was noch
// fehlt, statt Nullen als Messwert auszugeben.
async function UebersichtDaten({ zeitraum }: { zeitraum: Zeitraum }) {
  const fenster = (von: Date, bis: Date) => ({ gte: von, lt: new Date(bis.getTime() + TAG_MS) });
  const letzterStand = (bis: Date) =>
    db.businessDaily.findFirst({
      where: { date: { lte: bis } },
      orderBy: { date: "desc" },
      select: { activeSubs: true, mrrCents: true },
    });
  const [pageviews, vorPageviews, signups, vorSignups, stand, vorStand] = await Promise.all([
    db.trackEvent.findMany({
      where: { type: "pageview", ts: fenster(zeitraum.von, zeitraum.bis) },
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
    }),
    db.trackEvent.findMany({
      where: { type: "pageview", ts: fenster(zeitraum.vorVon, zeitraum.vorBis) },
      select: { visitorHash: true },
    }),
    db.trackEvent.count({
      where: { type: "signup_done", ts: fenster(zeitraum.von, zeitraum.bis) },
    }),
    db.trackEvent.count({
      where: { type: "signup_done", ts: fenster(zeitraum.vorVon, zeitraum.vorBis) },
    }),
    letzterStand(zeitraum.bis),
    letzterStand(zeitraum.vorBis),
  ]);

  const s = summen(pageviews);
  const vorBesucher = new Set(vorPageviews.map((r) => r.visitorHash)).size;
  const reihe = tagesReihe(pageviews, zeitraum);

  return (
    <div className="space-y-5">
      {/* Der eigene Zeitraum in der Kopfzeile, nicht die Vorperiode: Letztere
          stand hier allein und wurde als das gezeigte Fenster gelesen. Den
          Vergleich nennen die Hinweise der einzelnen Kennzahlen. */}
      <Card title={`Kennzahlen · ${zeitraumSpanne(zeitraum)}`}>
        <KeyFigures>
          <KeyFigure
            label="Besucher"
            value={s.besucher}
            hint={vergleichsText(s.besucher, vorBesucher) ?? "First-Party, täglich eindeutig"}
          />
          <KeyFigure
            label="Registrierungen"
            value={signups}
            hint={vergleichsText(signups, vorSignups) ?? "abgeschlossene Registrierungen"}
          />
          <KeyFigure
            label="Aktive Abos"
            value={stand?.activeSubs ?? "–"}
            hint={
              stand && vorStand
                ? (vergleichsText(stand.activeSubs, vorStand.activeSubs) ?? "unverändert")
                : "Stand: noch kein Ingest-Lauf"
            }
          />
          <KeyFigure
            label="MRR (brutto)"
            value={stand ? formatCents(stand.mrrCents) : "–"}
            hint={
              stand && vorStand
                ? (vergleichsText(stand.mrrCents, vorStand.mrrCents) ?? "inkl. 19 % USt.")
                : "inkl. 19 % USt."
            }
          />
          <KeyFigure label="Ads-Kosten" value="–" hint="Google Ads (Phase 4)" />
          <KeyFigure label="CAC pro Abo" value="–" hint="Ads + Attribution (Phase 4/5)" />
        </KeyFigures>
      </Card>

      <Card title="Besucher je Tag (First-Party)">
        {s.pageviews === 0 ? (
          <EmptyState>
            Im gewählten Zeitraum wurden keine Seitenaufrufe erfasst — das
            Tracking zählt ab dem Deployment von Phase 2.
          </EmptyState>
        ) : (
          <>
            <BarChart data={reihe.map((p) => ({ label: p.label, value: p.besucher }))} />
            <p className="mt-3 text-xs text-gray-400">
              Die kombinierten Reihen Registrierungen und Abos kommen mit
              Phase 3 in dieses Chart.
            </p>
          </>
        )}
      </Card>

      <Card title="Funnel: Besuch → Registrierung → aktive Nutzung → Abo">
        <EmptyState>
          Die Funnel-Ereignisse (signup_start, signup_done, checkout_start,
          subscribed, canceled) werden seit Phase 2 erfasst; die Auswertung mit
          Übergangsquoten kommt in Phase 5.
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

export default async function AnalyticsUebersichtPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePlatformAdmin();
  const zeitraum = parseZeitraum(await searchParams);

  return (
    <AnalyticsShell titel="Analytics" pfad="/plattform/analytics" zeitraum={zeitraum}>
      <Suspense fallback={<DatenSkeleton />}>
        <UebersichtDaten zeitraum={zeitraum} />
      </Suspense>
    </AnalyticsShell>
  );
}
