import Link from "next/link";
import { Field, buttonClass, inputClass } from "@/components/ui";
import { registerOrganization } from "./actions";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  eingabe: "Bitte alle Felder ausfüllen (Passwort mind. 10 Zeichen).",
  email: "Diese E-Mail-Adresse ist bereits vergeben.",
  limit: "Zu viele Registrierungen. Bitte versuchen Sie es später erneut.",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string }>;
}) {
  const { fehler } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-md animate-page-in">
        <div className="rounded-2xl border border-white/10 bg-white p-8 shadow-2xl shadow-black/30">
          <p className="mb-1 text-center text-sm font-medium text-gray-400">
            Hausverwaltung registrieren
          </p>
          <h1 className="mb-2 text-center text-xl font-bold text-brand-green">
            Ihr eigenes Kundenportal
          </h1>
          <p className="mx-auto mb-6 max-w-sm text-center text-sm text-gray-600">
            Legen Sie kostenlos Ihr Verwalter-Konto an. Im Anschluss richten Sie Logo,
            Farbe und Impressum Ihrer Hausverwaltung ein.
          </p>

          {fehler ? (
            <p className="mb-4 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
              {errorMessages[fehler] ?? "Die Registrierung konnte nicht verarbeitet werden."}
            </p>
          ) : null}

          <form action={registerOrganization} className="space-y-4">
            <Field label="Name der Hausverwaltung">
              <input
                type="text"
                name="company"
                required
                minLength={2}
                maxLength={200}
                placeholder="z. B. Muster Hausverwaltung GmbH"
                className={inputClass}
              />
            </Field>
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
