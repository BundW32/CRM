import type { Metadata } from "next";
import {
  CtaBand,
  FeatureSection,
  MarketingFooter,
  MarketingHeader,
  MarketingHero,
} from "@/components/marketing/site";
import { RolesVisual, TicketVisual } from "@/components/marketing/visuals";
import { assertMainDomain } from "@/lib/marketing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Schäden, Dokumente & Kommunikation in der WEG | wegportal24",
  description:
    "Schäden mit Fotos melden, Handwerker beauftragen, Dokumente und Aushänge " +
    "zentral teilen: So bleibt in der selbstverwalteten WEG jeder informiert – " +
    "mit eigenem Zugang für Eigentümer, Beirat, Mieter und Handwerker.",
};

export default async function KommunikationPage() {
  await assertMainDomain();

  return (
    <main className="mk-light flex-1">
      <MarketingHeader active="/funktionen/kommunikation" />

      <MarketingHero
        eyebrow="Alltag & Kommunikation"
        title={
          <>
            Ein Portal für{" "}
            <span className="underline decoration-brand-orange decoration-4 underline-offset-8">alle im Haus.</span>
          </>
        }
        intro={
          "Selbstverwaltung heißt nicht, dass eine Person alles am Telefon " +
          "regelt. Schäden, Aufträge, Dokumente und Aushänge laufen im Portal " +
          "zusammen – und jeder im Haus sieht genau das, was ihn betrifft."
        }
        image={{
          src: "/images/marketing/kommunikation.jpg",
          alt: "Schaden wird mit dem Smartphone im Treppenhaus fotografiert",
        }}
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
        id="handwerker"
        eyebrow="Handwerker"
        title="Aufträge vergeben und die Ausführung dokumentieren"
        reverse
        visual={<RolesVisual />}
        points={[
          "Vorgänge direkt einem Handwerker zuweisen – per E-Mail benachrichtigt",
          "Handwerker sehen ausschließlich ihre eigenen Aufträge",
          "„Arbeit begonnen“ / „Auftrag erledigt“ mit Foto-Dokumentation",
        ]}
      >
        <p>
          Statt Telefonketten bekommt der Handwerker einen eigenen, streng
          begrenzten Zugang: Er sieht nur die ihm zugewiesenen Aufträge, meldet
          den Beginn der Arbeiten und dokumentiert die Ausführung mit Fotos.
          Die Gemeinschaft hat damit automatisch einen Nachweis, was wann
          gemacht wurde – hilfreich für Gewährleistung und Abrechnung.
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
          "Eigentümer: Abrechnungen, Beschlüsse, Dokumente, Statistiken der eigenen Objekte",
          "Beirat: prüft Abrechnungen und Belege",
          "Mieter: melden Schäden, lesen Aushänge und eigene Dokumente",
          "Handwerker: sehen nur zugewiesene Aufträge",
          "Sicherer Login mit eigenem Passwort, auch als App am Handy nutzbar",
        ]}
      >
        <p>
          Selbstverwaltung funktioniert, wenn Verantwortung verteilt ist. Das
          Portal kennt dafür klare Rollen: Der verwaltende Eigentümer führt die
          Bücher, der Beirat schaut drauf, Miteigentümer sehen ihre Zahlen und
          Dokumente selbst ein, statt danach fragen zu müssen. Wer vermietet,
          gibt seinen Mietern einen eigenen Zugang für Schadensmeldungen und
          Aushänge.
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
