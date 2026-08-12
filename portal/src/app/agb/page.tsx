import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal-page";
import { isWegSaas, productName } from "@/lib/app-mode";

export const dynamic = "force-dynamic";

// Zwei Fassungen, zwei Kundenkreise (siehe Kommentar unten) — dann auch zwei
// Beschreibungen. Eine gemeinsame hätte auf der B&W-Tür von
// „selbstverwalteten Gemeinschaften" gesprochen, die es dort nicht gibt.
export function generateMetadata(): Metadata {
  return isWegSaas()
    ? {
        title: "AGB für die WEG-Selbstverwaltung",
        description:
          "Allgemeine Geschäftsbedingungen von wegportal24: Leistungen, Tarife, " +
          "Bruttopreise, Laufzeit und Kündigung – für selbstverwaltete Gemeinschaften.",
      }
    : {
        title: "Allgemeine Geschäftsbedingungen",
        description:
          `Allgemeine Geschäftsbedingungen für die Nutzung des ${productName()}s ` +
          `durch gewerbliche Kunden: Leistungen, Laufzeit, Vergütung und Kündigung.`,
      };
}

/**
 * Zwei Türen, zwei Kundenkreise — und deshalb zwei Fassungen.
 *
 * Auf der B&W-Tür ist der Kunde eine gewerbliche Hausverwaltung: Unternehmer
 * nach § 14 BGB, kein Fernabsatzrecht, Gerichtsstandsvereinbarung zulässig.
 *
 * Auf wegportal24 ist der Kunde eine SELBSTVERWALTENDE Wohnungseigentümer-
 * gemeinschaft. Die ist nach ständiger Rechtsprechung des BGH als
 * **Verbraucherin** zu behandeln, sobald ihr mindestens eine natürliche Person
 * angehört und das Geschäft weder gewerblichen noch selbständig beruflichen
 * Zwecken dient (BGH, Urteil vom 25.03.2015 – VIII ZR 243/13). Genau diese
 * Gemeinschaften bewirbt die Startseite.
 *
 * Bis zum 05.08.2026 stand hier ein einziger Text, der Verbraucher
 * ausdrücklich ausschloss („richtet sich ausschließlich an Unternehmer … nicht
 * für Verbraucher bestimmt"). Für die beworbene Zielgruppe war das nicht nur
 * unwirksam, sondern kehrte die Rechtslage um: Ein ausgeschlossenes
 * Widerrufsrecht bleibt bestehen, und die Widerrufsfrist läuft ohne
 * ordnungsgemäße Belehrung erst nach zwölf Monaten und 14 Tagen ab
 * (§ 356 Abs. 3 Satz 2 BGB). Der Ausschluss war also teurer als die Belehrung.
 */
export default function AgbPage() {
  const weg = isWegSaas();
  return weg ? <AgbWegPortal /> : <AgbVerwaltung />;
}

// ── wegportal24: Kunde ist die selbstverwaltende WEG (Verbraucherin) ─────────

