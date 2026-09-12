import type { Metadata } from "next";
import { SERVICE_EMAIL } from "@/components/marketing/brand";
import { MarketingFooter, MarketingHeader } from "@/components/marketing/site";
import { Alert } from "@/components/ui";
import { assertMainDomain } from "@/lib/marketing";
import { KontaktFunnel } from "./kontakt-funnel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kontakt – Fragen zur WEG Selbstverwaltung",
  description:
    "Frage zur WEG Selbstverwaltung mit wegportal24 oder eine Anregung für das " +
    "Portal? In drei Schritten zur Nachricht – mit Eingangsbestätigung per E-Mail.",
};

// Was über dieses Formular sinnvoll läuft – und was nicht. Die Seite bestand
// vorher nur aus Überschrift, zwei Sätzen und dem Formular; ein SEO-Crawler
// zählte 171 Wörter in zwei Textblöcken. Die Absätze unten sagen, welche
// Fragen hier richtig sind und wohin die anderen gehören, damit niemand eine
// Ticket-Frage oder ein Auskunftsersuchen in ein allgemeines Formular tippt.
const ANLIEGEN = [
  {
    titel: "Fragen vor dem Start",
    text:
      "Passt wegportal24 zu unserer Gemeinschaft? Wie läuft der Wechsel von " +
      "der bisherigen Hausverwaltung in die WEG Selbstverwaltung? Was ist im " +
      "Basic-Tarif enthalten, was bringt Verwalter-Plus? Solche Fragen sind " +
      "hier richtig – auch dann, wenn Sie das Portal noch gar nicht " +
      "eingerichtet haben. Vieles beantworten außerdem die Preisseite und die " +
      "Seite „So funktioniert's“.",
  },
  {
    titel: "Anregungen aus dem Alltag Ihrer WEG",
    text:
      "wegportal24 ist aus der täglichen Arbeit einer Hausverwaltung " +
      "entstanden und wird laufend weiterentwickelt. Fehlt Ihnen eine " +
      "Funktion, stolpern Sie über einen Begriff oder ist ein Ablauf " +
      "umständlicher als nötig? Schreiben Sie es uns – jede Anregung wird " +
      "gelesen, und der Einstieg in die Selbstverwaltung soll mit jeder " +
      "Rückmeldung einfacher werden.",
  },
  {
    titel: "Was nicht über dieses Formular läuft",
    text:
      "Fachfragen zu einer konkreten Abrechnung oder einem Beschluss stellt " +
      "Ihre Gemeinschaft im Verwalter-Plus-Tarif als Ticket direkt im Portal – " +
      "dort bleibt die Antwort für alle Eigentümer dokumentiert. Auskunfts- " +
      "und Löschersuchen nach der DSGVO richten Sie an die in der " +
      "Datenschutzerklärung genannte verantwortliche Stelle.",
  },
];

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
  await assertMainDomain();
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

        <div className="mt-12 border-t border-wp-ink/10 pt-10">
          <h2 className="text-balance text-xl font-bold text-wp-ink sm:text-2xl">
            Womit Sie sich an uns wenden können
          </h2>
          <div className="mt-4 space-y-6">
            {ANLIEGEN.map(({ titel, text }) => (
              <div key={titel}>
                <p className="font-semibold text-wp-ink">{titel}</p>
                <p className="mt-1.5 max-w-xl leading-relaxed text-gray-600">{text}</p>
              </div>
            ))}
          </div>
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
