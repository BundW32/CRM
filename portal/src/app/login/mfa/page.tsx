import { redirect } from "next/navigation";
import { PendingButton } from "@/components/pending-button";
import { Alert, buttonClass, inputClass, Field } from "@/components/ui";
import { PublicBrand } from "@/components/public-brand";
import { getUser, readMfaPending } from "@/lib/session";
import { verifyMfa } from "./actions";

export const dynamic = "force-dynamic";

// Zweiter Schritt der Anmeldung (P1-10): Passwort war richtig, jetzt der Code
// aus der Authenticator-App. Die Seite lebt vom kurzlebigen
// Zwischenschritt-Cookie — ohne ihn (abgelaufen, direkt aufgerufen) zurück
// zur Anmeldung.
export default async function MfaLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string }>;
}) {
  // Wer schon voll angemeldet ist, hat hier nichts verloren.
  if (await getUser()) redirect("/dashboard");
  if (!(await readMfaPending())) redirect("/login");
  const { fehler } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-white/10 bg-white p-8 shadow-2xl shadow-black/30">
          <PublicBrand />
          <h1 className="mb-2 text-lg font-semibold text-brand-green">Bestätigungscode</h1>
          <p className="mb-5 text-sm text-gray-600">
            Geben Sie den 6-stelligen Code aus Ihrer Authenticator-App ein — oder einen
            Ihrer Wiederherstellungscodes, falls Sie das Handy nicht zur Hand haben.
          </p>

          {fehler === "limit" ? (
            <Alert variant="error" className="mb-4">
              Zu viele Versuche. Bitte warten Sie 15 Minuten und versuchen Sie es erneut.
            </Alert>
          ) : fehler ? (
            <Alert variant="error" className="mb-4">
              Der Code war nicht gültig. Bitte versuchen Sie es erneut — jeder Code gilt
              nur 30 Sekunden.
            </Alert>
          ) : null}

          <form action={verifyMfa} className="space-y-4">
            <Field label="Code">
              <input
                type="text"
                name="code"
                required
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456 oder XXXXX-XXXXX"
                className={inputClass}
              />
            </Field>
            <PendingButton className={`${buttonClass} w-full`} pendingLabel="Wird geprüft…">
              Anmelden
            </PendingButton>
          </form>

          <p className="mt-4 text-center text-xs text-gray-500">
            <a href="/login" className="hover:underline">
              Zurück zur Anmeldung
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
