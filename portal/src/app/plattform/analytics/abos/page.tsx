import { Card, EmptyState } from "@/components/ui";
import { parseZeitraum } from "@/lib/analytics/zeitraum";
import { requirePlatformAdmin } from "@/lib/platform";
import { AnalyticsShell } from "../analytics-shell";

export const dynamic = "force-dynamic";

export default async function AnalyticsAbosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePlatformAdmin();
  const zeitraum = parseZeitraum(await searchParams);

  return (
    <AnalyticsShell titel="Abos & Umsatz" pfad="/plattform/analytics/abos" zeitraum={zeitraum}>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="MRR-Verlauf (brutto)">
          <EmptyState>
            Der stündliche Abgleich mit der eigenen Datenbank und Stripe kommt
            in Phase 3 — inklusive Mengenstaffel und Stellplätzen, alle
            Beträge brutto inkl. 19&nbsp;% USt. und so beschriftet.
          </EmptyState>
        </Card>
        <Card title="Registrierungen und Abos">
          <EmptyState>Neue Registrierungen, aktive, neue und gekündigte Abos.</EmptyState>
        </Card>
        <Card title="Abgerechnete Einheiten und Stellplätze">
          <EmptyState>Mengenentwicklung der abgerechneten Positionen.</EmptyState>
        </Card>
        <Card title="Churn und Kohorten">
          <EmptyState>Kündigungsquote und Kohortentabelle nach Registrierungsmonat.</EmptyState>
        </Card>
      </div>
    </AnalyticsShell>
  );
}
