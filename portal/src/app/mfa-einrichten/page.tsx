import Link from "next/link";
import QRCode from "qrcode";
import { PendingButton } from "@/components/pending-button";
import { Alert, buttonClass, buttonSecondaryClass, inputClass, Field } from "@/components/ui";
import { PublicBrand } from "@/components/public-brand";
import { productName } from "@/lib/app-mode";
import { decryptSecret } from "@/lib/crypto";
import { hatMfa } from "@/lib/mfa";
import { liesRecoveryCodes } from "@/lib/mfa-anzeige";
import { requireUser } from "@/lib/session";
import { otpauthUrl } from "@/lib/totp";
import {
  bestaetigeEmailMfa,
  bestaetigeMfa,
  starteEmailMfa,
  starteMfaEinrichtung,
} from "./actions";

export const dynamic = "force-dynamic";

// Einrichtung der Zwei-Faktor-Anmeldung (P1-10, optional). Liegt wie
// /passwort-festlegen außerhalb der Portal-Shell — die Seite gehört zum
// Konto, nicht zu einem Arbeitsbereich. Zwei Verfahren zur Wahl:
// Authenticator-App (QR-Code + Bestätigung) oder Code per E-Mail
// (Bestätigungscode ins Postfach).
export default async function MfaEinrichtenPage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string; fertig?: string; methode?: string }>;
}) {
  const user = await requireUser();
  const { fehler, fertig, methode } = await searchParams;

  // Frisch erzeugte Wiederherstellungscodes (einmalige Anzeige über das
  // kurzlebige Cookie) — hat Vorrang vor allen anderen Zuständen.
  const codes = fertig ? await liesRecoveryCodes() : [];

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-white/10 bg-white p-8 shadow-2xl shadow-black/30">
          <PublicBrand />
          <h1 className="mb-2 text-lg font-semibold text-brand-green">
            Zwei-Faktor-Anmeldung
          </h1>

          {codes.length > 0 ? (
            <>
              <p className="mb-4 text-sm text-gray-600">
                Geschafft — die Zwei-Faktor-Anmeldung ist aktiv. Bewahren Sie diese
                Wiederherstellungscodes sicher auf (ausdrucken oder in den
                Passwort-Manager): Jeder Code ersetzt <strong>einmal</strong> den
                zweiten Faktor, falls er nicht verfügbar ist. <strong>Sie werden nur
                jetzt angezeigt.</strong>
              </p>
              <ul className="mb-5 grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg border border-gray-200 bg-gray-50 p-4 font-mono text-sm text-gray-800">
                {codes.map((code) => (
                  <li key={code}>{code}</li>
                ))}
              </ul>
              <Link href="/dashboard" className={`${buttonClass} block w-full text-center`}>
                Weiter zum Portal
              </Link>
            </>
          ) : hatMfa(user) ? (
            <>
              <p className="mb-5 text-sm text-gray-600">
                Die Zwei-Faktor-Anmeldung ist für Ihr Konto aktiv. Verwalten können Sie
                sie unter „Konto“ — dort lassen sich auch neue Wiederherstellungscodes
                erzeugen oder der Schutz abschalten.
              </p>
              <Link href="/dashboard" className={`${buttonClass} block w-full text-center`}>
                Zum Portal
              </Link>
            </>
          ) : methode === "email" ? (
            <EmailBestaetigen fehler={fehler} email={user.email} />
          ) : user.totpSecret ? (
            <SchrittZwei fehler={fehler} user={user} />
          ) : (
            <>
              <p className="mb-3 text-sm text-gray-600">
                Optional: Schützen Sie Ihr Konto zusätzlich zum Passwort mit einem
                6-stelligen Code. Sie haben die Wahl zwischen einer Authenticator-App
                auf Ihrem Handy (z. B. Google Authenticator, Aegis oder Ihr
                Passwort-Manager) und einem Code, der Ihnen bei jeder Anmeldung per
                E-Mail zugeschickt wird.
              </p>
              <form action={starteMfaEinrichtung} className="mb-3">
                <PendingButton className={`${buttonClass} w-full`} pendingLabel="Einen Moment…">
                  Mit Authenticator-App einrichten
                </PendingButton>
              </form>
              {user.email ? (
                <form action={starteEmailMfa}>
                  <PendingButton
                    className={`${buttonSecondaryClass} w-full`}
                    pendingLabel="Code wird gesendet…"
                  >
                    Code per E-Mail erhalten
                  </PendingButton>
                </form>
              ) : (
                <p className="text-xs text-gray-500">
                  Das E-Mail-Verfahren steht nur Konten mit hinterlegter
                  E-Mail-Adresse offen.
                </p>
              )}
            </>
          )}

          {!hatMfa(user) && codes.length === 0 ? (
            <p className="mt-4 text-center text-xs text-gray-500">
              <Link href="/dashboard" className="hover:underline">
                Später — zurück zum Portal
              </Link>
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}

// E-Mail-Verfahren, Schritt 2: den zugesandten Code bestätigen. Erst die
// richtige Eingabe schaltet das Verfahren scharf — sie beweist, dass das
// Postfach wirklich erreichbar ist.
function EmailBestaetigen({ fehler, email }: { fehler?: string; email: string | null }) {
  return (
    <>
      <p className="mb-4 text-sm text-gray-600">
        Wir haben einen 6-stelligen Code an <strong>{email}</strong> geschickt.
        Geben Sie ihn hier ein, um das E-Mail-Verfahren zu aktivieren.
      </p>

      {fehler === "limit" ? (
        <Alert variant="error" className="mb-4">
          Zu viele Versuche. Bitte warten Sie 15 Minuten und versuchen Sie es erneut.
        </Alert>
      ) : fehler ? (
        <Alert variant="error" className="mb-4">
          Der Code hat nicht gepasst oder ist abgelaufen. Fordern Sie bei Bedarf
          einen neuen an.
        </Alert>
      ) : null}

      <form action={bestaetigeEmailMfa} className="space-y-4">
        <Field label="Code aus der E-Mail">
          <input
            type="text"
            name="code"
            required
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            className={inputClass}
          />
        </Field>
        <PendingButton className={`${buttonClass} w-full`} pendingLabel="Wird geprüft…">
          Aktivieren
        </PendingButton>
      </form>

      <form action={starteEmailMfa} className="mt-3 text-center">
        <PendingButton
          className="text-xs text-gray-500 hover:underline"
          pendingLabel="Wird gesendet…"
        >
          Code erneut senden
        </PendingButton>
      </form>
    </>
  );
}

// App-Verfahren, Schritt 2: QR-Code scannen und mit dem ersten Code bestätigen.
// Eigene Komponente nur der Lesbarkeit halber — sie rendert serverseitig den QR
// als Daten-URL, das Secret verlässt den Server nie im Klartext Richtung
// Datenbank.
async function SchrittZwei({
  fehler,
  user,
}: {
  fehler?: string;
  user: { totpSecret: string | null; email: string | null; username: string | null; name: string };
}) {
  const secret = decryptSecret(user.totpSecret!);
  const konto = user.email ?? user.username ?? user.name;
  const qr = await QRCode.toDataURL(otpauthUrl(secret, konto, productName()), {
    width: 220,
    margin: 1,
  });

  return (
    <>
      <p className="mb-4 text-sm text-gray-600">
        Scannen Sie den QR-Code mit Ihrer Authenticator-App und geben Sie danach den
        angezeigten 6-stelligen Code ein.
      </p>

      {fehler === "limit" ? (
        <Alert variant="error" className="mb-4">
          Zu viele Versuche. Bitte warten Sie 15 Minuten und versuchen Sie es erneut.
        </Alert>
      ) : fehler ? (
        <Alert variant="error" className="mb-4">
          Der Code hat nicht gepasst. Bitte den aktuell angezeigten Code eingeben —
          er wechselt alle 30 Sekunden.
        </Alert>
      ) : null}

      {/* eslint-disable-next-line @next/next/no-img-element -- Daten-URL, kein Optimierungsfall */}
      <img
        src={qr}
        alt="QR-Code für die Authenticator-App"
        className="mx-auto mb-3 rounded-lg border border-gray-200"
        width={220}
        height={220}
      />
      <p className="mb-4 break-all text-center text-xs text-gray-500">
        Ohne Kamera: Secret von Hand eintragen — <span className="font-mono">{secret}</span>
      </p>

      <form action={bestaetigeMfa} className="space-y-4">
        <Field label="Code aus der App">
          <input
            type="text"
            name="code"
            required
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            className={inputClass}
          />
        </Field>
        <PendingButton className={`${buttonClass} w-full`} pendingLabel="Wird geprüft…">
          Aktivieren
        </PendingButton>
      </form>

      <form action={starteMfaEinrichtung} className="mt-3 text-center">
        <PendingButton className={`${buttonSecondaryClass} w-full`} pendingLabel="Einen Moment…">
          Neuen QR-Code erzeugen
        </PendingButton>
      </form>
    </>
  );
}
