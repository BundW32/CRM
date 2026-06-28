import { LegalPage, LegalSection } from "@/components/legal-page";

export const dynamic = "force-static";

export default function AgbPage() {
  return (
    <LegalPage
      title="Allgemeine Geschäftsbedingungen (AGB)"
      draft
      intro={
        <p>
          Diese AGB regeln die Nutzung der Software-as-a-Service-Lösung (Kundenportal/CRM),
          die von der B&amp;W Immobilien Management UG (haftungsbeschränkt) als Anbieter
          gegenüber gewerblichen Hausverwaltungen und Vermietern (Kunde) bereitgestellt wird.
        </p>
      }
    >
      <LegalSection title="1. Vertragsgegenstand und Leistung">
        <p>
          Der Anbieter stellt dem Kunden eine internetbasierte Anwendung zur Verwaltung von
          Immobilien, Vorgängen, Dokumenten, Kommunikation und Handwerker-Beauftragung zur
          Verfügung. Die Nutzung erfolgt über einen Webbrowser; eine Installation ist nicht
          erforderlich. Der konkrete Funktionsumfang richtet sich nach dem gewählten Tarif.
        </p>
      </LegalSection>

      <LegalSection title="2. Registrierung und Vertragsschluss">
        <p>
          Der Vertrag kommt mit Abschluss der Registrierung und Bestätigung durch den
          Anbieter zustande. Der Kunde sichert zu, dass die bei der Registrierung gemachten
          Angaben zutreffend sind und er zur Vertretung des angegebenen Unternehmens
          berechtigt ist. Pro Organisation wird ein verantwortlicher Administrator
          (SuperAdmin) geführt.
        </p>
      </LegalSection>

      <LegalSection title="3. Preise und Zahlung">
        <p>
          Es gilt das zum Zeitpunkt der Buchung gültige Preismodell. Ein kostenloser
          Basis-Tarif steht bis zu einer festgelegten Anzahl verwalteter Einheiten zur
          Verfügung; darüber hinaus gelten die jeweils ausgewiesenen Tarife (Grundgebühr je
          Verwalter-Zugang zzgl. Preis je verwalteter Einheit und Monat). Die Abrechnung
          erfolgt monatlich im Voraus. Alle Preise verstehen sich zzgl. gesetzlicher
          Umsatzsteuer.
        </p>
      </LegalSection>

      <LegalSection title="4. Laufzeit und Kündigung">
        <p>
          Der Vertrag wird auf unbestimmte Zeit geschlossen und kann von beiden Seiten mit
          einer Frist zum Ende des laufenden Abrechnungsmonats gekündigt werden. Es besteht
          keine Mindestvertragslaufzeit. Das Recht zur außerordentlichen Kündigung aus
          wichtigem Grund bleibt unberührt.
        </p>
      </LegalSection>

      <LegalSection title="5. Pflichten des Kunden">
        <p>
          Der Kunde ist für die Geheimhaltung seiner Zugangsdaten verantwortlich und stellt
          sicher, dass nur berechtigte Personen Zugriff erhalten. Der Kunde darf die Software
          nicht missbräuchlich nutzen, insbesondere keine rechtswidrigen Inhalte einstellen
          und die Verfügbarkeit nicht beeinträchtigen. Der Kunde bleibt für die von ihm
          verarbeiteten personenbezogenen Daten datenschutzrechtlich verantwortlich (siehe
          Ziffer 8).
        </p>
      </LegalSection>

      <LegalSection title="6. Verfügbarkeit">
        <p>
          Der Anbieter ist um eine möglichst hohe Verfügbarkeit des Dienstes bemüht.
          Wartungsarbeiten, höhere Gewalt und Störungen außerhalb des Einflussbereichs des
          Anbieters können zu vorübergehenden Einschränkungen führen. Eine konkrete
          Verfügbarkeitszusage (SLA) gilt nur, soweit ausdrücklich vereinbart.
        </p>
      </LegalSection>

      <LegalSection title="7. Haftung">
        <p>
          Der Anbieter haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei
          Verletzung von Leben, Körper und Gesundheit. Bei einfacher Fahrlässigkeit haftet
          der Anbieter nur bei Verletzung wesentlicher Vertragspflichten (Kardinalpflichten)
          und begrenzt auf den vertragstypisch vorhersehbaren Schaden. Im Übrigen ist die
          Haftung ausgeschlossen. Der Kunde ist für die regelmäßige Sicherung seiner Daten
          mitverantwortlich.
        </p>
      </LegalSection>

      <LegalSection title="8. Datenschutz und Auftragsverarbeitung">
        <p>
          Soweit der Anbieter im Auftrag des Kunden personenbezogene Daten verarbeitet (z. B.
          Daten von Mietern und Eigentümern), geschieht dies auf Grundlage des Vertrags zur
          Auftragsverarbeitung (AVV), der Bestandteil dieses Vertrags ist. Einzelheiten
          regelt die <strong>AVV</strong> sowie die SaaS-Datenschutzerklärung.
        </p>
      </LegalSection>

      <LegalSection title="9. Änderungen der AGB">
        <p>
          Der Anbieter kann diese AGB mit Wirkung für die Zukunft ändern. Änderungen werden
          dem Kunden rechtzeitig mitgeteilt. Widerspricht der Kunde nicht innerhalb der
          mitgeteilten Frist, gelten die Änderungen als angenommen; auf diese Folge wird in
          der Mitteilung hingewiesen.
        </p>
      </LegalSection>

      <LegalSection title="10. Schlussbestimmungen">
        <p>
          Es gilt das Recht der Bundesrepublik Deutschland. Sollten einzelne Bestimmungen
          unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
