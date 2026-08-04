import { Alert, buttonClass, Field, inputClass } from "@/components/ui";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/token-hash";
import { PublicBrand } from "@/components/public-brand";
import { resetPassword } from "./actions";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  eingabe: "Bitte geben Sie ein Passwort mit mindestens 10 Zeichen ein. Beide Felder müssen übereinstimmen.",
  abgelaufen: "Dieser Link ist ungültig oder abgelaufen. Bitte fordern Sie einen neuen an.",
};

export default async function ResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ fehler?: string; einladung?: string }>;
}) {
  const { token } = await params;
  const { fehler, einladung } = await searchParams;
  const isInvite = einladung === "1";

  const user = await db.user.findFirst({
    where: {
      // Siehe reset/[token]/actions.ts: nur der Hash zählt.
      passwordResetToken: hashToken(token),
      passwordResetExpiry: { gt: new Date() },
      active: true,
    },
  });

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-white/10 bg-white p-8 shadow-2xl shadow-black/30">
          <PublicBrand variant="login" />
          <p className="mb-6 text-center text-sm font-medium text-gray-400">
            Kundenportal
          </p>
          <h1 className="mb-4 text-lg font-semibold">
            {isInvite ? "Zugang einrichten" : "Neues Passwort vergeben"}
          </h1>

          {fehler === "abgelaufen" || !user ? (
            <div className="space-y-4">
              <Alert variant="error">
                {isInvite
                  ? "Dieser Einladungslink ist abgelaufen oder ungültig. Bitte wenden Sie sich an die Verwaltung."
                  : errorMessages.abgelaufen}
              </Alert>
              {!isInvite ? (
                <a
                  href="/login/forgot"
                  className="block text-center text-sm text-brand-green hover:underline"
                >
                  Neuen Reset-Link anfordern
                </a>
              ) : null}
              <a href="/login" className="block text-center text-sm text-gray-500 hover:underline">
                Zur Anmeldung
              </a>
            </div>
          ) : (
            <>
              {fehler ? (
                <Alert variant="error" className="mb-4">
                  {errorMessages[fehler] ?? "Fehler beim Speichern."}
                </Alert>
              ) : null}
              <p className="mb-4 text-sm text-gray-600">
                {isInvite
                  ? `Willkommen, ${user.name}! Vergeben Sie Ihr persönliches Passwort für das B&W Kundenportal.`
                  : `Hallo ${user.name}, vergeben Sie jetzt Ihr neues Passwort.`}
              </p>
              <form action={resetPassword} className="space-y-4">
                <input type="hidden" name="token" value={token} />
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
                <button type="submit" className={`${buttonClass} w-full`}>
                  {isInvite ? "Zugang einrichten & anmelden" : "Passwort speichern & anmelden"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
