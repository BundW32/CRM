import { Alert, Card, Field, PageTitle, buttonClass, inputClass } from "@/components/ui";
import { PushToggle } from "@/components/push-toggle";
import { formatDate, roleLabels } from "@/lib/labels";
import { getOrganization, requireUser } from "@/lib/session";
import { changePassword } from "./actions";
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
  searchParams: Promise<{ fehler?: string }>;
}) {
  const user = await requireUser();
  const { fehler } = await searchParams;
  const org = await getOrganization();

  return (
    <>
      <PageTitle>Konto</PageTitle>

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
            <button type="submit" className={buttonClass}>
              Passwort ändern
            </button>
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
      </div>
    </>
  );
}
