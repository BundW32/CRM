import Link from "next/link";
import { AblageAlert } from "@/components/ablage-alert";
import { Alert, Card, Field, PageTitle, buttonClass, buttonSecondaryClass, inputClass } from "@/components/ui";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { SelectField } from "@/components/fields";
import { PendingButton } from "@/components/pending-button";
import { PushToggle } from "@/components/push-toggle";
import { CONTACT_METHODS, EMAIL_WECHSEL_GUELTIG_STUNDEN } from "@/lib/eigene-daten";
import { contactMethodLabels, formatDate, roleLabels } from "@/lib/labels";
import { isMailEnabled } from "@/lib/mailer";
import { getOrganization, requireUser } from "@/lib/session";
import {
  deaktiviereMfa,
  erneuereRecoveryCodes,
  sendeKontoMfaCode,
  starteEmailMfa,
} from "../../mfa-einrichten/actions";
import {
  cancelEmailChange,
  changePassword,
  requestEmailChange,
  saveContactData,
  saveShowHints,
} from "./actions";
import { tourNeuStarten } from "./tour-actions";
import { VollmachtKarte } from "./vollmacht";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  aktuell: "Das aktuelle Passwort ist falsch.",
  laenge: "Das neue Passwort muss mindestens 10 Zeichen lang sein.",
  wiederholung: "Die Wiederholung stimmt nicht mit dem neuen Passwort überein.",
};

