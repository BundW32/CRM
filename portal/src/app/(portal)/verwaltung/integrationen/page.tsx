import Link from "next/link";
import { Alert, Card, Field, PageTitle, buttonClass, buttonSecondaryClass, inputClass } from "@/components/ui";
import { maskSecret } from "@/lib/crypto";
import { decryptSecret } from "@/lib/crypto";
import { db } from "@/lib/db";
import { INTEGRATION_AREAS } from "@/lib/integrations";
import { requireVerwalter } from "@/lib/session";
import { clearIntegration, saveIntegration } from "./actions";

export const dynamic = "force-dynamic";

const FEHLER: Record<string, string> = {
  bereich: "Unbekannter Integrationsbereich.",
  schluessel: "Bitte einen API-Schlüssel eingeben.",
};

export default async function IntegrationenPage({
  searchParams,
}: {
  searchParams: Promise<{ gespeichert?: string; geloescht?: string; fehler?: string }>;
}) {
  const verwalter = await requireVerwalter();
  const sp = await searchParams;

  const settings = await db.integrationSetting.findMany({
    where: { organizationId: verwalter.organizationId },
  });
  const byArea = new Map(settings.map((s) => [s.area, s]));

  // Nur die Maskierung (letzte 4 Zeichen) wird gerendert — nie der Klartext.
  function maskedFor(secretEnc: string | null): string | null {
    if (!secretEnc) return null;
    try {
      return maskSecret(decryptSecret(secretEnc));
    } catch {
      return "••••";
    }
  }

  return (
    <>
      <PageTitle
        back={{ href: "/verwaltung/einstellungen", label: "Einstellungen" }}
      >
        Integrationen
      </PageTitle>

      <p className="mb-4 max-w-3xl text-sm text-gray-300">
        Externe Dienste sind reine Beschleuniger. <strong>Ohne API-Zugang</strong> bleibt
        jede Funktion über den manuellen Weg vollständig nutzbar — die App braucht keinen
        einzigen externen Schlüssel. Hinterlegte Schlüssel werden verschlüsselt gespeichert.
      </p>

      {sp.gespeichert ? (
        <Alert variant="success" className="mb-4">Zugang gespeichert.</Alert>
      ) : null}
      {sp.geloescht ? (
        <Alert variant="success" className="mb-4">Zugang entfernt — es gilt wieder der manuelle Weg.</Alert>
      ) : null}
      {sp.fehler ? (
        <Alert variant="error" className="mb-4">{FEHLER[sp.fehler] ?? "Eingabe konnte nicht verarbeitet werden."}</Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {INTEGRATION_AREAS.map((area) => {
          const setting = byArea.get(area.key);
          const active = Boolean(setting?.enabled && setting?.secretEnc);
          const masked = maskedFor(setting?.secretEnc ?? null);
          return (
            <Card key={area.key} title={area.title}>
              <div className="mb-3 flex items-center gap-2">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {active ? "Aktiv" : "Manueller Weg"}
                </span>
                <span className="text-xs text-gray-400">{area.moduleHint}</span>
              </div>
              <p className="mb-3 text-sm text-gray-600">{area.description}</p>

              {!active ? (
                <Alert variant="info" className="mb-3">{area.manualFallback}</Alert>
              ) : (
                <p className="mb-3 text-sm text-gray-600">
                  Anbieter: <strong>{area.providers.find((p) => p.value === setting?.provider)?.label ?? setting?.provider ?? "—"}</strong>
                  {masked ? <> · Schlüssel {masked}</> : null}
                </p>
              )}

              <form action={saveIntegration} className="space-y-3">
                <input type="hidden" name="area" value={area.key} />
                <Field label="Anbieter">
                  <select name="provider" defaultValue={setting?.provider ?? area.providers[0].value} className={inputClass}>
                    {area.providers.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label={area.keyLabel}>
                  <input
                    type="password"
                    name="apiKey"
                    autoComplete="off"
                    placeholder={active ? "leer lassen = unverändert" : "eingeben"}
                    className={inputClass}
                  />
                </Field>
                <div className="flex items-center gap-3">
                  <button type="submit" className={buttonClass}>
                    {active ? "Aktualisieren" : "Aktivieren"}
                  </button>
                  {active ? (
                    <button
                      type="submit"
                      formAction={clearIntegration}
                      className="text-sm text-red-600 hover:underline"
                    >
                      Zugang entfernen
                    </button>
                  ) : null}
                </div>
              </form>
            </Card>
          );
        })}

        {/* SEPA-Lastschrift: Zero-Key, kein Schlüssel nötig. */}
        <Card title="SEPA-Lastschrift (Hausgeldeinzug)">
          <div className="mb-3">
            <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
              Ohne Schlüssel nutzbar
            </span>
          </div>
          <p className="mb-3 text-sm text-gray-600">
            Der SEPA-Lastschrifteinzug erzeugt eine pain.008-XML-Datei zum Selbst-Upload ins
            Online-Banking — ganz ohne externen Zugang. Mandate und Export je Objekt.
          </p>
          <Link href="/verwaltung/weg" className={buttonSecondaryClass}>
            Zu den WEG-Objekten
          </Link>
        </Card>
      </div>
    </>
  );
}
