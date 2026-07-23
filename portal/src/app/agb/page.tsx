import { LegalPage, LegalSection } from "@/components/legal-page";

export const dynamic = "force-static";

export default function AgbPage() {
  return (
    <LegalPage
      title="Allgemeine Geschäftsbedingungen (AGB)"
      draft
      intro={
        <>
          <p>
            Diese AGB regeln die Nutzung der Software-as-a-Service-Lösung (Kundenportal/CRM),
            die von der B&amp;W Immobilien Management UG (haftungsbeschränkt) als Anbieter
            gegenüber gewerblichen Hausverwaltungen, Vermietern und selbstverwaltenden
            Eigentümergemeinschaften (Kunde) bereitgestellt wird.
          </p>
          <p className="mt-2 text-gray-500">Stand: Juli 2026</p>
        </>
      }
    >
      <LegalSection title="1. Geltungsbereich und Begriffsbestimmungen">
        <p>
          Diese AGB gelten für alle Verträge über die Nutzung der vom Anbieter
          bereitgestellten Anwendung. „Anbieter" ist die B&amp;W Immobilien Management UG
          (haftungsbeschränkt). „Kunde" ist das Unternehmen bzw. die Eigentümergemeinschaft,
          die die Anwendung nutzt. „Nutzer" sind die vom Kunden angelegten Personen (z. B.
          Verwalter, Eigentümer, Mieter, Handwerker). Die Anwendung richtet sich
          ausschließlich an Unternehmer im Sinne des § 14 BGB sowie an
          Wohnungseigentümergemeinschaften; sie ist nicht für Verbraucher bestimmt.
          Abweichende Bedingungen des Kunden gelten nur, soweit der Anbieter ihnen
          ausdrücklich schriftlich zustimmt.
        </p>
      </LegalSection>

      <LegalSection title="2. Vertragsgegenstand und Leistung">
        <p>
          Der Anbieter stellt dem Kunden eine internetbasierte Anwendung zur Verwaltung von
          Immobilien, Einheiten, Vorgängen, Dokumenten, Kommunikation, WEG-Finanzen,
          Versammlungen und Handwerker-Beauftragung zur Verfügung. Die Nutzung erfolgt über
          einen Webbrowser; eine Installation ist nicht erforderlich. Der konkrete
          Funktionsumfang richtet sich nach dem gewählten Tarif und kann fortlaufend
          weiterentwickelt werden. Die Anwendung ersetzt keine Rechts-, Steuer- oder
          Buchhaltungsberatung; für die inhaltliche Richtigkeit der von ihm erfassten Daten
          und erzeugten Dokumente bleibt der Kunde verantwortlich.
        </p>
      </LegalSection>

      <LegalSection title="3. Registrierung und Vertragsschluss">
        <p>
          Der Vertrag kommt mit Abschluss der Registrierung und Bestätigung durch den
          Anbieter zustande. Der Kunde sichert zu, dass die bei der Registrierung gemachten
          Angaben zutreffend sind und die handelnde Person zur Vertretung des angegebenen
          Unternehmens bzw. der Gemeinschaft berechtigt ist. Pro Organisation wird ein
          verantwortlicher Administrator (SuperAdmin) geführt.
        </p>
      </LegalSection>

      <LegalSection title="4. Kostenlose Testphase">
        <p>
          Soweit angeboten, kann der Kunde die Anwendung für einen begrenzten Zeitraum
          kostenlos testen. Die Dauer der Testphase wird bei der Registrierung ausgewiesen.
          Nach Ablauf der Testphase ist für die weitere Nutzung ein kostenpflichtiger Tarif
          erforderlich; ohne Buchung eines solchen Tarifs kann der Zugang eingeschränkt oder
          deaktiviert werden. Während der Testphase besteht kein Anspruch auf einen bestimmten
          Funktionsumfang oder eine bestimmte Verfügbarkeit.
        </p>
      </LegalSection>

      <LegalSection title="5. Preise und Zahlung">
        <p>
          Es gilt das zum Zeitpunkt der Buchung gültige Preismodell. Ein kostenloser
          Basis-Tarif kann bis zu einer festgelegten Anzahl verwalteter Einheiten zur
          Verfügung stehen; darüber hinaus gelten die jeweils ausgewiesenen Tarife (z. B.
          Grundgebühr je Verwalter-Zugang zzgl. Preis je verwalteter Einheit und Monat). Die
          Abrechnung erfolgt monatlich im Voraus. Alle Preise verstehen sich zzgl.
          gesetzlicher Umsatzsteuer. Gerät der Kunde mit der Zahlung in Verzug, kann der
          Anbieter den Zugang nach vorheriger Ankündigung vorübergehend sperren.
        </p>
      </LegalSection>

      <LegalSection title="6. Nutzungsrechte">
        <p>
          Der Anbieter räumt dem Kunden für die Dauer des Vertrags ein einfaches, nicht
          übertragbares und nicht unterlizenzierbares Recht ein, die Anwendung im vertraglich
          vereinbarten Umfang für eigene Zwecke zu nutzen. Eine Weitergabe der Zugänge an
          Dritte außerhalb der eigenen Organisation, eine Vervielfältigung der Software oder
          eine Nutzung über den vereinbarten Umfang hinaus ist nicht gestattet. Alle Rechte
          an der Software und ihren Weiterentwicklungen verbleiben beim Anbieter.
        </p>
      </LegalSection>

      <LegalSection title="7. Laufzeit und Kündigung">
        <p>
          Der Vertrag wird auf unbestimmte Zeit geschlossen und kann von beiden Seiten mit
          einer Frist zum Ende des laufenden Abrechnungsmonats gekündigt werden. Es besteht
          keine Mindestvertragslaufzeit. Das Recht zur außerordentlichen Kündigung aus
          wichtigem Grund bleibt unberührt. Kündigungen bedürfen der Textform (z. B. E-Mail).
        </p>
      </LegalSection>

      <LegalSection title="8. Pflichten des Kunden">
        <p>
          Der Kunde ist für die Geheimhaltung seiner Zugangsdaten verantwortlich und stellt
          sicher, dass nur berechtigte Personen Zugriff erhalten. Der Kunde darf die Software
          nicht missbräuchlich nutzen, insbesondere keine rechtswidrigen Inhalte einstellen
          und die Verfügbarkeit nicht beeinträchtigen. Der Kunde stellt sicher, dass er zur
          Verarbeitung der von ihm eingestellten personenbezogenen Daten berechtigt ist und
          die betroffenen Personen (Mieter, Eigentümer, Handwerker) entsprechend informiert.
          Der Kunde bleibt für die von ihm verarbeiteten personenbezogenen Daten
          datenschutzrechtlich verantwortlich (siehe Ziffer 10).
        </p>
      </LegalSection>

      <LegalSection title="9. Verfügbarkeit und Support">
        <p>
          Der Anbieter ist um eine möglichst hohe Verfügbarkeit des Dienstes bemüht.
          Wartungsarbeiten werden nach Möglichkeit in nutzungsarme Zeiten gelegt. Höhere
          Gewalt und Störungen außerhalb des Einflussbereichs des Anbieters (z. B. bei
          eingesetzten Hosting- oder Infrastrukturdienstleistern) können zu vorübergehenden
          Einschränkungen führen. Eine konkrete Verfügbarkeitszusage (SLA) sowie
          Reaktionszeiten im Support gelten nur, soweit ausdrücklich vereinbart.
        </p>
      </LegalSection>

      <LegalSection title="10. Datenschutz und Auftragsverarbeitung">
        <p>
          Soweit der Anbieter im Auftrag des Kunden personenbezogene Daten verarbeitet (z. B.
          Daten von Mietern und Eigentümern), geschieht dies auf Grundlage des Vertrags zur
          Auftragsverarbeitung (AVV), der Bestandteil dieses Vertrags ist. Einzelheiten
          regelt die <strong>AVV</strong> sowie die SaaS-Datenschutzerklärung.
        </p>
      </LegalSection>

      <LegalSection title="11. Unterauftragnehmer und Hosting">
        <p>
          Der Anbieter setzt zur Erbringung der Leistung technische Dienstleister
          (insbesondere für Hosting und Datei-Speicherung) ein. Die Verarbeitung erfolgt nach
          Maßgabe der AVV; die eingesetzten Unterauftragnehmer werden dort benannt. Der
          Anbieter ist bestrebt, die Datenverarbeitung innerhalb der Europäischen Union
          durchzuführen. Der Einsatz weiterer Unterauftragnehmer richtet sich nach den
          Regelungen der AVV.
        </p>
      </LegalSection>

      <LegalSection title="12. Datenexport und Löschung bei Vertragsende">
        <p>
          Die vom Kunden eingestellten Daten bleiben dessen Eigentum. Während der Vertragslaufzeit
          kann der Kunde seine Daten über die dafür vorgesehenen Export-Funktionen abrufen. Nach
          Beendigung des Vertrags stellt der Anbieter dem Kunden für einen angemessenen Zeitraum
          die Möglichkeit zum Export zur Verfügung und löscht anschließend die Kundendaten,
          soweit keine gesetzlichen Aufbewahrungspflichten entgegenstehen. Einzelheiten zu
          Löschfristen regelt die AVV.
        </p>
      </LegalSection>

      <LegalSection title="13. Haftung">
        <p>
          Der Anbieter haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei
          Verletzung von Leben, Körper und Gesundheit. Bei einfacher Fahrlässigkeit haftet
          der Anbieter nur bei Verletzung wesentlicher Vertragspflichten (Kardinalpflichten)
          und begrenzt auf den vertragstypisch vorhersehbaren Schaden. Im Übrigen ist die
          Haftung ausgeschlossen. Der Kunde ist für die regelmäßige Sicherung seiner Daten
          mitverantwortlich; die Haftung für Datenverlust ist auf den Aufwand begrenzt, der
          bei ordnungsgemäßer und regelmäßiger Datensicherung durch den Kunden zur
          Wiederherstellung angefallen wäre.
        </p>
      </LegalSection>

      <LegalSection title="14. Freistellung">
        <p>
          Der Kunde stellt den Anbieter von allen Ansprüchen Dritter frei, die auf einer
          rechtswidrigen Nutzung der Anwendung durch den Kunden oder seine Nutzer oder auf
          einer Verletzung datenschutzrechtlicher Pflichten des Kunden beruhen. Dies umfasst
          auch angemessene Kosten der Rechtsverteidigung.
        </p>
      </LegalSection>

      <LegalSection title="15. Änderungen der AGB">
        <p>
          Der Anbieter kann diese AGB mit Wirkung für die Zukunft ändern. Änderungen werden
          dem Kunden rechtzeitig in Textform mitgeteilt. Widerspricht der Kunde nicht
          innerhalb der mitgeteilten Frist, gelten die Änderungen als angenommen; auf diese
          Folge wird in der Mitteilung hingewiesen.
        </p>
      </LegalSection>

      <LegalSection title="16. Schlussbestimmungen">
        <p>
          Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des
          UN-Kaufrechts. Ausschließlicher Gerichtsstand für alle Streitigkeiten aus diesem
          Vertrag ist – soweit gesetzlich zulässig – der Sitz des Anbieters. Änderungen und
          Ergänzungen bedürfen der Textform. Sollten einzelne Bestimmungen unwirksam sein,
          bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
