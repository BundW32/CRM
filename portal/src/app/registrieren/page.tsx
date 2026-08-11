import Link from "next/link";
import { PendingButton } from "@/components/pending-button";
import { redirect } from "next/navigation";
import { Alert, Field, buttonClass, inputClass } from "@/components/ui";
import { AccountTypeFields } from "./account-type-fields";
import { registerOrganization } from "./actions";
import { isWegSaas, registrationEnabled } from "@/lib/app-mode";
import { AKTIONS_CODE, istAktionsCode, normalisiereAktionsCode } from "@/lib/aktion";
import { aktuellerAktionsStand } from "@/lib/aktion-server";
import { AktionsAngebot } from "@/components/marketing/aktion";
import { Wordmark } from "@/components/marketing/wordmark";

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
  searchParams: Promise<{ fehler?: string; ref?: string; code?: string }>;
}) {
  // Self-Service-Registrierung gibt es nur in der WEG-SaaS-Variante (APP_MODE=weg).
  // Im B&W-Modus (verwaltung) ist die Seite gesperrt → zurück zum Login.
  if (!registrationEnabled()) redirect("/login");

  const { fehler, ref, code } = await searchParams;
  // Willkommensaktion: Der Code kommt aus dem Werbelink (`?code=`), aus dem
  // Herkunfts-Link (`?ref=portal24`) — oder er wird unten von Hand eingetippt.
  // Normalisiert, damit „Portal24-" aus einer Weitererzählung im Feld richtig
  // dasteht; die Gültigkeit prüft ohnehin allein der Server.
  const aktion = await aktuellerAktionsStand();
  const codeAusLink = normalisiereAktionsCode(code) || (istAktionsCode(ref) ? AKTIONS_CODE : "");

  return (
    // Die Seite gibt es nur in der SaaS-Variante (siehe Wächter oben), sie
    // trägt deshalb durchgehend die Wegportal24-Marke.
    <main className="wp-brand flex min-h-screen w-full flex-1">
      {/* Formular-Spalte */}
      <div className="flex w-full items-center justify-center bg-white px-4 py-10 sm:px-8 lg:w-[55%] lg:px-14">
        <div className="w-full max-w-md animate-page-in">
          <Link href="/" className="mb-8 inline-block" aria-label="Zur Startseite">
            <Wordmark className="text-xl" />
          </Link>
          <p className="mb-1 text-sm font-medium text-gray-400">Kostenlos registrieren</p>
          <h1 className="mb-2 text-2xl font-bold text-brand-green">Das Portal für Ihre selbstverwaltete WEG</h1>
          <p className="mb-6 text-sm text-gray-600">
            Legen Sie kostenlos das Portal Ihrer Eigentümergemeinschaft an –
            Einheiten, Konten und Miteigentümer richten Sie im Anschluss ein.
          </p>

          {fehler ? (
            <Alert variant="error" className="mb-4">
              {errorMessages[fehler] ?? "Die Registrierung konnte nicht verarbeitet werden."}
            </Alert>
          ) : null}

          {/* Willkommensaktion: Wer über die Werbung hierher kommt, muss sie
              vor dem Absenden wiederfinden — sonst wirkt die Startseite wie
              ein anderes Angebot als die Registrierung. */}
          <AktionsAngebot variant="formular" className="mb-5" />
          {/* Kam ein Code an, die Aktion ist aber vorbei: sagen, was gilt.
              Stumm auf die reguläre Testphase zu schalten wäre die Variante,
              bei der sich jemand hinterher getäuscht fühlt. */}
          {!aktion && codeAusLink ? (
            <Alert variant="info" className="mb-5">
              Die Willkommensaktion ist beendet. Sie können sich weiter
              kostenlos registrieren – es gilt die reguläre Testphase.
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
            {/* Das Feld gibt es nur, solange die Aktion läuft — ein Code-Feld
                ohne Aktion nimmt eine Eingabe an und wirft sie weg. Aus dem
                Werbelink ist es vorausgefüllt; ohne Code bleibt es leer und
                die Registrierung läuft wie immer. */}
            {aktion ? (
              <Field label="Aktionscode (optional)">
                <input
                  type="text"
                  name="aktionscode"
                  defaultValue={codeAusLink}
                  placeholder={aktion.code}
                  maxLength={40}
                  autoComplete="off"
                  spellCheck={false}
                  className={`${inputClass} uppercase placeholder:normal-case placeholder:text-gray-400`}
                />
                <span className="mt-1 block text-xs font-normal text-gray-500">
                  Mit Code {aktion.code} sind die ersten {aktion.gratisMonate} Monate
                  gratis – gültig bis {aktion.endeText}.
                </span>
              </Field>
            ) : null}
            <label className="flex items-start gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                name="terms"
                value="1"
                required
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-brand-orange focus:ring-brand-orange"
              />
              {/* Verlinkt wird die maßgebliche Datenschutzerklärung, nicht
                  mehr `/datenschutz-saas`: Jene Seite trägt den Hinweis
                  „Entwurf – noch nicht rechtsverbindlich geprüft". Ein
                  Dokument, das man beim Anhaken als Entwurf zu erkennen gibt,
                  ist die denkbar schlechteste Grundlage für eine Zustimmung. */}
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
                <Link href="/datenschutz" target="_blank" className="text-brand-green hover:underline">
                  Datenschutzerklärung
                </Link>{" "}
                sowie die{" "}
                <Link href="/widerruf" target="_blank" className="text-brand-green hover:underline">
                  Widerrufsbelehrung
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
          <Wordmark className="mb-8 text-2xl" tone="light" />
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
