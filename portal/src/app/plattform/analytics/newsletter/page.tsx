import { Card, EmptyState } from "@/components/ui";
import { parseZeitraum } from "@/lib/analytics/zeitraum";
import { requirePlatformAdmin } from "@/lib/platform";
import { AnalyticsShell } from "../analytics-shell";

export const dynamic = "force-dynamic";

export default async function AnalyticsNewsletterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePlatformAdmin();
  const zeitraum = parseZeitraum(await searchParams);

  return (
    <AnalyticsShell
      titel="Newsletter"
      pfad="/plattform/analytics/newsletter"
      zeitraum={zeitraum}
    >
      <Card title="Abonnenten-Entwicklung">
        <EmptyState>
          Es ist noch kein Newsletter-Provider festgelegt (Brevo, CleverReach,
          Mailchimp oder eine eigene Tabelle). Sobald das entschieden ist,
          befüllt ein täglicher Ingest-Job die Bestands-, Zugangs- und
          Abmeldezahlen.
        </EmptyState>
      </Card>
    </AnalyticsShell>
  );
}
