import Link from "next/link";
import { PendingButton } from "@/components/pending-button";
import { redirect } from "next/navigation";
import { Alert, Field, buttonClass, inputClass } from "@/components/ui";
import { AccountTypeFields } from "./account-type-fields";
import { registerOrganization } from "./actions";
import { isWegSaas, registrationEnabled } from "@/lib/app-mode";
import { WegportalLogo } from "@/components/marketing/brand";

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
  // Self-Service-Registrierung gibt es nur in der WEG-SaaS-Variante (APP_MODE=weg).
  // Im B&W-Modus (verwaltung) ist die Seite gesperrt → zurück zum Login.
  if (!registrationEnabled()) redirect("/login");

  const { fehler, ref } = await searchParams;

  return (
    // Die Seite gibt es nur in der SaaS-Variante (siehe Wächter oben), sie
    // trägt deshalb durchgehend die Wegportal24-Marke.
    <main className="wp-brand flex min-h-screen w-full flex-1">
      {/* Formular-Spalte */}
      <div className="flex w-full items-center justify-center bg-white px-4 py-10 sm:px-8 lg:w-[55%] lg:px-14">
        <div className="w-full max-w-md animate-page-in">
          <Link href="/" className="mb-8 inline-block" aria-label="Zur Startseite">
            <WegportalLogo className="h-9 w-auto" />
          </Link>
          <p className="mb-1 text-sm font-medium text-gray-400">Kostenlos registrieren</p>
          <h1 className="mb-2 text-2xl font-bold text-brand-green">Ihr eigenes WEG-Portal</h1>
          <p className="mb-6 text-sm text-gray-600">
            Für selbstverwaltende Eigentümergemeinschaften. Legen Sie kostenlos Ihr
            WEG-Portal an – im Anschluss richten Sie alles Weitere ein.
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
            <AccountTypeFields wegMode={isWegSaas()} />

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-[6rem_1fr_1fr]">
              <Field label="Anrede">
                <select name="salutation" defaultValue="" className={inputClass}>
                  <option value="">–</option>
                  <option value="Herr">Herr</option>
                  <option value="Frau">Frau</option>
                </select>
              </Field>
              <Field label="Vorname">
                <input type="text" name="firstName" required minLength={2} autoComplete="given-name" className={inputClass} />
              </Field>
              <Field label="Nachname">
                <input type="text" name="lastName" required minLength={2} autoComplete="family-name" className={inputClass} />
              </Field>
            </div>

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
            <PendingButton className={`${buttonClass} w-full py-2.5`}>Konto erstellen</PendingButton>
          </form>

          <p className="mt-6 text-sm text-gray-500">
            Bereits registriert?{" "}
            <Link href="/login" className="text-brand-green hover:underline">
              Zur Anmeldung
            </Link>
          </p>
          <p className="mt-4 text-xs text-gray-400">
            Mit der Registrierung stimmen Sie der{" "}
            <Link href="/datenschutz" className="hover:underline">
              Datenschutzerklärung
            </Link>{" "}
            zu.
          </p>
        </div>
      </div>

      {/* Markenpanel (ab lg sichtbar) */}
      <div className="relative hidden overflow-hidden lg:block lg:w-[45%]">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-green via-brand-green to-brand-green-dark" />
        <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-brand-orange/20 blur-3xl" />
        <div className="absolute -top-16 -left-10 h-56 w-56 rounded-full bg-white/5 blur-2xl" />
        <div className="relative flex h-full flex-col justify-center px-14 text-white">
          <WegportalLogo className="mb-8 h-10 w-auto" tone="hell" />
          <h2 className="max-w-md text-3xl font-bold leading-tight">
            Das digitale Portal für Ihre WEG
          </h2>
          <p className="mt-4 max-w-md text-white/70">
            WEG-Finanzen, Wirtschaftsplan, Versammlungen, Dokumente und Beirat – alles an
            einem Ort, für selbstverwaltende Eigentümergemeinschaften.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-white/85">
            {[
              "WEG-Finanzen, Wirtschaftsplan & Jahresabrechnung",
              "Versammlungen, Beschlüsse & Verwaltungsbeirat",
              "Dokumente, Zähler & Wohnungsübergaben",
            ].map((t) => (
              <li key={t} className="flex items-center gap-3">
                {/* Dunkle Tinte auf dem Akzent statt Weiß: Der Haken muss sich
                    vom Kreis abheben (3:1), das schafft Weiß auf Türkis nicht. */}
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-orange text-brand-green-dark">
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
