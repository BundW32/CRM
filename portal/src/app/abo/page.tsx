import { redirect } from "next/navigation";
import { PendingButton } from "@/components/pending-button";
import { PublicBrand } from "@/components/public-brand";
import { Alert, buttonClass } from "@/components/ui";
import { isWegSaas } from "@/lib/app-mode";
import { isBillingEnabled, zugriffsStatus } from "@/lib/billing";
import { logout } from "@/app/login/actions";
import { getOrganization, requireUser } from "@/lib/session";
import { openPortalAusSperre, startCheckoutAusSperre } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Sperrseite der Abo-Durchsetzung (nur WEG-SaaS).
 *
 * Hierhin leitet das Portal-Layout jede Seite um, sobald `zugriffsStatus`
 * „gesperrt" meldet — Testphase abgelaufen ohne Buchung oder Abo gekündigt.
 * Die Seite liegt bewusst AUSSERHALB der (portal)-Gruppe: Läge sie innerhalb,
 * würde die Umleitung im Layout auch sie selbst treffen und eine
 * Umleitungsschleife bauen.
 *
 * Der Weg zurück (Checkout, Kundenportal) steht nur dem SuperAdmin offen —
 * alle anderen Rollen können nichts buchen und bekommen gesagt, an wen sie
 * sich wenden.
 */
export default async function AboSperrePage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string; gebucht?: string }>;
}) {
  const user = await requireUser();
  const org = await getOrganization();
  // Ohne Organisation oder außerhalb der SaaS-Variante gibt es hier nichts zu
  // sperren — zurück ins Portal, das Layout entscheidet dann regulär.
  if (!org || !isWegSaas()) redirect("/dashboard");
  if (zugriffsStatus(org) !== "gesperrt") redirect("/dashboard");

  const sp = await searchParams;
  const kannBuchen = user.role === "VERWALTER" && Boolean(user.isSuperAdmin);
  const testphaseAbgelaufen = org.subscriptionStatus === "trialing";

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-4">
      <div className="wp-brand rounded-2xl border border-white/10 bg-white p-8 shadow-2xl shadow-black/30">
        <PublicBrand />
        <h1 className="mb-2 text-2xl font-bold text-gray-900">
          {testphaseAbgelaufen ? "Ihre Testphase ist beendet" : "Ihr Abo ist beendet"}
        </h1>
        <p className="mb-6 text-sm text-gray-600">
          {testphaseAbgelaufen
            ? "Die kostenlose Testphase Ihrer Gemeinschaft ist abgelaufen. Ihre Daten bleiben vollständig erhalten — mit einem Pro-Abo arbeiten Sie genau dort weiter, wo Sie aufgehört haben."
            : "Das Abo Ihrer Gemeinschaft ist gekündigt. Ihre Daten bleiben vollständig erhalten — mit einer neuen Buchung arbeiten Sie genau dort weiter, wo Sie aufgehört haben."}
        </p>

        {sp.gebucht ? (
          <Alert variant="success" className="mb-4">
            Vielen Dank für Ihre Buchung! Die Bestätigung der Zahlung braucht einen
            Augenblick — laden Sie diese Seite gleich neu, dann geht es ins Portal.
          </Alert>
        ) : null}
        {sp.fehler ? (
          <Alert variant="error" className="mb-4">
            {sp.fehler === "kein_kunde"
              ? "Für diese Organisation ist noch kein Zahlungskonto hinterlegt. Bitte nutzen Sie die Buchung — oder wenden Sie sich an den Support."
              : "Die Abrechnung ist noch nicht fertig eingerichtet. Bitte wenden Sie sich an den Support."}
          </Alert>
        ) : null}

        {kannBuchen ? (
          isBillingEnabled() ? (
            <div className="grid gap-3">
              <form action={startCheckoutAusSperre}>
                <PendingButton className={buttonClass} pendingLabel="Weiter zu Stripe…">
                  Pro-Abo buchen
                </PendingButton>
              </form>
              {org.stripeCustomerId ? (
                <form action={openPortalAusSperre}>
                  <PendingButton
                    className="text-sm text-gray-600 underline hover:text-gray-900"
                    pendingLabel="Wird geöffnet…"
                  >
                    Zahlungsmittel & Rechnungen verwalten (Stripe-Kundenportal)
                  </PendingButton>
                </form>
              ) : null}
            </div>
          ) : (
            <Alert variant="info">
              Die Online-Buchung ist noch nicht freigeschaltet. Bitte wenden Sie sich an
              den Support, um Ihr Abo zu verlängern.
            </Alert>
          )
        ) : (
          <Alert variant="info">
            Die Verlängerung kann nur die verwaltende Person Ihrer Gemeinschaft buchen.
            Bitte wenden Sie sich an Ihre Verwaltung.
          </Alert>
        )}

        <div className="mt-8 border-t border-gray-100 pt-4 text-sm text-gray-500">
          Angemeldet als {user.name}
          {" · "}
          <form action={logout} className="inline">
            <PendingButton
              className="text-gray-500 underline hover:text-gray-900"
              pendingLabel="Wird abgemeldet…"
            >
              Abmelden
            </PendingButton>
          </form>
        </div>
      </div>
    </main>
  );
}
