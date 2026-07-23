import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonClass } from "@/components/ui";
import { BwLogo } from "@/components/logo";
import { getUser } from "@/lib/session";
import { isWegSaas } from "@/lib/app-mode";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getUser();
  // Eingeloggt: in beiden Modi direkt ins Portal.
  if (user) redirect("/dashboard");

  // B&W-Variante (APP_MODE=verwaltung): Startseite ist der Login.
  if (!isWegSaas()) redirect("/login");

  // WEG-SaaS-Variante (APP_MODE=weg): öffentliche Landing-Page.
  // PLATZHALTER – hier wird später der bestehende Landing-Page-Branch integriert
  // (dann diesen Block ersetzen, das Modus-Gating oben bleibt bestehen).
  return (
    <main className="flex min-h-screen flex-1 items-center justify-center bg-gradient-to-br from-brand-green via-brand-green to-brand-green-dark px-4 py-16">
      <div className="w-full max-w-lg animate-page-in rounded-2xl bg-white p-8 text-center shadow-2xl shadow-black/30 sm:p-12">
        <BwLogo className="mx-auto mb-6 h-16 w-auto" />
        <h1 className="mb-3 text-2xl font-bold text-brand-green sm:text-3xl">
          Das Portal für Ihre selbstverwaltete WEG
        </h1>
        <p className="mb-8 text-sm leading-relaxed text-gray-600">
          Finanzen, Wirtschaftsplan, Jahresabrechnung, Versammlungen und Beschlüsse –
          alles an einem Ort. Legen Sie kostenlos Ihr WEG-Portal an oder melden Sie
          sich an.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/registrieren" className={`${buttonClass} px-6 py-2.5`}>
            Kostenlos einrichten
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-lg border-2 border-brand-green px-6 py-2.5 text-sm font-semibold text-brand-green transition hover:bg-brand-green/5"
          >
            Anmelden
          </Link>
        </div>
        <p className="mt-8 text-xs text-gray-400">
          <Link href="/impressum" className="hover:underline">
            Impressum
          </Link>{" "}
          ·{" "}
          <Link href="/datenschutz" className="hover:underline">
            Datenschutz
          </Link>
        </p>
      </div>
    </main>
  );
}
