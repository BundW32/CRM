import { buttonClass, Field, inputClass } from "@/components/ui";
import { BwLogo } from "@/components/logo";
import { requestPasswordReset } from "./actions";

export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string; gesendet?: string }>;
}) {
  const { fehler, gesendet } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <BwLogo className="mx-auto mb-2" />
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="mb-4 text-lg font-semibold">Passwort zurücksetzen</h1>

          {gesendet ? (
            <div className="space-y-4">
              <p className="rounded-md bg-green-50 px-3 py-3 text-sm text-green-800">
                Falls die eingegebene E-Mail-Adresse in unserem System bekannt ist,
                wurde ein Link zum Zurücksetzen verschickt. Bitte prüfen Sie Ihr
                Postfach (und den Spam-Ordner).
              </p>
              <a href="/login" className="block text-center text-sm text-brand-green hover:underline">
                Zurück zur Anmeldung
              </a>
            </div>
          ) : (
            <>
              {fehler ? (
                <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  Bitte geben Sie eine gültige E-Mail-Adresse ein.
                </p>
              ) : null}
              <p className="mb-4 text-sm text-gray-600">
                Geben Sie Ihre E-Mail-Adresse ein. Wir senden Ihnen einen Link, mit dem
                Sie ein neues Passwort vergeben können.
              </p>
              <form action={requestPasswordReset} className="space-y-4">
                <Field label="E-Mail-Adresse">
                  <input
                    type="email"
                    name="email"
                    required
                    autoComplete="email"
                    className={inputClass}
                  />
                </Field>
                <button type="submit" className={`${buttonClass} w-full`}>
                  Reset-Link anfordern
                </button>
              </form>
              <p className="mt-4 text-center text-sm">
                <a href="/login" className="text-brand-green hover:underline">
                  Zurück zur Anmeldung
                </a>
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
