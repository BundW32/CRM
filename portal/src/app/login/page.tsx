import { redirect } from "next/navigation";
import { PendingButton } from "@/components/pending-button";
import { Alert, buttonClass, inputClass, Field } from "@/components/ui";
import { BrandTheme } from "@/components/brand-theme";
import { BwLogo, OrgLogo } from "@/components/logo";
import { BRAND_EMAIL } from "@/components/marketing/brand";
import { Wordmark } from "@/components/marketing/wordmark";
import { db } from "@/lib/db";
import { publicOrgLogoUrl } from "@/lib/branding";
import { getUser } from "@/lib/session";
import { getTenantOrg } from "@/lib/tenant";
import { isWegSaas, registrationEnabled } from "@/lib/app-mode";
import { login } from "./actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string }>;
}) {
  const user = await getUser();
  if (user) redirect("/dashboard");
  if ((await db.user.count()) === 0) redirect("/setup");
  const { fehler } = await searchParams;

  // Mandanten-Branding anhand der Subdomain (sofern vorhanden).
  const tenantOrg = await getTenantOrg();
  const tenantLogo = tenantOrg ? publicOrgLogoUrl(tenantOrg) : null;

  // Wegportal24-Marke: nur in der SaaS-Variante und nur auf der Hauptdomain.
  // Auf einer Mandanten-Subdomain gilt weiterhin deren eigenes Branding.
  const wegMarke = isWegSaas() && !tenantOrg;
  // Anlaufstelle für Menschen ohne Zugang: die Verwaltung des Mandanten, sonst
  // die Marke, unter der die Seite gerade läuft.
  const kontaktMail =
    tenantOrg?.email ?? (wegMarke ? BRAND_EMAIL : "info@bundwimmobilien.de");

  return (
    // Der dunkle Grund des Portals ist ein warmes Braun. Unter der
    // Wegportal24-Marke deckt die Anmeldeseite ihn mit dem eigenen Grünverlauf
    // ab – sonst käme man von einer grünen Startseite auf eine braune
    // Anmeldung.
    <main
      className={`flex flex-1 items-center justify-center p-4 ${
        wegMarke
          ? "wp-brand bg-gradient-to-br from-wp-primary via-wp-primary-soft to-wp-ink"
          : ""
      }`}
    >
      {tenantOrg ? <BrandTheme primaryColor={tenantOrg.primaryColor} /> : null}
      <div className="w-full max-w-sm animate-page-in">
        <div className="rounded-2xl border border-white/10 bg-white p-8 shadow-2xl shadow-black/30">
          {tenantOrg ? (
            // Eigenes Logo des Mandanten, sonst nur der Name (kein B&W-Logo).
            tenantLogo ? (
              <OrgLogo src={tenantLogo} alt={tenantOrg.name} className="mx-auto mb-1 h-20 w-auto" />
            ) : (
              <p className="mb-1 text-center text-2xl font-bold text-brand-green">
                {tenantOrg.name}
              </p>
            )
          ) : wegMarke ? (
            <Wordmark className="mb-3 justify-center text-2xl" />
          ) : (
            <BwLogo className="mx-auto mb-1 h-20 w-auto" />
          )}
          <p className="mb-4 text-center text-sm font-medium text-gray-500">
            {wegMarke ? "Portal Ihrer Eigentümergemeinschaft" : "Kundenportal"}
          </p>
          <p className="mx-auto mb-6 max-w-[16rem] text-center text-[13px] leading-relaxed text-gray-500">
            {wegMarke
              ? "Ihr sicherer Zugang zu Finanzen, Beschlüssen und Dokumenten."
              : "Ihr sicherer Zugang zu Vorgängen, Dokumenten und Nachrichten."}
          </p>
          <h1 className="mb-5 text-center text-lg font-semibold text-gray-800">
            Anmelden
          </h1>
          {fehler ? (
            <div className="mb-4">
              <Alert variant="error">Anmeldedaten oder Passwort sind falsch.</Alert>
            </div>
          ) : null}
          <form action={login} className="space-y-4">
            <Field label="E-Mail-Adresse oder Benutzername">
              <input
                type="text"
                name="email"
                required
                autoComplete="username"
                className={inputClass}
              />
            </Field>
            <Field label="Passwort">
              <input
                type="password"
                name="password"
                required
                autoComplete="current-password"
                className={inputClass}
              />
            </Field>
            <PendingButton className={`${buttonClass} w-full py-2.5`}>Anmelden</PendingButton>
          </form>

          <div className="mt-4 text-center">
            <a href="/login/forgot" className="text-sm text-brand-green hover:underline">
              Passwort vergessen?
            </a>
          </div>

          {/* Self-Service-Registrierung nur in der WEG-SaaS-Variante
              (APP_MODE=weg) und nur auf der SaaS-Hauptdomain anbieten, nicht
              auf der gebrandeten Login-Seite eines Mandanten. */}
          {registrationEnabled() && !tenantOrg ? (
            <div className="mt-5 border-t border-gray-100 pt-4 text-center">
              <p className="text-xs text-gray-500">
                Hausverwaltung oder selbstverwaltende WEG?{" "}
                <a href="/registrieren" className="font-medium text-brand-orange-ink hover:underline">
                  Portal kostenlos einrichten
                </a>
              </p>
            </div>
          ) : null}
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          Noch keinen Zugang? Wenden Sie sich an{" "}
          <a href={`mailto:${kontaktMail}`} className="hover:underline">
            {kontaktMail}
          </a>
        </p>
        <p className="mt-2 text-center text-xs text-gray-400">
          <a href="/impressum" className="hover:underline">
            Impressum
          </a>{" "}
          ·{" "}
          <a href="/datenschutz" className="hover:underline">
            Datenschutz
          </a>
        </p>
      </div>
    </main>
  );
}
