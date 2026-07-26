import { Alert, buttonClass, Field, inputClass } from "@/components/ui";
import { PendingButton } from "@/components/pending-button";
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
        <div className="rounded-2xl border border-white/10 bg-white p-8 shadow-2xl shadow-black/30">
          <BwLogo className="mx-auto mb-6 h-16 w-auto" />
          <h1 className="mb-4 text-lg font-semibold">Passwort zurücksetzen</h1>

          {gesendet ? (
            <div className="space-y-4">
              <Alert variant="success">
                Falls die eingegebene E-Mail-Adresse in unserem System bekannt ist,
                wurde ein Link zum Zurücksetzen verschickt. Bitte prüfen Sie Ihr
                Postfach (und den Spam-Ordner).
              </Alert>
              <a href="/login" className="block text-center text-sm text-brand-green hover:underline">
                Zurück zur Anmeldung
              </a>
            </div>
          ) : (
            <>
              {fehler ? (
                <Alert variant="error" className="mb-4">
                  Bitte geben Sie eine gültige E-Mail-Adresse ein.
                </Alert>
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
                <PendingButton className={`${buttonClass} w-full`}>Reset-Link anfordern</PendingButton>
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
