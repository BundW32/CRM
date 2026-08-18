import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { SERVICE_EMAIL, wpButtonSecondaryClass } from "@/components/marketing/brand";
import { MarketingFooter, MarketingHeader } from "@/components/marketing/site";
import { NICHT_INDEXIEREN } from "@/lib/seo";

// Statisch mit Hintergrund-Aktualisierung (ISR): reine Bestätigungsseite ohne
// Nutzerdaten. Der Wächter (App-Modus, Mandanten-Subdomain) läuft im Proxy
// (src/proxy.ts) — eine statische Seite kann weder `headers()` noch
// `cookies()` lesen.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Nachricht eingegangen",
  description: "Bestätigung des Eingangs Ihrer Nachricht über den Kontakt-Funnel.",
  robots: NICHT_INDEXIEREN,
};

/**
 * Abschluss des Kontakt-Funnels. Ein Formular, das nach dem Absenden schweigt,
 * lässt die Person im Unklaren, ob ihre Nachricht angekommen ist — deshalb
 * eine eigene Seite; die inhaltliche Bestätigung geht zusätzlich per E-Mail.
 */
export default async function KontaktDankePage() {

  return (
    <main className="mk-light flex flex-1 flex-col">
      <MarketingHeader />
      <section id="inhalt" className="mx-auto w-full max-w-2xl flex-1 px-4 pb-20 pt-12 sm:px-6 sm:pt-16">
        <div className="rounded-2xl border border-wp-ink/10 bg-white p-6 shadow-e2 sm:p-8">
          <CheckCircle2 className="h-9 w-9 text-wp-accent-ink" aria-hidden />
          <h1 className="mt-4 text-2xl font-extrabold text-wp-ink sm:text-3xl">
            Ihre Nachricht ist eingegangen
          </h1>
          <div className="mt-4 space-y-3 leading-relaxed text-gray-600">
            <p>
              Vielen Dank. Eine Bestätigung mit dem Inhalt Ihrer Nachricht ist an
              die von Ihnen angegebene E-Mail-Adresse unterwegs — wir melden uns
              so schnell wie möglich bei Ihnen.
            </p>
            <p className="text-sm text-gray-500">
              Sollte die Bestätigung nicht innerhalb weniger Minuten ankommen,
              sehen Sie bitte im Spam-Ordner nach oder schreiben Sie an{" "}
              <a
                href={`mailto:${SERVICE_EMAIL}`}
                className="font-medium text-wp-primary underline hover:no-underline"
              >
                {SERVICE_EMAIL}
              </a>
              .
            </p>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/" className={`${wpButtonSecondaryClass} min-h-11 px-5`}>
              Zur Startseite
            </Link>
            <Link href="/so-funktionierts" className={`${wpButtonSecondaryClass} min-h-11 px-5`}>
              So funktioniert’s
            </Link>
          </div>
        </div>
      </section>
      <MarketingFooter />
    </main>
  );
}
