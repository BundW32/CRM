import { KeyFigure, KeyFigures } from "@/components/data-display";
import { Card, EmptyState } from "@/components/ui";
import { parseZeitraum, vorperiodeLabel } from "@/lib/analytics/zeitraum";
import { requirePlatformAdmin } from "@/lib/platform";
import { AnalyticsShell } from "./analytics-shell";

export const dynamic = "force-dynamic";

// Übersicht des Analytics-Dashboards. Phase 1 stellt das Gerüst: KPI-Kacheln,
// Zeitreihe und Funnel bekommen ihre Daten aus den Fact-Tabellen, sobald die
// Quellen angebunden sind (First-Party Phase 2, Geschäftszahlen Phase 3,
// Google Phase 4) — bis dahin sagen die Flächen ehrlich, was noch fehlt,
// statt Nullen als Messwert auszugeben.
export default async function AnalyticsUebersichtPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePlatformAdmin();
  const zeitraum = parseZeitraum(await searchParams);

  const kpis = [
    { label: "Besucher", quelle: "First-Party-Tracking (Phase 2)" },
    { label: "Registrierungen", quelle: "Geschäftszahlen (Phase 3)" },
    { label: "Aktive Abos", quelle: "Geschäftszahlen (Phase 3)" },
    { label: "MRR (brutto)", quelle: "Geschäftszahlen (Phase 3)" },
    { label: "Ads-Kosten", quelle: "Google Ads (Phase 4)" },
    { label: "CAC pro Abo", quelle: "Ads + Attribution (Phase 4/5)" },
  ];

  return (
    <AnalyticsShell titel="Analytics" pfad="/plattform/analytics" zeitraum={zeitraum}>
      <div className="space-y-5">
        <Card title={`Kennzahlen · ${vorperiodeLabel(zeitraum)}`}>
          <KeyFigures>
            {kpis.map((k) => (
              <KeyFigure key={k.label} label={k.label} value="–" hint={k.quelle} />
            ))}
          </KeyFigures>
        </Card>

        <Card title="Besucher · Registrierungen · Abos im Zeitverlauf">
          <EmptyState>
            Die kombinierte Zeitreihe erscheint, sobald First-Party-Tracking
            (Phase 2) und Geschäftszahlen (Phase 3) Daten liefern.
          </EmptyState>
        </Card>

        <Card title="Funnel: Besuch → Registrierung → aktive Nutzung → Abo">
          <EmptyState>
            Der Funnel braucht die Ereignisse aus dem First-Party-Tracking
            (Phase 2) und die Abo-Daten (Phase 3).
          </EmptyState>
        </Card>
      </div>
    </AnalyticsShell>
  );
}
