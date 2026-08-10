import { Card, EmptyState } from "@/components/ui";
import { parseZeitraum } from "@/lib/analytics/zeitraum";
import { requirePlatformAdmin } from "@/lib/platform";
import { AnalyticsShell } from "../analytics-shell";

export const dynamic = "force-dynamic";

export default async function AnalyticsSeoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePlatformAdmin();
  const zeitraum = parseZeitraum(await searchParams);

  return (
    <AnalyticsShell titel="SEO" pfad="/plattform/analytics/seo" zeitraum={zeitraum}>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Top-Suchanfragen">
          <EmptyState>
            Klicks, Impressionen, CTR und Ø-Position aus der Search Console —
            die Anbindung kommt in Phase 4. Die API liefert rückwirkend nur
            ~16 Monate; der einmalige Backfill sichert diese Historie.
          </EmptyState>
        </Card>
        <Card title="Top-Seiten">
          <EmptyState>Welche Seiten in der Google-Suche erscheinen.</EmptyState>
        </Card>
        <Card title="Positionsverteilung">
          <EmptyState>Anteil der Suchbegriffe auf Position 1–3, 4–10, 11–20, 21+.</EmptyState>
        </Card>
        <Card title="Gewinner und Verlierer">
          <EmptyState>Positionsveränderung gegenüber der Vorperiode.</EmptyState>
        </Card>
      </div>
    </AnalyticsShell>
  );
}
