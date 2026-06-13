import { buttonClass, Field, inputClass } from "@/components/ui";
import { BwLogoBadge } from "@/components/logo";
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
        <div className="mb-8 text-center">
          <BwLogoBadge />
        </div>
        <div className="rounded-2xl border border-white/10 bg-white p-7 shadow-2xl shadow-black/30">
          <h1 className="mb-2 text-lg font-semibold text-brand-green">
            Neues Passwort festlegen
          </h1>
          <p className="mb-5 text-sm text-gray-600">
            Willkommen, {user.name}! Bitte vergeben Sie zu Ihrer Sicherheit ein neues,
            persönliches Passwort.
          </p>

          {fehler ? (
            <p className="mb-4 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
              Bitte mindestens 8 Zeichen eingeben. Beide Felder müssen übereinstimmen.
            </p>
          ) : null}

          <form action={setInitialPassword} className="space-y-4">
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
            <button type="submit" className={`${buttonClass} w-full py-2.5`}>
              Passwort speichern &amp; fortfahren
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
