import { Card, EmptyState } from "@/components/ui";
import { parseZeitraum } from "@/lib/analytics/zeitraum";
import { requirePlatformAdmin } from "@/lib/platform";
import { AnalyticsShell } from "../analytics-shell";

export const dynamic = "force-dynamic";

export default async function AnalyticsTrafficPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePlatformAdmin();
  const zeitraum = parseZeitraum(await searchParams);

  return (
    <AnalyticsShell titel="Traffic" pfad="/plattform/analytics/traffic" zeitraum={zeitraum}>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="GA4 und First-Party nebeneinander">
          <EmptyState>
            Hier stehen künftig beide Besucherzahlen im selben Chart, dazu die
            Erfassungsquote von GA4 — sichtbar wird, wie viel Consent-Ablehnung
            und Adblocker verschlucken. First-Party kommt in Phase 2, GA4 in
            Phase 4.
          </EmptyState>
        </Card>
        <Card title="Quellen und Kampagnen">
          <EmptyState>
            Herkunft der Besucher (organisch, Ads, direkt, Referral,
            Newsletter) aus UTM-Parametern und GA4-Quelle/Medium.
          </EmptyState>
        </Card>
        <Card title="Landingpages">
          <EmptyState>Meistbesuchte Seiten, Einstiege und Ausstiege.</EmptyState>
        </Card>
        <Card title="Geräte und Länder">
          <EmptyState>Verteilung nach Gerätetyp und Land.</EmptyState>
        </Card>
      </div>
    </AnalyticsShell>
  );
}
