import { LegalPage, LegalSection } from "@/components/legal-page";

export const dynamic = "force-static";

export default function SaasDatenschutzPage() {
  return (
    <LegalPage
      title="Datenschutz für Verwaltungs-Kunden (SaaS)"
      draft
      intro={
        <p>
          Diese Erklärung betrifft die Nutzung der Software durch Hausverwaltungen und
          Vermieter (Kunden). Sie ergänzt die{" "}
          <a href="/datenschutz" className="text-brand-green hover:underline">
            allgemeine Datenschutzerklärung
          </a>{" "}
          (für Bewohner des Portals) und unterscheidet die beiden datenschutzrechtlichen
          Rollen des Anbieters.
        </p>
      }
    >
      <LegalSection title="1. Zwei Rollen des Anbieters">
        <p>
          <strong>Verantwortlicher:</strong> Für die Daten, die der Kunde selbst betreffen
          (Registrierung, Konto, Abrechnung, Support), ist die B&amp;W Immobilien Management
          UG (haftungsbeschränkt) Verantwortlicher im Sinne der DSGVO.
        </p>
        <p>
          <strong>Auftragsverarbeiter:</strong> Für die Daten, die der Kunde im Rahmen seiner
          Verwaltungstätigkeit verarbeitet (insbesondere Daten von Mietern und Eigentümern),
          ist der Anbieter Auftragsverarbeiter. Verantwortlicher bleibt der Kunde; Einzelheiten
          regelt die <a href="/avv" className="text-brand-green hover:underline">AVV</a>.
        </p>
      </LegalSection>

      <LegalSection title="2. Konto- und Registrierungsdaten">
        <p>
          Bei der Registrierung verarbeiten wir Firmenname, Name der verantwortlichen Person,
          E-Mail-Adresse und Passwort (verschlüsselt) zur Bereitstellung des Zugangs.
          Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung).
        </p>
      </LegalSection>

      <LegalSection title="3. Nutzungs- und Protokolldaten">
        <p>
          Zur Sicherheit und Stabilität verarbeiten wir technische Protokolldaten (z. B.
          Zeitpunkt von Anmeldungen, IP-Adresse zur Missbrauchsabwehr/Rate-Limiting) auf
          Grundlage unseres berechtigten Interesses (Art. 6 Abs. 1 lit. f DSGVO).
        </p>
      </LegalSection>

      <LegalSection title="4. Eingesetzte Dienstleister">
        <p>
          Zum Betrieb der Plattform setzen wir ein: Vercel (Hosting/Anwendungsbetrieb und
          Datei-Speicher „Blob“), Neon (Datenbank, EU-Region), Google (Gmail / Google
          Workspace) für den E-Mail-Versand sowie Stripe für die Zahlungsabwicklung
          kostenpflichtiger Tarife. Es werden jeweils nur die erforderlichen Daten
          übermittelt; mit den Dienstleistern bestehen Verträge zur Auftragsverarbeitung.
        </p>
      </LegalSection>

      <LegalSection title="5. Speicherdauer">
        <p>
          Kontodaten werden für die Dauer des Vertragsverhältnisses gespeichert und nach
          Beendigung unter Beachtung gesetzlicher Aufbewahrungsfristen gelöscht. Für die im
          Auftrag verarbeiteten Bewohnerdaten gelten die Vorgaben des Kunden gemäß AVV.
        </p>
      </LegalSection>

      <LegalSection title="6. Betroffenenrechte">
        <p>
          Kunden haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung,
          Datenübertragbarkeit und Widerspruch sowie ein Beschwerderecht bei einer
          Aufsichtsbehörde. Anfragen richten Sie bitte an die im Impressum genannten
          Kontaktdaten.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
