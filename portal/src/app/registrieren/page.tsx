import Link from "next/link";
import { Alert, Field, buttonClass, inputClass } from "@/components/ui";
import { AccountTypeFields } from "./account-type-fields";
import { registerOrganization } from "./actions";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  eingabe: "Bitte alle Felder ausfüllen (Passwort mind. 10 Zeichen).",
  email: "Diese E-Mail-Adresse ist bereits vergeben.",
  limit: "Zu viele Registrierungen. Bitte versuchen Sie es später erneut.",
  agb: "Bitte stimmen Sie AGB und AVV zu, um fortzufahren.",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string; ref?: string }>;
}) {
  const { fehler, ref } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-md animate-page-in">
        <div className="rounded-2xl border border-white/10 bg-white p-8 shadow-2xl shadow-black/30">
          <p className="mb-1 text-center text-sm font-medium text-gray-400">
            Kostenlos registrieren
          </p>
          <h1 className="mb-2 text-center text-xl font-bold text-brand-green">
            Ihr eigenes Kundenportal
          </h1>
          <p className="mx-auto mb-6 max-w-sm text-center text-sm text-gray-600">
            Für Hausverwaltungen und selbstverwaltende WEGs. Legen Sie kostenlos Ihr Konto
            an – im Anschluss richten Sie Logo, Farbe und Daten ein.
          </p>

          {fehler ? (
            <Alert variant="error" className="mb-4">
              {errorMessages[fehler] ?? "Die Registrierung konnte nicht verarbeitet werden."}
            </Alert>
          ) : null}

          <form action={registerOrganization} className="space-y-4">
            {/* Honeypot gegen Bots – für Menschen unsichtbar, nicht ausfüllen. */}
            <div aria-hidden="true" className="hidden">
              <label>
                Website
                <input type="text" name="hp_url" tabIndex={-1} autoComplete="off" />
              </label>
            </div>
            {/* Herkunft der Registrierung (z. B. von HausMatch verlinkt). */}
            {ref ? <input type="hidden" name="ref" value={ref} /> : null}
            <AccountTypeFields />
            <Field label="Ihr Name">
              <input type="text" name="name" required minLength={2} className={inputClass} />
            </Field>
            <Field label="E-Mail-Adresse">
              <input type="email" name="email" required autoComplete="email" className={inputClass} />
            </Field>
            <Field label="Passwort (mind. 10 Zeichen)">
              <input
                type="password"
                name="password"
                required
                minLength={10}
                autoComplete="new-password"
                className={inputClass}
              />
            </Field>
            <label className="flex items-start gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                name="terms"
                value="1"
                required
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-brand-orange focus:ring-brand-orange"
              />
              <span>
                Ich akzeptiere die{" "}
                <Link href="/agb" target="_blank" className="text-brand-green hover:underline">
                  AGB
                </Link>{" "}
                und den{" "}
                <Link href="/avv" target="_blank" className="text-brand-green hover:underline">
                  AVV
                </Link>{" "}
                und habe die{" "}
                <Link href="/datenschutz-saas" target="_blank" className="text-brand-green hover:underline">
                  Datenschutzhinweise
                </Link>{" "}
                gelesen.
              </span>
            </label>
            <button type="submit" className={`${buttonClass} w-full py-2.5`}>
              Konto erstellen
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-gray-500">
            Bereits registriert?{" "}
            <Link href="/login" className="text-brand-green hover:underline">
              Zur Anmeldung
            </Link>
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-gray-400">
          Mit der Registrierung stimmen Sie der{" "}
          <Link href="/datenschutz" className="hover:underline">
            Datenschutzerklärung
          </Link>{" "}
          zu.
        </p>
      </div>
    </main>
  );
}
