import { Alert, Card, Field, PageTitle, buttonClass, buttonSecondaryClass, inputClass } from "@/components/ui";
import { PendingButton } from "@/components/pending-button";
import { PushToggle } from "@/components/push-toggle";
import { formatDate, roleLabels } from "@/lib/labels";
import { getOrganization, requireUser } from "@/lib/session";
import { changePassword, saveShowHints } from "./actions";
import { tourNeuStarten } from "./tour-actions";
import { VollmachtKarte } from "./vollmacht";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  aktuell: "Das aktuelle Passwort ist falsch.",
  laenge: "Das neue Passwort muss mindestens 10 Zeichen lang sein.",
  wiederholung: "Die Wiederholung stimmt nicht mit dem neuen Passwort überein.",
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string; gespeichert?: string }>;
}) {
  const user = await requireUser();
  const { fehler, gespeichert } = await searchParams;
  const org = await getOrganization();

  return (
    <>
      <PageTitle>Konto</PageTitle>

      {gespeichert === "hinweise" ? (
        <Alert variant="success" className="mb-4">
          Gespeichert.
        </Alert>
      ) : null}

      <div className="grid max-w-3xl gap-5 md:grid-cols-2">
        <Card title="Ihre Daten">
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-400">Name</dt>
              <dd className="text-gray-800">{user.name}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-400">
                {user.email ? "E-Mail" : "Benutzername"}
              </dt>
              <dd className="text-gray-800">
                {user.email ?? user.username ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-400">Rolle</dt>
              <dd className="text-gray-800">{roleLabels[user.role]}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-400">
                Konto angelegt
              </dt>
              <dd className="text-gray-800">{formatDate(user.createdAt)}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-gray-500">
            Änderungen an Name oder E-Mail-Adresse übernimmt die Verwaltung für Sie
            {org?.email ? `: ${org.email}` : "."}
          </p>
          <div className="mt-4 border-t border-gray-100 pt-4">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/api/export/me"
              className="text-sm text-brand-green hover:underline"
            >
              Meine Daten exportieren (DSGVO)
            </a>
            <p className="mt-1 text-xs text-gray-500">
              Lädt alle zu Ihrer Person gespeicherten Daten als Datei herunter.
            </p>
          </div>
        </Card>

        <Card title="Passwort ändern">
          {/* Erfolg meldet der ToastHost (`?flash=…`). Fehler bleiben hier als
              Banner am Formular stehen, bis sie behoben sind. */}
          {fehler && fehler !== "signatur" ? (
            <Alert variant="error" className="mb-3">
              {errorMessages[fehler] ?? "Passwortänderung fehlgeschlagen."}
            </Alert>
          ) : null}
          <form action={changePassword} className="space-y-3">
            <Field label="Aktuelles Passwort">
              <input
                type="password"
                name="current"
                required
                autoComplete="current-password"
                className={inputClass}
              />
            </Field>
            <Field label="Neues Passwort (mind. 10 Zeichen)">
              <input
                type="password"
                name="next"
                required
                minLength={10}
                autoComplete="new-password"
                className={inputClass}
              />
            </Field>
            <Field label="Neues Passwort wiederholen">
              <input
                type="password"
                name="repeat"
                required
                minLength={10}
                autoComplete="new-password"
                className={inputClass}
              />
            </Field>
            <PendingButton className={buttonClass}>Passwort ändern</PendingButton>
          </form>
        </Card>

        {/* Unterschrift und Vollmacht führt nur der Eigentümer selbst – er ist
            der Wohnungsgeber, in dessen Namen die Bescheinigung entsteht. */}
        {user.role === "EIGENTUEMER" ? (
          <Card title="Unterschrift & Vollmacht">
            {fehler === "signatur" ? (
              <Alert variant="error" className="mb-3">
                Die Unterschrift konnte nicht gespeichert werden. Bitte erneut versuchen.
              </Alert>
            ) : null}
            <VollmachtKarte user={user} />
          </Card>
        ) : null}

        <Card title="Benachrichtigungen">
          <p className="mb-3 text-sm text-gray-600">
            Erhalten Sie Push-Benachrichtigungen auf diesem Gerät, z. B. bei neuen Antworten,
            Nachrichten oder Vorgängen. Am besten funktioniert das, wenn Sie das Portal über
            „Zum Startbildschirm hinzufügen“ installieren.
          </p>
          <PushToggle />
        </Card>

        {/* Hinweise ein/aus. Bewusst hier und nicht in den
            Verwalter-Einstellungen: Es ist eine Vorliebe der Person, nicht der
            Organisation — zwei Eigentümer derselben WEG dürfen es verschieden
            wollen. */}
        <div data-tour="hinweise-schalter">
        <Card title="Erklärungen">
          <form action={saveShowHints} className="space-y-3">
            <label className="flex items-start gap-2 text-sm text-gray-800">
              <input
                type="checkbox"
                name="showHints"
                defaultChecked={user.showHints}
                className="mt-0.5"
              />
              <span>
                Erklärende Hinweise anzeigen
                <span className="mt-1 block text-xs text-gray-500">
                  Kurze Erläuterungen zu Fachbegriffen und Eingaben — etwa was eine
                  Sollstellung ist oder warum der Verbrauchsanteil bei Heizkosten
                  zwischen 50 und 70 Prozent liegen muss. Wer das Programm kennt,
                  schaltet sie hier ab.
                </span>
                <span className="mt-1 block text-xs text-gray-500">
                  Warnungen und Fehlermeldungen bleiben immer sichtbar — sie sind
                  keine Erklärungen, sondern Hinweise auf etwas, das zu tun ist.
                </span>
              </span>
            </label>
            <PendingButton className={buttonClass}>Speichern</PendingButton>
          </form>

          {/* Die Führung erklärt unter anderem genau diesen Schalter — deshalb
              steht ihr Neustart hier und nicht in einem eigenen Bereich. */}
          <form action={tourNeuStarten} className="mt-4 border-t border-gray-100 pt-4">
            <p className="mb-2 text-xs text-gray-500">
              {user.tourDoneAt
                ? "Sie haben die kurze Einführung bereits gesehen."
                : "Die kurze Einführung steht noch aus — sie erscheint beim nächsten Seitenaufruf."}
            </p>
            <PendingButton className={buttonSecondaryClass}>
              Einführung {user.tourDoneAt ? "erneut " : ""}starten
            </PendingButton>
          </form>
        </Card>
        </div>
      </div>
    </>
  );
}