function AgbWegPortal() {
  return (
    <LegalPage
      title="Allgemeine Geschäftsbedingungen (AGB)"
      intro={
        <>
          <p>
            Diese Allgemeinen Geschäftsbedingungen regeln die Nutzung von{" "}
            <strong>{productName()}</strong>, einer internetbasierten Anwendung für die
            Verwaltung von Wohnungseigentümergemeinschaften. Anbieterin ist die B&amp;W
            Immobilien Management UG (haftungsbeschränkt), Goethestraße 42, 45964 Gladbeck
            (nachfolgend „Anbieterin“). Kundin ist die Wohnungseigentümergemeinschaft, die
            sich registriert.
          </p>
          <p className="mt-2 text-gray-500">Stand: 5. August 2026</p>
        </>
      }
    >
      <LegalSection title="1. Geltungsbereich, Vertragspartner, Verbrauchereigenschaft">
        <p>
          Diese AGB gelten für alle Verträge über die Nutzung der Anwendung. „Kundin“ ist
          die Gemeinschaft der Wohnungseigentümer (GdWE, § 9a WEG), für die der Zugang
          eingerichtet wird. „Nutzer“ sind die von der Kundin angelegten Personen (z. B.
          Verwaltungsbeirat, Eigentümer, Mieter, Handwerker).
        </p>
        <p>
          Eine Wohnungseigentümergemeinschaft ist als <strong>Verbraucherin</strong> im
          Sinne des § 13 BGB anzusehen, wenn ihr mindestens eine natürliche Person angehört
          und das Rechtsgeschäft weder einer gewerblichen noch einer selbständigen
          beruflichen Tätigkeit dient (BGH, Urteil vom 25. März 2015 – VIII ZR 243/13).
          Die Anwendung richtet sich ausdrücklich an solche selbstverwalteten
          Gemeinschaften. Die gesetzlichen Verbraucherrechte — insbesondere das
          Widerrufsrecht nach Ziffer 5 — gelten uneingeschränkt.
        </p>
        <p>
          Nutzt die Kundin die Anwendung ausnahmsweise zu gewerblichen Zwecken (etwa als
          bestellte gewerbliche Verwaltung), gelten die Bestimmungen für Verbraucher
          insoweit nicht.
        </p>
      </LegalSection>

      <LegalSection title="2. Vertragsgegenstand">
        <p>
          Die Anbieterin stellt der Kundin eine internetbasierte Anwendung zur Verwaltung
          von Objekten, Einheiten, Eigentümern, Vorgängen, Dokumenten, Beschlüssen,
          Versammlungen und WEG-Finanzen zur Verfügung. Die Nutzung erfolgt über einen
          Webbrowser; eine Installation ist nicht erforderlich. Der Funktionsumfang richtet
          sich nach dem gewählten Tarif und wird fortlaufend weiterentwickelt.
        </p>
        <p>
          Die Anwendung ist ein Werkzeug und{" "}
          <strong>ersetzt keine Rechts-, Steuer- oder Buchhaltungsberatung</strong>. Für die
          Richtigkeit der erfassten Daten und der daraus erzeugten Dokumente — insbesondere
          Wirtschaftsplan, Jahresabrechnung und Beschlüsse — bleibt die Kundin
          verantwortlich.
        </p>
      </LegalSection>

      <LegalSection title="3. Vertragsschluss">
        <p>
          Der Vertrag kommt mit dem Abschluss der Registrierung zustande. Die handelnde
          Person sichert zu, zur Vertretung der Gemeinschaft berechtigt zu sein. Je
          Gemeinschaft wird ein verantwortlicher Administrator geführt.
        </p>
        <p>
          Ein kostenpflichtiger Tarif kommt erst zustande, wenn die Kundin ihn
          ausdrücklich bucht und dabei über die Zahlungspflicht informiert wird
          (§ 312j Abs. 3 BGB). Aus der Registrierung allein entsteht keine Zahlungspflicht.
        </p>
      </LegalSection>

      <LegalSection title="4. Kostenlose Testphase">
        <p>
          Die Anwendung kann für den bei der Registrierung ausgewiesenen Zeitraum kostenlos
          getestet werden. Die Testphase endet automatisch; sie geht{" "}
          <strong>nicht selbsttätig in einen kostenpflichtigen Tarif über</strong>. Nach
          Ablauf ist für die weitere Nutzung eine ausdrückliche Buchung erforderlich; ohne
          sie kann der Zugang eingeschränkt oder deaktiviert werden. Der Datenexport nach
          Ziffer 11 bleibt davon unberührt.
        </p>
      </LegalSection>

      <LegalSection title="5. Widerrufsrecht">
        <p>
          Der Kundin steht als Verbraucherin ein <strong>Widerrufsrecht</strong> zu. Sie
          kann den Vertrag binnen <strong>14 Tagen</strong> ohne Angabe von Gründen
          widerrufen. Einzelheiten, die Frist, die Folgen des Widerrufs und das
          Muster-Widerrufsformular enthält die{" "}
          <Link href="/widerruf" className="font-medium text-brand-green hover:underline">
            Widerrufsbelehrung
          </Link>
          , die Bestandteil dieses Vertrags ist.
        </p>
      </LegalSection>

      <LegalSection title="6. Preise und Zahlung">
        <p>
          Es gilt das zum Zeitpunkt der Buchung ausgewiesene Preismodell. Alle Preise für
          Verbraucher verstehen sich als <strong>Gesamtpreise einschließlich</strong> der
          gesetzlichen Umsatzsteuer. Die Abrechnung erfolgt monatlich im Voraus. Gerät die
          Kundin mit der Zahlung in Verzug, kann die Anbieterin den Zugang nach vorheriger
          Ankündigung und angemessener Nachfrist vorübergehend sperren; der Datenexport
          nach Ziffer 11 bleibt möglich.
        </p>
      </LegalSection>

      <LegalSection title="7. Nutzungsrechte">
        <p>
          Die Anbieterin räumt der Kundin für die Vertragsdauer ein einfaches, nicht
          übertragbares Recht ein, die Anwendung für eigene Zwecke zu nutzen. Eine
          Weitergabe der Zugänge außerhalb der Gemeinschaft, eine Vervielfältigung der
          Software oder eine Nutzung über den vereinbarten Umfang hinaus ist nicht
          gestattet. Die Rechte an der Software verbleiben bei der Anbieterin.
        </p>
      </LegalSection>

      <LegalSection title="8. Laufzeit und Kündigung">
        <p>
          Der Vertrag läuft auf unbestimmte Zeit. Es besteht{" "}
          <strong>keine Mindestvertragslaufzeit</strong>. Beide Seiten können jederzeit zum
          Ende des laufenden Abrechnungsmonats kündigen. Das Recht zur außerordentlichen
          Kündigung aus wichtigem Grund bleibt unberührt.
        </p>
        <p>
          Die Kündigung ist formlos möglich. Am einfachsten über die Schaltfläche{" "}
          <Link href="/kuendigen" className="font-medium text-brand-green hover:underline">
            „Verträge hier kündigen“
          </Link>{" "}
          — sie steht in der Fußzeile jeder Seite und ist ohne Anmeldung erreichbar
          (§ 312k BGB). Ebenso genügt eine E-Mail an{" "}
          <a href="mailto:info@wegportal24.de" className="text-brand-green hover:underline">
            info@wegportal24.de
          </a>
          . Die Anbieterin bestätigt den Zugang und den Zeitpunkt der Beendigung in
          Textform.
        </p>
      </LegalSection>

      <LegalSection title="9. Pflichten der Kundin">
        <p>
          Die Kundin ist für die Geheimhaltung der Zugangsdaten verantwortlich und stellt
          sicher, dass nur berechtigte Personen Zugriff erhalten. Sie darf die Anwendung
          nicht missbräuchlich nutzen, insbesondere keine rechtswidrigen Inhalte
          einstellen. Die Kundin stellt sicher, dass sie zur Verarbeitung der von ihr
          eingestellten personenbezogenen Daten Dritter (Eigentümer, Mieter, Handwerker)
          berechtigt ist und die betroffenen Personen informiert. Datenschutzrechtlich
          Verantwortliche für diese Daten bleibt die Kundin (siehe Ziffer 12).
        </p>
      </LegalSection>

      <LegalSection title="10. Verfügbarkeit und Support">
        <p>
          Die Anbieterin ist um eine möglichst hohe Verfügbarkeit bemüht. Wartungsarbeiten
          werden nach Möglichkeit in nutzungsarme Zeiten gelegt. Höhere Gewalt und
          Störungen außerhalb des Einflussbereichs der Anbieterin — etwa bei eingesetzten
          Hosting-Dienstleistern — können zu vorübergehenden Einschränkungen führen. Die
          gesetzlichen Rechte der Kundin bei Mängeln der Leistung bleiben unberührt; eine
          darüber hinausgehende Verfügbarkeitszusage (SLA) gilt nur, soweit ausdrücklich
          vereinbart.
        </p>
      </LegalSection>

      <LegalSection title="11. Datenexport und Löschung bei Vertragsende">
        <p>
          Die eingestellten Daten bleiben der Kundin zugeordnet. Während der Laufzeit kann
          die Kundin ihre Daten jederzeit über die vorgesehenen Export-Funktionen abrufen.
          Nach Vertragsende stellt die Anbieterin den Export für{" "}
          <strong>mindestens 30 Tage</strong> weiter zur Verfügung und löscht anschließend
          die Daten, soweit keine gesetzlichen Aufbewahrungspflichten entgegenstehen.
        </p>
      </LegalSection>

      <LegalSection title="12. Datenschutz und Auftragsverarbeitung">
        <p>
          Soweit die Anbieterin im Auftrag der Kundin personenbezogene Daten verarbeitet
          (Daten der Eigentümer, Mieter und Handwerker), geschieht dies auf Grundlage des{" "}
          <Link href="/avv" className="text-brand-green hover:underline">
            Vertrags zur Auftragsverarbeitung
          </Link>{" "}
          nach Art. 28 DSGVO, der Bestandteil dieses Vertrags ist. Für die Daten des
          Vertragsverhältnisses selbst ist die Anbieterin eigene Verantwortliche; Näheres
          in der{" "}
          <Link href="/datenschutz" className="text-brand-green hover:underline">
            Datenschutzerklärung
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="13. Haftung">
        <p>
          Die Anbieterin haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie
          bei der Verletzung von Leben, Körper und Gesundheit. Bei einfacher Fahrlässigkeit
          haftet sie nur bei der Verletzung wesentlicher Vertragspflichten
          (Kardinalpflichten) und begrenzt auf den vertragstypisch vorhersehbaren Schaden.
          Im Übrigen ist die Haftung ausgeschlossen. Die Haftung nach dem
          Produkthaftungsgesetz bleibt unberührt.
        </p>
      </LegalSection>

      <LegalSection title="14. Änderungen dieser AGB">
        <p>
          Die Anbieterin kann diese AGB ändern, soweit dies zur Anpassung an geänderte
          Rechtslage, Rechtsprechung oder einen veränderten Funktionsumfang erforderlich
          ist und die Änderung die Kundin nicht unangemessen benachteiligt. Änderungen
          werden der Kundin mindestens <strong>sechs Wochen</strong> vor ihrem Wirksamwerden
          in Textform mitgeteilt.
        </p>
        <p>
          Widerspricht die Kundin nicht bis zum Wirksamwerden, gelten die Änderungen als
          angenommen; auf diese Folge, auf das Widerspruchsrecht und auf die Frist wird in
          der Mitteilung gesondert hingewiesen. Im Fall des Widerspruchs kann jede Seite
          den Vertrag zum Zeitpunkt des Wirksamwerdens kündigen; bis dahin gelten die
          bisherigen Bedingungen weiter.
        </p>
      </LegalSection>

      <LegalSection title="15. Streitbeilegung">
        <p>
          Die Anbieterin ist <strong>nicht bereit und nicht verpflichtet</strong>, an
          Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen
          (§ 36 Abs. 1 Nr. 1 VSBG).
        </p>
        <p className="text-gray-500">
          Ein Hinweis auf die EU-Plattform zur Online-Streitbeilegung entfällt: Sie wurde
          zum 20. Juli 2025 eingestellt.
        </p>
      </LegalSection>

      <LegalSection title="16. Schlussbestimmungen">
        <p>
          Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des
          UN-Kaufrechts. Zwingende Verbraucherschutzvorschriften des Staates, in dem die
          Kundin ihren gewöhnlichen Aufenthalt hat, bleiben unberührt.
        </p>
        <p>
          Eine Gerichtsstandsvereinbarung wird nicht getroffen; es gelten die gesetzlichen
          Gerichtsstände. Sollten einzelne Bestimmungen unwirksam sein, bleibt die
          Wirksamkeit der übrigen unberührt.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

// ── B&W-Tür: Kunde ist eine gewerbliche Hausverwaltung (Unternehmer) ─────────

function AgbVerwaltung() {
  return (
    <LegalPage
      title="Allgemeine Geschäftsbedingungen (AGB)"
      intro={
        <>
          <p>
            Diese AGB regeln die Nutzung der Software-as-a-Service-Lösung
            (Kundenportal/CRM), die von der B&amp;W Immobilien Management UG
            (haftungsbeschränkt) als Anbieter gegenüber gewerblichen Hausverwaltungen und
            Vermietern (Kunde) bereitgestellt wird.
          </p>
          <p className="mt-2 text-gray-500">Stand: 5. August 2026</p>
        </>
      }
    >
      <LegalSection title="1. Geltungsbereich und Begriffsbestimmungen">
        <p>
          Diese AGB gelten für alle Verträge über die Nutzung der vom Anbieter
          bereitgestellten Anwendung. „Anbieter“ ist die B&amp;W Immobilien Management UG
          (haftungsbeschränkt). „Kunde“ ist das Unternehmen, das die Anwendung nutzt.
          „Nutzer“ sind die vom Kunden angelegten Personen (z. B. Verwalter, Eigentümer,
          Mieter, Handwerker). Diese Fassung gilt gegenüber{" "}
          <strong>Unternehmern im Sinne des § 14 BGB</strong>. Für selbstverwaltende
          Wohnungseigentümergemeinschaften gilt die Verbraucherfassung unter wegportal24.
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
          Unternehmens berechtigt ist. Pro Organisation wird ein verantwortlicher
          Administrator (SuperAdmin) geführt.
        </p>
      </LegalSection>

      <LegalSection title="4. Kostenlose Testphase">
        <p>
          Soweit angeboten, kann der Kunde die Anwendung für einen begrenzten Zeitraum
          kostenlos testen. Die Dauer der Testphase wird bei der Registrierung ausgewiesen.
          Nach Ablauf der Testphase ist für die weitere Nutzung ein kostenpflichtiger Tarif
          erforderlich; ohne Buchung eines solchen Tarifs kann der Zugang eingeschränkt oder
          deaktiviert werden. Während der Testphase besteht kein Anspruch auf einen
          bestimmten Funktionsumfang oder eine bestimmte Verfügbarkeit.
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
          übertragbares und nicht unterlizenzierbares Recht ein, die Anwendung im
          vertraglich vereinbarten Umfang für eigene Zwecke zu nutzen. Eine Weitergabe der
          Zugänge an Dritte außerhalb der eigenen Organisation, eine Vervielfältigung der
          Software oder eine Nutzung über den vereinbarten Umfang hinaus ist nicht
          gestattet. Alle Rechte an der Software und ihren Weiterentwicklungen verbleiben
          beim Anbieter.
        </p>
      </LegalSection>

      <LegalSection title="7. Laufzeit und Kündigung">
        <p>
          Der Vertrag wird auf unbestimmte Zeit geschlossen und kann von beiden Seiten mit
          einer Frist zum Ende des laufenden Abrechnungsmonats gekündigt werden. Es besteht
          keine Mindestvertragslaufzeit. Das Recht zur außerordentlichen Kündigung aus
          wichtigem Grund bleibt unberührt. Kündigungen bedürfen der Textform (z. B.
          E-Mail).
        </p>
      </LegalSection>

      <LegalSection title="8. Pflichten des Kunden">
        <p>
          Der Kunde ist für die Geheimhaltung seiner Zugangsdaten verantwortlich und stellt
          sicher, dass nur berechtigte Personen Zugriff erhalten. Der Kunde darf die
          Software nicht missbräuchlich nutzen, insbesondere keine rechtswidrigen Inhalte
          einstellen und die Verfügbarkeit nicht beeinträchtigen. Der Kunde stellt sicher,
          dass er zur Verarbeitung der von ihm eingestellten personenbezogenen Daten
          berechtigt ist und die betroffenen Personen (Mieter, Eigentümer, Handwerker)
          entsprechend informiert. Der Kunde bleibt für die von ihm verarbeiteten
          personenbezogenen Daten datenschutzrechtlich verantwortlich (siehe Ziffer 10).
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
          Soweit der Anbieter im Auftrag des Kunden personenbezogene Daten verarbeitet
          (z. B. Daten von Mietern und Eigentümern), geschieht dies auf Grundlage des
          Vertrags zur Auftragsverarbeitung (AVV), der Bestandteil dieses Vertrags ist.
          Einzelheiten regelt die <strong>AVV</strong> sowie die
          SaaS-Datenschutzerklärung.
        </p>
      </LegalSection>

      <LegalSection title="11. Unterauftragnehmer und Hosting">
        <p>
          Der Anbieter setzt zur Erbringung der Leistung technische Dienstleister
          (insbesondere für Hosting und Datei-Speicherung) ein. Die Verarbeitung erfolgt
          nach Maßgabe der AVV; die eingesetzten Unterauftragnehmer werden dort benannt.
          Der Anbieter ist bestrebt, die Datenverarbeitung innerhalb der Europäischen Union
          durchzuführen. Der Einsatz weiterer Unterauftragnehmer richtet sich nach den
          Regelungen der AVV.
        </p>
      </LegalSection>

      <LegalSection title="12. Datenexport und Löschung bei Vertragsende">
        <p>
          Die vom Kunden eingestellten Daten bleiben dessen Eigentum. Während der
          Vertragslaufzeit kann der Kunde seine Daten über die dafür vorgesehenen
          Export-Funktionen abrufen. Nach Beendigung des Vertrags stellt der Anbieter dem
          Kunden für einen angemessenen Zeitraum die Möglichkeit zum Export zur Verfügung
          und löscht anschließend die Kundendaten, soweit keine gesetzlichen
          Aufbewahrungspflichten entgegenstehen. Einzelheiten zu Löschfristen regelt die
          AVV.
        </p>
      </LegalSection>

      <LegalSection title="13. Haftung">
        <p>
          Der Anbieter haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei
          Verletzung von Leben, Körper und Gesundheit. Bei einfacher Fahrlässigkeit haftet
          der Anbieter nur bei Verletzung wesentlicher Vertragspflichten
          (Kardinalpflichten) und begrenzt auf den vertragstypisch vorhersehbaren Schaden.
          Im Übrigen ist die Haftung ausgeschlossen. Der Kunde ist für die regelmäßige
          Sicherung seiner Daten mitverantwortlich; die Haftung für Datenverlust ist auf
          den Aufwand begrenzt, der bei ordnungsgemäßer und regelmäßiger Datensicherung
          durch den Kunden zur Wiederherstellung angefallen wäre.
        </p>
      </LegalSection>

      <LegalSection title="14. Freistellung">
        <p>
          Der Kunde stellt den Anbieter von allen Ansprüchen Dritter frei, die auf einer
          rechtswidrigen Nutzung der Anwendung durch den Kunden oder seine Nutzer oder auf
          einer Verletzung datenschutzrechtlicher Pflichten des Kunden beruhen. Dies
          umfasst auch angemessene Kosten der Rechtsverteidigung.
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
