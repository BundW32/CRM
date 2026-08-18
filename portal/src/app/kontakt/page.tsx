import type { Metadata } from "next";
import { SERVICE_EMAIL } from "@/components/marketing/brand";
import { MarketingFooter, MarketingHeader } from "@/components/marketing/site";
import { Alert } from "@/components/ui";
import { KontaktFunnel } from "./kontakt-funnel";

// Bleibt dynamisch: Die Seite liest `searchParams` (Fehlermeldung des
// Formulars) und lässt sich damit nicht vorab erzeugen. Ihr Wächter
// (App-Modus, Mandanten-Subdomain) läuft trotzdem im Proxy (src/proxy.ts) —
// eine Quelle für alle öffentlichen Marken-Seiten.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kontakt – Fragen und Anregungen",
  description:
    "Frage zu wegportal24 oder eine Anregung für das Portal? In drei Schritten " +
    "zur Nachricht – Sie erhalten eine Eingangsbestätigung per E-Mail.",
};

/**
 * Kontakt-Funnel für Fragen und Anregungen. Drei Schritte statt eines langen
 * Formulars: erst das Anliegen, dann die Nachricht, zuletzt die Kontaktdaten —
 * so steht die kleinste Frage („Worum geht es?") am Anfang und die Hürde
 * (eigene Daten angeben) am Ende, wenn die Nachricht schon geschrieben ist.
 */
export default async function KontaktPage({
  searchParams,
}: {
  searchParams: Promise<{ fehler?: string }>;
}) {
  const sp = await searchParams;

  return (
    <main className="mk-light flex flex-1 flex-col">
      <MarketingHeader />
      <section id="inhalt" className="mx-auto w-full max-w-2xl flex-1 px-4 pb-20 pt-12 sm:px-6 sm:pt-16">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-wp-accent-ink">
          Kontakt
        </p>
        <h1 className="mt-3 text-balance text-3xl font-extrabold text-wp-ink sm:text-4xl">
          Fragen und Anregungen
        </h1>
        <p className="mt-4 max-w-xl leading-relaxed text-gray-600">
          Sie möchten etwas wissen, bevor Sie starten — oder haben eine Idee, was
          das Portal besser machen kann? Schreiben Sie uns. Sie erhalten sofort
          eine Eingangsbestätigung und so schnell wie möglich eine Antwort.
        </p>

        {sp.fehler ? (
          <Alert variant="error" className="mt-6">
            {sp.fehler === "limit"
              ? `Es sind zu viele Nachrichten von diesem Anschluss eingegangen. Bitte versuchen Sie es später erneut oder schreiben Sie direkt an ${SERVICE_EMAIL}.`
              : "Bitte prüfen Sie Ihre Angaben. Anliegen, Nachricht (mindestens 10 Zeichen), Name und eine gültige E-Mail-Adresse werden benötigt."}
          </Alert>
        ) : null}

        <div className="mt-8">
          <KontaktFunnel />
        </div>

        <p className="mt-6 text-sm text-gray-500">
          Lieber direkt per E-Mail? Sie erreichen uns unter{" "}
          <a
            href={`mailto:${SERVICE_EMAIL}`}
            className="font-medium text-wp-primary underline hover:no-underline"
          >
            {SERVICE_EMAIL}
          </a>
          .
        </p>
      </section>
      <MarketingFooter />
    </main>
  );
}
