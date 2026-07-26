import { Alert, buttonClass, Field, inputClass } from "@/components/ui";
import { PendingButton } from "@/components/pending-button";
import { BwLogo } from "@/components/logo";
import { requireUser } from "@/lib/session";
import { setInitialPassword } from "./actions";

export const dynamic = "force-dynamic";

export default async function PasswortFestlegenPage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string }>;
}) {
  const user = await requireUser();
  const { fehler } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-white/10 bg-white p-8 shadow-2xl shadow-black/30">
          <BwLogo className="mx-auto mb-6 h-16 w-auto" />
          <h1 className="mb-2 text-lg font-semibold text-brand-green">
            Neues Passwort festlegen
          </h1>
          <p className="mb-5 text-sm text-gray-600">
            Willkommen, {user.name}! Bitte vergeben Sie zu Ihrer Sicherheit ein neues,
            persönliches Passwort.
          </p>

          {fehler ? (
            <Alert variant="error" className="mb-4">
              Bitte mindestens 10 Zeichen eingeben. Beide Felder müssen übereinstimmen.
            </Alert>
          ) : null}

          <form action={setInitialPassword} className="space-y-4">
            <Field label="Neues Passwort (mind. 10 Zeichen)">
              <input
                type="password"
                name="password"
                required
                minLength={10}
                autoComplete="new-password"
                className={inputClass}
              />
            </Field>
            <Field label="Passwort bestätigen">
              <input
                type="password"
                name="passwordConfirm"
                required
                minLength={10}
                autoComplete="new-password"
                className={inputClass}
              />
            </Field>
            <PendingButton className={`${buttonClass} w-full py-2.5`}>Passwort speichern &amp; fortfahren</PendingButton>
          </form>
        </div>
      </div>
    </main>
  );
}
