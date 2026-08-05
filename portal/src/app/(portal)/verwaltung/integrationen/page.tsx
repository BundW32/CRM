import Link from "next/link";
import { Alert, Card, Field, PageTitle, buttonClass, buttonSecondaryClass, inputClass } from "@/components/ui";
import { Badge } from "@/components/data-display";
import { maskSecret } from "@/lib/crypto";
import { decryptSecret } from "@/lib/crypto";
import { db } from "@/lib/db";
import { INTEGRATION_AREAS } from "@/lib/integrations";
import { assistentStatus } from "@/lib/assistant";
import { requireVerwalter } from "@/lib/session";
import { clearIntegration, saveIntegration } from "./actions";
import { AssistentTest } from "./assistent-test";

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
  const assistent = assistentStatus();

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

      {/* Der KI-Assistent hängt nicht an einem hier hinterlegten Schlüssel,
          sondern an zwei Server-Variablen. Fehlt eine, rendert das Layout die
          Sprechblase kommentarlos nicht — ohne Fehlermeldung und ohne
          Protokolleintrag. Diese Karte sagt, woran es liegt; sie ist der
          einzige Ort im Programm, an dem das überhaupt sichtbar wird. */}
      <div className="mb-4">
      <Card title="KI-Assistent">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge tone={assistent.aktiv ? "success" : "neutral"}>
            {assistent.aktiv ? "Aktiv" : "Nicht aktiv"}
          </Badge>
          <span className="text-xs text-gray-400">
            Sprechblase unten rechts · Modell {assistent.modell}
          </span>
        </div>
        {assistent.aktiv ? (
          <>
            <p className="text-sm text-gray-600">
              Der Assistent antwortet ausschließlich aus Unterlagen, die der Fragende
              ohnehin sehen darf. Sichtbar ist er für Verwalter und Eigentümer, nicht für
              Mieter.
            </p>
            {/* „Aktiv" heißt nur: beide Variablen sind gesetzt. Ob Google den
                Schlüssel annimmt und das Modell noch existiert, weiß erst der
                Aufruf — und der endete bislang in einer einzigen Zeile, die
                jeden Grund zudeckte. */}
            <p className="mt-2 text-sm text-gray-600">
              Antwortet er trotz dieser Anzeige nur „Der Assistent ist momentan nicht
              erreichbar“, liegt es an Google — am Schlüssel, am Modellnamen oder am
              Kontingent. Der Test darunter sagt, woran.
            </p>
          </>
        ) : (
          <div className="text-sm text-gray-600">
            <p className="mb-2">Es fehlt in den Umgebungsvariablen des Deployments:</p>
            <ul className="mb-2 list-disc pl-5">
              {!assistent.schalterGesetzt ? (
                <li>
                  <code>AI_ASSISTANT_ENABLED</code> —{" "}
                  {assistent.schalterUnverstanden
                    ? `steht auf „${assistent.schalterUnverstanden}“ und muss genau true lauten (ohne Anführungszeichen)`
                    : "muss auf true stehen"}
                </li>
              ) : null}
              {!assistent.schluesselGesetzt ? (
                <li>
                  <code>GEMINI_API_KEY</code> — noch kein Schlüssel hinterlegt
                </li>
              ) : null}
            </ul>
            <p className="text-xs text-gray-500">
              Änderungen an Umgebungsvariablen greifen erst nach einem neuen Deployment —
              und sie müssen für die Umgebung <em>Production</em> gesetzt sein, nicht nur
              für Preview.
            </p>
          </div>
        )}
        {/* Auch bei „Nicht aktiv" sinnvoll: Wer den Schlüssel gerade einträgt,
            will wissen, ob er taugt — bevor er ein Deployment dafür aufwendet. */}
        {assistent.schluesselGesetzt ? <AssistentTest /> : null}
      </Card>
      </div>

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
            <Badge tone="success">Ohne Schlüssel nutzbar</Badge>
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
