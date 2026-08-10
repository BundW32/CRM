import Link from "next/link";
import QRCode from "qrcode";
import { PendingButton } from "@/components/pending-button";
import { Alert, buttonClass, buttonSecondaryClass, inputClass, Field } from "@/components/ui";
import { PublicBrand } from "@/components/public-brand";
import { productName } from "@/lib/app-mode";
import { decryptSecret } from "@/lib/crypto";
import { istMfaPflicht } from "@/lib/mfa";
import { liesRecoveryCodes } from "@/lib/mfa-anzeige";
import { requireUser } from "@/lib/session";
import { otpauthUrl } from "@/lib/totp";
import { logout } from "../login/actions";
import { bestaetigeMfa, starteMfaEinrichtung } from "./actions";

export const dynamic = "force-dynamic";

// Einrichtung der Zwei-Faktor-Anmeldung (P1-10). Liegt wie /passwort-festlegen
// AUSSERHALB der Portal-Shell: Für Betreiber und SuperAdmins ist MFA Pflicht,
// das Portal-Layout leitet sie hierher, bis die Einrichtung steht — die Seite
// selbst muss dabei erreichbar bleiben.
export default async function MfaEinrichtenPage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string; fertig?: string }>;
}) {
  const user = await requireUser();
  const { fehler, fertig } = await searchParams;
  const pflicht = istMfaPflicht(user);

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
                Passwort-Manager): Jeder Code ersetzt <strong>einmal</strong> die
                App, falls das Handy verloren geht. <strong>Sie werden nur jetzt
                angezeigt.</strong>
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
          ) : user.totpEnabledAt ? (
            <>
              <p className="mb-5 text-sm text-gray-600">
                Die Zwei-Faktor-Anmeldung ist für Ihr Konto aktiv. Verwalten können Sie
                sie unter „Konto“ — dort lassen sich auch neue Wiederherstellungscodes
                erzeugen.
              </p>
              <Link href="/dashboard" className={`${buttonClass} block w-full text-center`}>
                Zum Portal
              </Link>
            </>
          ) : user.totpSecret ? (
            <SchrittZwei fehler={fehler} user={user} />
          ) : (
            <>
              <p className="mb-3 text-sm text-gray-600">
                {pflicht
                  ? "Ihr Konto kann besonders viel: Es verwaltet die Daten Ihrer " +
                    "Gemeinschaften. Deshalb ist hier ein zweiter Faktor Pflicht — " +
                    "neben dem Passwort ein 6-stelliger Code aus einer App auf Ihrem Handy."
                  : "Schützen Sie Ihr Konto zusätzlich zum Passwort mit einem " +
                    "6-stelligen Code aus einer App auf Ihrem Handy."}
              </p>
              <p className="mb-5 text-sm text-gray-600">
                Sie brauchen eine Authenticator-App (z. B. Google Authenticator, Aegis
                oder den Passwort-Manager Ihrer Wahl). Die Einrichtung dauert etwa zwei
                Minuten.
              </p>
              <form action={starteMfaEinrichtung}>
                <PendingButton className={`${buttonClass} w-full`} pendingLabel="Einen Moment…">
                  Einrichtung starten
                </PendingButton>
              </form>
            </>
          )}

          {!user.totpEnabledAt && codes.length === 0 ? (
            <form action={logout} className="mt-4 text-center">
              <PendingButton
                className="text-xs text-gray-500 hover:underline"
                pendingLabel="Wird abgemeldet…"
              >
                Abmelden
              </PendingButton>
            </form>
          ) : null}
        </div>
      </div>
    </main>
  );
}

// Schritt 2: QR-Code scannen und mit dem ersten Code bestätigen. Eigene
// Komponente nur der Lesbarkeit halber — sie rendert serverseitig den QR als
// Daten-URL, das Secret verlässt den Server nie im Klartext Richtung Datenbank.
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
