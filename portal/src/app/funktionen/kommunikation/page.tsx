import type { Metadata } from "next";
import Link from "next/link";
import { Wrench } from "lucide-react";
import {
  CtaBand,
  FeatureSection,
  MarketingFooter,
  MarketingHeader,
  MarketingHero,
} from "@/components/marketing/site";
import {
  OnboardingVisual,
  OrbitVisual,
  RolesVisual,
  TicketVisual,
} from "@/components/marketing/visuals";

// Statisch mit Hintergrund-Aktualisierung (ISR): Marketing-Seite ohne
// Nutzerdaten; nur der Stand der Willkommensaktion (Banner/Platzzähler) kommt
// aus der DB, und fünf Minuten Verzug sind dort verschmerzbar. Die Wächter
// (App-Modus, Mandanten-Subdomain) laufen im Proxy (src/proxy.ts) — eine
// statische Seite kann weder `headers()` noch `cookies()` lesen.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Schäden, Dokumente & Aushänge in der WEG",
  description:
    "Schäden mit Foto melden und bis zur Erledigung verfolgen, Dokumente und " +
    "Aushänge zentral teilen – eigener Zugang für Eigentümer, Beirat und Mieter.",
};

export default async function KommunikationPage() {
  return (
    <main className="mk-light flex-1">
      <MarketingHeader active="/funktionen/kommunikation" />

      <MarketingHero
        eyebrow="Alltag & Kommunikation"
        title={
          <>
            Ein Portal für{" "}
            <span className="underline decoration-wp-accent-bright decoration-4 underline-offset-8">alle im Haus.</span>
          </>
        }
        intro={
          "Selbstverwaltung heißt nicht, dass eine Person alles am Telefon " +
          "regelt. Schäden, Dokumente und Aushänge laufen im Portal " +
          "zusammen – und jeder im Haus sieht genau das, was ihn betrifft."
        }
        image={{
          src: "/images/marketing/kommunikation.jpg",
          alt: "Schaden wird mit dem Smartphone im Treppenhaus fotografiert",
        }}
        badge={{ icon: <Wrench className="h-4 w-4 text-wp-accent-ink" />, text: "Schaden gemeldet – in Sekunden" }}
      />

      <FeatureSection
        id="schaeden"
        eyebrow="Schäden & Vorgänge"
        title="Vom Wasserfleck zum erledigten Auftrag – nachvollziehbar"
        visual={<TicketVisual />}
        points={[
          "Schaden mit Fotos melden – vom Handy aus in einer Minute",
          "Status verfolgen: offen, in Bearbeitung, erledigt",
          "Kommentare mit Fotos für Rückfragen und Zwischenstände",
          "Benachrichtigungen bei jeder Statusänderung",
        ]}
      >
        <p>
          Ein Mieter entdeckt einen Wasserfleck im Treppenhaus, fotografiert ihn
          und meldet ihn im Portal – fertig. Ab da ist der Vorgang für alle
          Beteiligten sichtbar: Die Verwaltung setzt Priorität und Status, stellt
          Rückfragen im Kommentarverlauf und dokumentiert jeden Schritt.
        </p>
        <p>
          Nichts geht mehr in WhatsApp-Gruppen oder auf Zetteln im Hausflur
          verloren, und bei der nächsten Versammlung lässt sich lückenlos
          zeigen, was im Jahr passiert ist.
        </p>
      </FeatureSection>

      <FeatureSection
        id="reparaturen"
        eyebrow="Reparaturen"
        title="Reparaturen organisieren und die Ausführung dokumentieren"
        reverse
        visual={<RolesVisual />}
        points={[
          "Jede Schadensmeldung wird zum dokumentierten Vorgang mit Status",
          "Termine, Absprachen und Zwischenstände im Kommentarverlauf festhalten",
          "Fotos vor und nach der Ausführung direkt am Vorgang",
          "Die Rechnung landet als Beleg an der Buchung – alles hängt zusammen",
        ]}
      >
        <p>
          Den Handwerker beauftragt Ihre Gemeinschaft wie gewohnt – per Telefon
          oder E-Mail. Die Dokumentation übernimmt das Portal: Wer wurde wann
          beauftragt, welcher Termin ist vereinbart, was ist erledigt? All das
          steht am Vorgang statt in verstreuten Nachrichten.
        </p>
        <p>
          So hat die Gemeinschaft automatisch einen Nachweis, was wann gemacht
          wurde – hilfreich für Gewährleistung, Abrechnung und die nächste
          Versammlung.
        </p>
      </FeatureSection>

      <FeatureSection
        id="dokumente"
        eyebrow="Dokumente & Aushänge"
        title="Alle Unterlagen an einem Ort – mit klaren Sichtbarkeiten"
        visual={<TicketVisual />}
        points={[
          "Dokumente hochladen mit Zielgruppen-Sichtbarkeit (alle, nur Eigentümer, einzelne Einheiten)",
          "Digitale Aushänge ersetzen den Zettel im Hausflur",
          "Dateien werden nur nach Berechtigungsprüfung ausgeliefert",
          "E-Mail-Benachrichtigung, wenn etwas Neues ansteht",
        ]}
      >
        <p>
          Teilungserklärung, Versicherungspolicen, Protokolle, Abrechnungen:
          Im Portal liegen die Unterlagen der WEG zentral und versioniert –
          und jede Datei ist nur für die sichtbar, die sie sehen dürfen. Neue
          Eigentümer bekommen mit ihrem Zugang sofort das komplette Archiv statt
          eines Umzugskartons voller Ordner.
        </p>
      </FeatureSection>

      <FeatureSection
        id="rollen"
        eyebrow="Rollen & Zugänge"
        title="Jeder bekommt genau die Rechte, die er braucht"
        reverse
        visual={<RolesVisual />}
        points={[
          "Interner Verwalter: führt Bücher, Versammlung und Vorgänge",
          "Eigentümer: Abrechnungen, Beschlüsse, Dokumente, Statistiken der eigenen Objekte",
          "Beirat: prüft Abrechnungen und Belege",
          "Mieter: melden Schäden, lesen Aushänge und eigene Dokumente",
          "Für alle Zugänge: sicherer Login mit eigenem Passwort, auch am Handy",
        ]}
      >
        <p>
          Selbstverwaltung funktioniert, wenn Verantwortung verteilt ist. Das
          Portal kennt dafür klare Rollen: Der verwaltende Eigentümer führt die
          Bücher, der Beirat schaut drauf, Miteigentümer sehen ihre Zahlen und
          Dokumente selbst ein, statt danach fragen zu müssen. Wer vermietet,
          gibt seinen Mietern einen eigenen Zugang für Schadensmeldungen und
          Aushänge – mehr dazu auf der Seite{" "}
          <Link
            href="/funktionen/sondereigentum"
            className="font-medium text-wp-accent-ink underline underline-offset-2"
          >
            Sondereigentum &amp; Mietermanagement
          </Link>
          .
        </p>
      </FeatureSection>

      <FeatureSection
        id="verbrauch"
        eyebrow="Zähler & Verbrauch"
        title="Ablesen, verteilen, und jeder sieht den eigenen Verbrauch"
        visual={<OrbitVisual />}
        points={[
          "Zählerstände je Einheit erfassen – Wasser, Wärme, Strom",
          "Heizkosten verteilen und in der Jahresabrechnung ausweisen",
          "CO₂-Kosten zwischen Vermieter und Mieter aufteilen (CO2KostAufG)",
          "Eigentümer und Mieter sehen ihren eigenen Verbrauch im Portal",
        ]}
      >
        <p>
          Verbrauch ist der Teil der Abrechnung, über den am meisten diskutiert
          wird – meist, weil niemand die Zahlen vorher gesehen hat. Im Portal
          werden Zählerstände dort erfasst, wo sie hingehören, und stehen der
          Abrechnung wie den Bewohnern gleichermaßen zur Verfügung.
        </p>
        <p>
          Die Aufteilung der CO₂-Kosten zwischen vermietendem Eigentümer und
          Mieter nimmt Ihnen das Portal ab: Es rechnet die Stufe aus und weist
          den Anteil aus, statt Sie auf eine Tabelle im Gesetzestext zu
          verweisen.
        </p>
      </FeatureSection>

      <FeatureSection
        id="assistent"
        eyebrow="Assistent & Fachsprache"
        title="Fragen in normalem Deutsch – Antworten aus Ihren Daten"
        reverse
        visual={<OnboardingVisual />}
        points={[
          "„Wie hoch ist mein Rückstand?“ – gefragt wird im Klartext",
          "Geantwortet wird nur aus Daten, die Sie ohnehin sehen dürfen",
          "Fachbegriffe wie MEA, Abrechnungsspitze oder Umlageschlüssel erklären sich per Klick",
          "Rundgang durch die Oberfläche beim ersten Anmelden",
        ]}
      >
        <p>
          Selbstverwaltung scheitert selten am Willen, sondern an der Sprache:
          Wer zum ersten Mal eine Jahresabrechnung liest, stolpert über ein
          Dutzend Begriffe. Im Portal ist jeder davon anklickbar und erklärt sich
          an Ort und Stelle – ohne die Seite zu verlassen.
        </p>
        <p>
          Der Assistent beantwortet Fragen zur eigenen Gemeinschaft. Er greift
          dabei ausschließlich auf die Daten zu, für die Ihre Rolle freigegeben
          ist – ein Mieter erfährt über den Assistenten nichts, was er im Portal
          nicht ohnehin sehen dürfte. Was der{" "}
          <Link
            href="/funktionen/ki-berater"
            className="font-medium text-wp-accent-ink underline underline-offset-2"
          >
            KI-Berater
          </Link>{" "}
          sonst noch kann – und wo er bewusst außen vor bleibt – steht auf
          seiner eigenen Seite.
        </p>
      </FeatureSection>

      <CtaBand
        title="Bringen Sie Ihr Haus an einen Tisch"
        text="Richten Sie das Portal kostenlos ein und laden Sie Eigentümer, Beirat und Mieter in wenigen Minuten ein."
      />
      <MarketingFooter />
    </main>
  );
}
