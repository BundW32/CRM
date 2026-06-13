import { Card, Field, PageTitle, buttonClass, inputClass } from "@/components/ui";
import { formatDate, roleLabels } from "@/lib/labels";
import { requireUser } from "@/lib/session";
import { changePassword } from "./actions";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  aktuell: "Das aktuelle Passwort ist falsch.",
  laenge: "Das neue Passwort muss mindestens 10 Zeichen lang sein.",
  wiederholung: "Die Wiederholung stimmt nicht mit dem neuen Passwort überein.",
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string; ok?: string }>;
}) {
  const user = await requireUser();
  const { fehler, ok } = await searchParams;

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
            Änderungen an Name oder E-Mail-Adresse übernimmt die Verwaltung für
            Sie: info@bundwimmobilien.de
          </p>
        </Card>

        <Card title="Passwort ändern">
          {fehler ? (
            <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessages[fehler] ?? "Passwortänderung fehlgeschlagen."}
            </p>
          ) : null}
          {ok ? (
            <p className="mb-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
              Ihr Passwort wurde geändert.
            </p>
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
      </div>
    </>
  );
}