// Fehler der E-Mail-Karte. Bleiben als Banner an ihrem Formular stehen, statt
// als Toast zu verwehen — sie verlangen eine Korrektur.
const emailFehler: Record<string, string> = {
  "email-ungueltig": "Das sieht nicht nach einer vollständigen E-Mail-Adresse aus.",
  "email-unveraendert": "Das ist bereits Ihre hinterlegte Adresse.",
  "email-vergeben":
    "Diese E-Mail-Adresse gehört bereits zu einem anderen Zugang. Jede Adresse kann nur einem Konto zugeordnet sein — hat die Verwaltung Ihnen versehentlich zwei Zugänge angelegt, kann sie diese zusammenführen.",
  "email-limit": "Zu viele Anfragen. Bitte warten Sie eine Stunde.",
  "email-kein-versand":
    "Für dieses Portal ist kein E-Mail-Versand eingerichtet — ein Bestätigungslink käme nicht an.",
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string; gespeichert?: string; grund?: string }>;
}) {
  const user = await requireUser();
  const { fehler, gespeichert, grund } = await searchParams;
  const org = await getOrganization();
  // Ohne SMTP führt der Doppel-Opt-in nicht ans Ziel: Der Bestätigungslink käme
  // nie an, und die Vormerkung stünde für immer offen. Dann wird das Formular
  // gar nicht erst angeboten, sondern gesagt, warum es fehlt — ein Weg, der
  // nicht ankommt, ist schlechter als kein Weg (vgl. die Push-Karte unten).
  const mailVersand = isMailEnabled();
  // Derselbe Schlüssel, den `PushToggle` im Browser braucht — `NEXT_PUBLIC_`
  // steht auch dem Server zur Verfügung.
  const pushEingerichtet = Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);

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
          {/* Der Name bleibt bei der Verwaltung — und das gehört an diese
              Stelle gesagt, nicht weggelassen: Er hängt an
              Eigentumsverhältnissen, Beschlüssen und bereits erzeugten
              Dokumenten. Wer ihn hier änderte, änderte sie mit. Telefon,
              Anschrift und E-Mail-Adresse pflegen Sie dagegen selbst — die
              Karten daneben. */}
          <p className="mt-4 text-xs text-gray-500">
            Den Namen führt die Verwaltung
            {org?.email ? ` (${org.email})` : ""}: Er steht in Eigentumsnachweisen,
            Beschlüssen und Abrechnungen und wird dort mitgeführt.
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

        {/* Kontaktdaten — direkt speicherbar, ohne Umweg über die Verwaltung.
            Ein falsch geschriebener Straßenname kostet niemanden mehr als eine
            Korrektur, und unter welcher Nummer jemand erreichbar sein möchte,
            weiß nur er selbst. Für jede Rolle: Auch ein Mieter darf seine
            Telefonnummer nachtragen. */}
        <Card title="Kontaktdaten" id="kontaktdaten">
          <form action={saveContactData} className="grid gap-3 sm:grid-cols-2">
            <Field label="Telefon">
              <input
                type="tel"
                name="phone"
                defaultValue={user.phone ?? ""}
                autoComplete="tel"
                className={inputClass}
              />
            </Field>
            <SelectField
              label="Bevorzugter Kontaktweg"
              name="preferredContact"
              defaultValue={user.preferredContact ?? ""}
            >
              <option value="">– keine Angabe –</option>
              {CONTACT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {contactMethodLabels[m]}
                </option>
              ))}
            </SelectField>
            <div className="sm:col-span-2">
              <Field label="Straße und Hausnummer">
                <input
                  type="text"
                  name="street"
                  defaultValue={user.street ?? ""}
                  autoComplete="street-address"
                  className={inputClass}
                />
              </Field>
            </div>
            <Field label="PLZ">
              <input
                type="text"
                name="zip"
                defaultValue={user.zip ?? ""}
                autoComplete="postal-code"
                inputMode="numeric"
                className={inputClass}
              />
            </Field>
            <Field label="Ort">
              <input
                type="text"
                name="city"
                defaultValue={user.city ?? ""}
                autoComplete="address-level2"
                className={inputClass}
              />
            </Field>
            <div className="sm:col-span-2">
              <PendingButton className={buttonClass}>Kontaktdaten speichern</PendingButton>
            </div>
          </form>
          <p className="mt-3 text-xs text-gray-500">
            Die Anschrift ist Ihre Post- und Rechnungsanschrift. Sie muss nicht die
            Anschrift Ihrer Wohnung sein — bei vermieteten Einheiten ist sie es meist nicht.
          </p>
        </Card>

        {/* E-Mail-Adresse: eigener, gesicherter Weg. Sie ist zugleich der
            Anmeldename und @unique — ein Tippfehler sperrt den Zugang aus, und
            ohne Bestätigung ließe sich eine fremde Adresse eintragen und
            darüber ein Passwort-Reset umleiten. Deshalb Doppel-Opt-in:
            Übernahme erst nach Klick im neuen Postfach. */}
        <Card title="E-Mail-Adresse" id="email">
          {fehler && fehler.startsWith("email-") ? (
            <Alert variant="error" className="mb-3">
              {emailFehler[fehler] ?? "Die E-Mail-Adresse konnte nicht geändert werden."}
            </Alert>
          ) : null}

          <p className="text-sm text-gray-600">
            {user.email ? (
              <>
                Hinterlegt ist <strong className="text-gray-900">{user.email}</strong> — sie
                ist zugleich Ihr Anmeldename und das Ziel für Passwort-Links.
              </>
            ) : (
              <>
                Für Ihr Konto ist noch keine E-Mail-Adresse hinterlegt; Sie melden sich mit
                dem Benutzernamen{" "}
                <strong className="text-gray-900">{user.username ?? "—"}</strong> an. Tragen
                Sie eine Adresse nach, um Benachrichtigungen zu erhalten und Ihr Passwort
                selbst zurücksetzen zu können.
              </>
            )}
          </p>

          {!mailVersand ? (
            // Ehrlich statt hilfsbereit: Ohne SMTP käme der Bestätigungslink
            // nie an. Ein Formular anzubieten, das in eine Vormerkung ohne
            // Ausgang führt, wäre schlechter als der Hinweis.
            <Alert variant="info" className="mt-3">
              Für dieses Portal ist kein E-Mail-Versand eingerichtet. Der Bestätigungslink
              käme nicht an, deshalb ist die Änderung hier nicht möglich — Ihre Verwaltung
              {org?.email ? ` (${org.email})` : ""} trägt die Adresse für Sie ein.
            </Alert>
          ) : user.pendingEmail ? (
            <div className="mt-3 rounded-xl bg-gray-50 p-3">
              <p className="text-sm text-gray-700">
                Angefragt: <strong className="text-gray-900">{user.pendingEmail}</strong>
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Wir haben einen Bestätigungslink an diese Adresse gesendet
                {user.emailChangeExpiry
                  ? ` (gültig bis ${formatDate(user.emailChangeExpiry)})`
                  : ""}
                . Erst der Klick darin übernimmt sie. Bis dahin melden Sie sich weiter mit
                Ihrer bisherigen Adresse an.
              </p>
              <form action={cancelEmailChange} className="mt-2">
                <ConfirmActionButton
                  className="text-xs text-red-600 hover:underline"
                  confirmLabel="Anfrage wirklich zurücknehmen?"
                  pendingLabel="Wird zurückgenommen…"
                >
                  Anfrage zurücknehmen
                </ConfirmActionButton>
              </form>
            </div>
          ) : (
            <form action={requestEmailChange} className="mt-3 space-y-3">
              <Field label={user.email ? "Neue E-Mail-Adresse" : "E-Mail-Adresse"}>
                <input
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  placeholder="name@beispiel.de"
                  className={inputClass}
                />
              </Field>
              <PendingButton className={buttonClass} pendingLabel="Link wird gesendet…">
                Bestätigungslink senden
              </PendingButton>
              <p className="text-xs text-gray-500">
                An die neue Adresse geht ein Link, der {EMAIL_WECHSEL_GUELTIG_STUNDEN} Stunden
                gilt. Erst der Klick darin übernimmt sie; Ihre bisherige Adresse wird über die
                Anfrage benachrichtigt.
              </p>
            </form>
          )}
        </Card>

        <Card title="Passwort ändern">
          {/* Erfolg meldet der ToastHost (`?flash=…`). Fehler bleiben hier als
              Banner am Formular stehen, bis sie behoben sind. `signatur`,
              `mfa-…` und `email-…` gehören zu den anderen Karten. */}
          {fehler &&
          fehler !== "signatur" &&
          !fehler.startsWith("mfa-") &&
          !fehler.startsWith("email-") ? (
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

        <Card title="Zwei-Faktor-Anmeldung">
          {fehler === "mfa-limit" ? (
            <Alert variant="error" className="mb-3">
              Zu viele Versuche. Bitte warten Sie 15 Minuten.
            </Alert>
          ) : fehler === "mfa-code" ? (
            <Alert variant="error" className="mb-3">
              Der Code aus der App hat nicht gepasst — er wechselt alle 30 Sekunden.
            </Alert>
          ) : null}

          {user.totpEnabledAt || user.mfaEmailEnabledAt ? (
            <>
              <p className="text-sm text-gray-600">
                Aktiv seit {formatDate(user.totpEnabledAt ?? user.mfaEmailEnabledAt!)}.
                Zusätzlich zum Passwort schützt{" "}
                {user.totpEnabledAt
                  ? "ein Code aus Ihrer Authenticator-App"
                  : "ein per E-Mail zugesandter Code"}{" "}
                die Anmeldung.
              </p>
              <p className="mt-2 text-sm text-gray-600">
                Verbleibende Wiederherstellungscodes:{" "}
                <strong>{user.mfaRecoveryCodes.length}</strong>
                {user.mfaRecoveryCodes.length <= 3
                  ? " — bitte bald neue erzeugen."
                  : null}
              </p>
              {user.mfaEmailEnabledAt ? (
                // Beim E-Mail-Verfahren muss der Code für die Handgriffe unten
                // erst ins Postfach — eigenes Formular, damit der Knopf nicht
                // an der Pflicht-Prüfung des (noch leeren) Code-Feldes hängt.
                <form action={sendeKontoMfaCode} className="mt-2">
                  <PendingButton
                    className="text-xs text-brand-green hover:underline"
                    pendingLabel="Wird gesendet…"
                  >
                    Code für Änderungen anfordern
                  </PendingButton>
                </form>
              ) : null}
              {/* Beide Handgriffe verlangen einen frischen Code des gewählten
                  Verfahrens: Eine offene Sitzung allein darf weder den Schutz
                  abschalten noch sich einen Satz Ersatzcodes ausstellen. */}
              <form action={erneuereRecoveryCodes} className="mt-4 space-y-3 border-t border-gray-100 pt-4">
                <Field label={user.totpEnabledAt ? "Code aus der App" : "Code aus der E-Mail"}>
                  <input
                    type="text"
                    name="code"
                    required
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    className={inputClass}
                  />
                </Field>
                <div className="flex flex-wrap items-center gap-4">
                  <PendingButton className={buttonSecondaryClass}>
                    Neue Wiederherstellungscodes
                  </PendingButton>
                  {/* Zielt per formAction auf die Abschalt-Action — derselbe
                      Code, ein Formular, zwei Ausgänge. */}
                  <ConfirmActionButton
                    className="text-xs text-red-600 hover:underline"
                    confirmLabel="Schutz wirklich abschalten?"
                    pendingLabel="Wird abgeschaltet…"
                    formAction={deaktiviereMfa}
                  >
                    Abschalten
                  </ConfirmActionButton>
                </div>
              </form>
            </>
          ) : (
            <>
              <p className="mb-4 text-sm text-gray-600">
                Optional: Schützen Sie Ihre Anmeldung zusätzlich zum Passwort mit
                einem 6-stelligen Code — aus einer Authenticator-App auf Ihrem
                Handy oder bequem per E-Mail.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link href="/mfa-einrichten" className={buttonClass}>
                  Mit App einrichten
                </Link>
                {user.email ? (
                  <form action={starteEmailMfa}>
                    <PendingButton className={buttonSecondaryClass} pendingLabel="Code wird gesendet…">
                      Per E-Mail aktivieren
                    </PendingButton>
                  </form>
                ) : null}
              </div>
            </>
          )}
        </Card>

        {/* Unterschrift und Vollmacht führt nur der Eigentümer selbst – er ist
            der Wohnungsgeber, in dessen Namen die Bescheinigung entsteht. */}
        {user.role === "EIGENTUEMER" ? (
          <Card title="Unterschrift & Vollmacht">
            {/* „Bitte erneut versuchen" war der falsche Rat, wenn die
                Dateiablage fehlt: Dann hilft kein zweiter Versuch. */}
            {fehler === "signatur" ? (
              <AblageAlert
                titel="Die Unterschrift wurde nicht gespeichert."
                grund={grund}
                className="mb-3"
              />
            ) : null}
            <VollmachtKarte user={user} />
          </Card>
        ) : null}

        {/* Ohne eingerichteten Push-Dienst entfällt der Abschnitt vollständig —
            samt seiner Einleitung. Nur die Meldung darin auszutauschen genügte
            nicht: Der Text verspricht eine Funktion, die es dann nicht gibt,
            und der Kunde kann weder etwas damit anfangen noch etwas daran
            ändern. Die Prüfung steht hier serverseitig, damit die Karte gar
            nicht erst ausgeliefert wird. */}
        {pushEingerichtet ? (
          <Card title="Benachrichtigungen">
            <p className="mb-3 text-sm text-gray-600">
              Erhalten Sie Push-Benachrichtigungen auf diesem Gerät, z. B. bei neuen Antworten,
              Nachrichten oder Vorgängen. Am besten funktioniert das, wenn Sie das Portal über
              „Zum Startbildschirm hinzufügen“ installieren.
            </p>
            <PushToggle />
          </Card>
        ) : null}

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
