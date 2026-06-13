import { buttonClass, Field, inputClass } from "@/components/ui";
import { db } from "@/lib/db";
import { resetPassword } from "./actions";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  eingabe: "Bitte geben Sie ein Passwort mit mindestens 8 Zeichen ein. Beide Felder müssen übereinstimmen.",
  abgelaufen: "Dieser Link ist ungültig oder abgelaufen. Bitte fordern Sie einen neuen an.",
};

export default async function ResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ fehler?: string }>;
}) {
  const { token } = await params;
  const { fehler } = await searchParams;

  const user = await db.user.findFirst({
    where: {
      passwordResetToken: token,
      passwordResetExpiry: { gt: new Date() },
      active: true,
    },
  });

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-2xl font-bold tracking-tight text-blue-900">
            B&amp;W Immobilien Management
          </p>
          <p className="mt-1 text-sm text-gray-500">Kundenportal</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="mb-4 text-lg font-semibold">Neues Passwort vergeben</h1>

          {fehler === "abgelaufen" || !user ? (
            <div className="space-y-4">
              <p className="rounded-md bg-red-50 px-3 py-3 text-sm text-red-700">
                {errorMessages.abgelaufen}
              </p>
              <a
                href="/login/forgot"
                className="block text-center text-sm text-blue-700 hover:underline"
              >
                Neuen Reset-Link anfordern
              </a>
            </div>
          ) : (
            <>
              {fehler ? (
                <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  {errorMessages[fehler] ?? "Fehler beim Zurücksetzen."}
                </p>
              ) : null}
              <p className="mb-4 text-sm text-gray-600">
                Hallo {user.name}, vergeben Sie jetzt Ihr neues Passwort.
              </p>
              <form action={resetPassword} className="space-y-4">
                <input type="hidden" name="token" value={token} />
                <Field label="Neues Passwort (mind. 8 Zeichen)">
                  <input
                    type="password"
                    name="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className={inputClass}
                  />
                </Field>
                <Field label="Passwort bestätigen">
                  <input
                    type="password"
                    name="passwordConfirm"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className={inputClass}
                  />
                </Field>
                <button type="submit" className={`${buttonClass} w-full`}>
                  Passwort speichern &amp; anmelden
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
