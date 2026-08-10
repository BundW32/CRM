import { Card, EmptyState } from "@/components/ui";
import { parseZeitraum } from "@/lib/analytics/zeitraum";
import { requirePlatformAdmin } from "@/lib/platform";
import { AnalyticsShell } from "../analytics-shell";

export const dynamic = "force-dynamic";

export default async function AnalyticsAdsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePlatformAdmin();
  const zeitraum = parseZeitraum(await searchParams);

  return (
    <AnalyticsShell titel="Google Ads" pfad="/plattform/analytics/ads" zeitraum={zeitraum}>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Kosten, CPC und Conversions je Kampagne">
          <EmptyState>
            Die Google-Ads-Anbindung kommt in Phase 4. Sie braucht einen
            Developer-Token — die Freigabe dauert erfahrungsgemäß Tage bis
            Wochen, deshalb früh beantragen.
          </EmptyState>
        </Card>
        <Card title="Keywords">
          <EmptyState>Kosten und Conversions je Keyword, CAC je Kanal.</EmptyState>
        </Card>
        <Card title="Kostenverlauf">
          <EmptyState>Tagesgenaue Ausgaben im gewählten Zeitraum.</EmptyState>
        </Card>
        <Card title="Kosten ohne Conversion">
          <EmptyState>Suchbegriffe, die Budget verbrauchen, aber nichts bringen.</EmptyState>
        </Card>
      </div>
    </AnalyticsShell>
  );
}
