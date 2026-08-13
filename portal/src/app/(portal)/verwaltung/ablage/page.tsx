// Selbstprüfung der Dateiablage — für Betreiber-Konten.
//
// Anlass: In Produktion schlug jeder Upload fehl. Sichtbar war nur „Die
// Dateiablage ist nicht verfügbar" — und damit endete die Spur. Die beiden
// möglichen Ursachen (Token fehlt / Store ist öffentlich statt privat) sehen von
// außen gleich aus und verlangen gegensätzliche Handgriffe. Diese Seite misst,
// statt zu raten, und nennt zu jedem Fehlschlag den Schritt zur Behebung.
//
// Bewusst hinter `requirePlatformAdmin`: Der Befund nennt Umgebungsvariablen und
// schreibt eine Testdatei in den Blob-Store. Beheben kann ihn ohnehin nur, wer
// an die Vercel-Umgebung kommt.

import { CheckCircle2, CircleAlert, XCircle } from "lucide-react";
import { Alert, Card, PageTitle, buttonClass, cardSurfaceClass } from "@/components/ui";
import { PendingButton } from "@/components/pending-button";
import { stack } from "@/components/data-display";
import { TOKEN_NAME, pruefeAblage, type PruefPunkt, type PruefStatus } from "@/lib/ablage-check";
import { requirePlatformAdmin } from "@/lib/platform";
import { starteAblagePruefung } from "./actions";

export const dynamic = "force-dynamic";

const SYMBOL: Record<PruefStatus, { icon: typeof CheckCircle2; klasse: string; wort: string }> = {
  ok: { icon: CheckCircle2, klasse: "text-green-600", wort: "In Ordnung" },
  warnung: { icon: CircleAlert, klasse: "text-amber-600", wort: "Zu prüfen" },
  fehler: { icon: XCircle, klasse: "text-red-600", wort: "Fehler" },
};

function PunktZeile({ punkt }: { punkt: PruefPunkt }) {
  const { icon: Icon, klasse, wort } = SYMBOL[punkt.status];
  return (
    <li className="flex gap-3 border-t border-gray-100 px-5 py-4 first:border-t-0">
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${klasse}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900">
          {punkt.titel} <span className="font-normal text-gray-500">— {wort}</span>
        </p>
        <p className="mt-1 text-sm text-gray-600">{punkt.befund}</p>
        {punkt.behebung ? (
          <p className="mt-2 text-sm text-gray-900">
            <span className="font-semibold">So beheben: </span>
            {punkt.behebung}
          </p>
        ) : null}
      </div>
    </li>
  );
}

export default async function AblagePruefungPage({
  searchParams,
}: {
  searchParams: Promise<{ pruefen?: string }>;
}) {
  await requirePlatformAdmin();
  const { pruefen } = await searchParams;

  // Nur auf Anforderung: Die Prüfung schreibt eine echte Datei in den Store.
  // Sie bei jedem Seitenaufruf laufen zu lassen, hieße, für jeden Blick eine
  // Datei anzulegen und wieder zu löschen.
  const ergebnis = pruefen === "1" ? await pruefeAblage() : null;

  return (
    <>
      <PageTitle back={{ href: "/verwaltung/einstellungen", label: "Einstellungen" }}>
        Dateiablage
      </PageTitle>

      <div className={`max-w-3xl ${stack}`}>
        <Card>
          <p className="text-sm text-gray-600">
            Diese Prüfung legt eine kleine Testdatei im Blob-Store ab, liest sie zurück,
            versucht sie ohne Zugangsdaten abzurufen und löscht sie wieder. Sie sagt damit,
            ob Uploads im Portal funktionieren — und woran es liegt, wenn nicht. Der Wert
            des Tokens wird nirgends angezeigt, nur ob es gesetzt ist.
          </p>
          <form action={starteAblagePruefung} className="mt-4">
            <PendingButton className={buttonClass} pendingLabel="Wird geprüft…">
              {ergebnis ? "Erneut prüfen" : "Prüfung starten"}
            </PendingButton>
          </form>
        </Card>

        {ergebnis ? (
          <>
            {ergebnis.gesamt === "ok" ? (
              <Alert variant="success" title="Die Dateiablage ist einsatzbereit.">
                Uploads sollten in dieser Umgebung ({ergebnis.umgebung}) funktionieren.
              </Alert>
            ) : ergebnis.gesamt === "fehler" ? (
              <Alert variant="error" title="Die Dateiablage ist nicht einsatzbereit.">
                In dieser Umgebung ({ergebnis.umgebung}) schlagen Uploads fehl. Die Schritte
                zur Behebung stehen unten bei dem Punkt, der fehlgeschlagen ist.
              </Alert>
            ) : (
              <Alert variant="warning" title="Die Dateiablage ist eingeschränkt.">
                Nicht alles ließ sich prüfen oder ist so eingerichtet, wie es in Produktion
                sein müsste (Umgebung: {ergebnis.umgebung}).
              </Alert>
            )}

            <div className={cardSurfaceClass}>
              <ul>
                {ergebnis.punkte.map((p) => (
                  <PunktZeile key={p.schluessel} punkt={p} />
                ))}
              </ul>
            </div>
          </>
        ) : null}

        <Card title="Was die Ablage braucht">
          <ul className="list-disc space-y-2 pl-5 text-sm text-gray-600">
            <li>
              <code className="rounded bg-gray-100 px-1">{TOKEN_NAME}</code> — wird
              gesetzt, sobald ein Blob-Store mit dem Projekt verbunden ist. Fehlt sie in
              Produktion, bricht jeder Upload ab (der Data-URL-Fallback in die Datenbank ist
              dort absichtlich gesperrt).
            </li>
            <li>
              Der Store muss <strong>privat</strong> angelegt sein. Das Portal schreibt mit{" "}
              <code className="rounded bg-gray-100 px-1">access: &quot;private&quot;</code>;
              ein öffentlicher Store weist das ab — und würde Kundendateien für jeden
              zugänglich machen, der eine URL kennt.
            </li>
            <li>
              Ausführlich in <code className="rounded bg-gray-100 px-1">docs/BETRIEB-Dateiablage.md</code>.
            </li>
          </ul>
        </Card>
      </div>
    </>
  );
}
