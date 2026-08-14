import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal-page";
import { isWegSaas, productName } from "@/lib/app-mode";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return {
    title: "Auftragsverarbeitung nach Art. 28 DSGVO (AVV)",
    description:
      "Vertrag zur Auftragsverarbeitung: Gegenstand, Weisungen, Subunternehmer, " +
      "Schutzmaßnahmen und Löschung der Daten nach Vertragsende.",
  };
}

/**
 * Vertrag zur Auftragsverarbeitung nach Art. 28 DSGVO.
 *
 * Wer Verantwortlicher ist, hängt an der Tür: Auf der B&W-Seite ist es die
 * gewerbliche Hausverwaltung, auf wegportal24 die Gemeinschaft der
 * Wohnungseigentümer selbst (§ 9a WEG). Der Text nannte durchgehend „die
 * Hausverwaltung" — dieselbe Markenblindheit wie zuvor in der
 * Datenschutzerklärung, und hier mit der Folge, dass die Vertragspartnerin
 * im Vertrag nicht vorkam.
 *
 * Am 05.08.2026 ergänzt, weil Art. 28 es verlangt und es fehlte:
 *   - Widerspruchsrecht bei neuen Subprozessoren (Abs. 2) — ohne das trägt
 *     eine allgemeine Genehmigung nicht;
 *   - Hinweispflicht bei rechtswidriger Weisung (Abs. 3 Satz 3);
 *   - Weisungsform und weisungsberechtigte Personen;
 *   - Löschfrist nach Vertragsende (Abs. 3 lit. g), abgestimmt auf die AGB;
 *   - Verarbeitungsort und Drittlandgarantien.
 *
 * Gestrichen wurden zwei Verweise auf Unterlagen, die es nicht gibt („die
 * ausführliche TOM-Beschreibung ist Anlage zu diesem Vertrag", „der
 * EU-Hosting-Nachweis wird gesondert dokumentiert"). Ein Vertrag, der auf
 * eine nicht existierende Anlage verweist, ist an dieser Stelle nicht
 * bloß unvollständig — er behauptet etwas Unzutreffendes. Die Maßnahmen
 * stehen jetzt ausformuliert im Vertrag selbst.
 */
export default function AvvPage() {
  const weg = isWegSaas();
  // Wer ist Verantwortlicher? Auf wegportal24 die Gemeinschaft, sonst der
  // gewerbliche Kunde.
  const verantwortlich = weg ? "die Wohnungseigentümergemeinschaft" : "die Hausverwaltung";

  return (
    <LegalPage
      title="Vertrag zur Auftragsverarbeitung (AVV)"
      intro={
        <>
          <p>
            Dieser Vertrag zur Auftragsverarbeitung konkretisiert die Pflichten nach
            Art. 28 DSGVO für die Verarbeitung personenbezogener Daten im Auftrag bei der
            Nutzung von <strong>{productName()}</strong>.
          </p>
          <p className="mt-2">
            <strong>Verantwortliche</strong> ist {verantwortlich} als Kundin (nachfolgend
            „Verantwortliche“); <strong>Auftragsverarbeiterin</strong> ist die B&amp;W
            Immobilien Management UG (haftungsbeschränkt), Goethestraße 42, 45964 Gladbeck,
            als Betreiberin der Software (nachfolgend „Auftragsverarbeiterin“).
          </p>
          {weg ? (
            <p className="mt-2 text-gray-500">
              Bei einer selbstverwalteten Gemeinschaft entscheidet die Gemeinschaft selbst
              über Zwecke und Mittel der Verarbeitung — sie ist damit Verantwortliche im
              Sinne des Art. 4 Nr. 7 DSGVO, auch wenn sie keine gewerbliche Verwaltung
              beschäftigt.
            </p>
          ) : null}
          <p className="mt-2 text-gray-500">Stand: 13. August 2026</p>
        </>
      }
    >
      <LegalSection title="1. Gegenstand und Dauer">
        <p>
          Gegenstand ist die Verarbeitung personenbezogener Daten durch die
          Auftragsverarbeiterin im Rahmen der Bereitstellung der Software. Die Dauer
          entspricht der Laufzeit des Nutzungsvertrags. Dieser Vertrag endet automatisch
          mit ihm; die Pflichten aus Ziffer 8 (Löschung) und Ziffer 3 (Vertraulichkeit)
          gelten darüber hinaus fort.
        </p>
      </LegalSection>

      <LegalSection title="2. Art, Zweck, Datenarten, betroffene Personen">
        <p>
          <strong>Zweck:</strong>{" "}
          {weg
            ? "Verwaltung der Wohnungseigentümergemeinschaft — Einheiten, Eigentümer, Beschlüsse, Versammlungen, Vorgänge, Dokumente, WEG-Finanzen und Kommunikation."
            : "Verwaltung von Immobilien, Vorgängen, Dokumenten und Kommunikation."}{" "}
          <strong>Art der Verarbeitung:</strong> Erheben, Speichern, Ordnen, Auslesen,
          Verwenden, Übermitteln an von der Verantwortlichen bestimmte Empfänger und
          Löschen.{" "}
          <strong>Art der Daten:</strong> Stammdaten (Name, Anschrift, Kontaktdaten),
          Vertrags- und Objektdaten, Miteigentumsanteile und Stimmrechte, Vorgangs- und
          Kommunikationsinhalte, Abrechnungs- und Zahlungsdaten, hochgeladene Dokumente und
          Fotos, Zählerstände, ggf. Unterschriften.{" "}
          <strong>Betroffene Personen:</strong> Eigentümer, Mieter,
          Dienstleister/Handwerker
          {weg ? ", Mitglieder des Verwaltungsbeirats" : ", Beschäftigte der Kundin"}.
        </p>
        <p className="text-gray-500">
          Besondere Kategorien personenbezogener Daten nach Art. 9 DSGVO sind nicht
          Gegenstand des Auftrags. Stellt die Verantwortliche solche Daten dennoch ein
          (etwa in einem hochgeladenen Dokument), verarbeitet die Auftragsverarbeiterin sie
          im selben Rahmen; die Zulässigkeit verantwortet die Verantwortliche.
        </p>
      </LegalSection>

      <LegalSection title="3. Weisungen und Pflichten der Auftragsverarbeiterin">
        <p>Die Auftragsverarbeiterin verpflichtet sich insbesondere:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Daten ausschließlich auf dokumentierte Weisung der Verantwortlichen zu
            verarbeiten — auch hinsichtlich einer Übermittlung in Drittländer —, es sei
            denn, sie ist nach Unionsrecht oder dem Recht eines Mitgliedstaats zur
            Verarbeitung verpflichtet; in diesem Fall teilt sie dies vor der Verarbeitung
            mit, sofern das betreffende Recht die Mitteilung nicht verbietet
            (Art. 28 Abs. 3 lit. a DSGVO);
          </li>
          <li>
            die Verantwortliche <strong>unverzüglich zu informieren</strong>, wenn sie der
            Auffassung ist, dass eine Weisung gegen die DSGVO oder andere
            Datenschutzbestimmungen verstößt (Art. 28 Abs. 3 Satz 3 DSGVO); sie darf die
            Ausführung der betreffenden Weisung bis zu deren Bestätigung aussetzen;
          </li>
          <li>
            die zur Verarbeitung befugten Personen zur Vertraulichkeit zu verpflichten
            oder sicherzustellen, dass sie einer angemessenen gesetzlichen
            Verschwiegenheitspflicht unterliegen;
          </li>
          <li>
            geeignete technische und organisatorische Maßnahmen nach Art. 32 DSGVO zu
            treffen (Ziffer 6);
          </li>
          <li>
            die Verantwortliche bei der Erfüllung von Betroffenenrechten (Art. 12–23),
            bei Datenschutz-Folgenabschätzungen (Art. 35) und bei Meldepflichten
            (Art. 33/34) angemessen zu unterstützen;
          </li>
          <li>
            die zum Nachweis der Einhaltung erforderlichen Informationen bereitzustellen
            und Überprüfungen zu ermöglichen (Ziffer 7).
          </li>
        </ul>
        <p>
          <strong>Form der Weisungen:</strong> Weisungen ergehen in Textform. Als Weisung
          gilt auch die Nutzung der in der Anwendung vorgesehenen Funktionen durch die
          Verantwortliche oder von ihr berechtigte Personen — etwa das Anlegen, Ändern,
          Freigeben, Exportieren oder Löschen von Daten. Weisungsberechtigt ist die in der
          Anwendung als Administrator geführte Person der Verantwortlichen.
        </p>
      </LegalSection>

      <LegalSection title="4. Unterauftragsverhältnisse (Subprozessoren)">
        <p>
          Die Verantwortliche erteilt die <strong>allgemeine schriftliche Genehmigung</strong>{" "}
          zur Einbindung von Subprozessoren (Art. 28 Abs. 2 DSGVO). Zum Zeitpunkt des
          Vertragsschlusses sind dies:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Hosting / Anwendungsbetrieb: Vercel Inc. (USA), Server-Region EU;</li>
          <li>Datenbank: Neon (PostgreSQL), EU-Region;</li>
          <li>Datei- und Objektspeicher für Uploads: Vercel Blob;</li>
          <li>E-Mail-Versand: Google (Gmail / Google Workspace);</li>
          <li>Optionaler Dokumenten-Import: Google Drive;</li>
          <li>
            Optionale KI-Funktionen (Assistent, Vorqualifizierung von Vorgängen,
            Objekt-Import aus PDF, Kostenart-Vorschlag beim Bankimport): Google
            (Gemini API) — nur, wenn die Verantwortliche sie ausdrücklich aktiviert;
          </li>
          <li>
            Push-Benachrichtigungen: geräteabhängige Push-Dienste von Google, Apple bzw.
            Mozilla.
          </li>
        </ul>
        <p>
          Die Auftragsverarbeiterin schließt mit jedem Subprozessor einen Vertrag, der
          diesem im Wesentlichen dieselben Pflichten auferlegt, die hier vereinbart sind,
          und bleibt der Verantwortlichen gegenüber für dessen Verhalten verantwortlich.
        </p>
        <p className="text-gray-500">
          <strong>Kein Subprozessor ist der Zahlungsdienstleister Stripe.</strong> Über
          ihn wird das Entgelt für den Nutzungsvertrag abgerechnet. Dabei verarbeitet er
          ausschließlich Vertragsdaten der Verantwortlichen — eine interne Kennnummer
          ihrer Organisation, die gewählte Tarifbezeichnung und die von ihr selbst bei
          Stripe hinterlegten Rechnungs- und Zahlungsdaten. Im Auftrag verarbeitete Daten
          (Eigentümer, Mieter, Vorgänge, Dokumente, Beschlüsse, Belege) erreichen Stripe
          nicht. Für diese Zahlungsabwicklung ist die Auftragsverarbeiterin daher eigene
          Verantwortliche und nicht Auftragsverarbeiterin; Einzelheiten dazu in der{" "}
          <Link href="/datenschutz" className="text-brand-green hover:underline">
            Datenschutzerklärung
          </Link>
          .
        </p>
        <p>
          <strong>Änderungen werden angekündigt.</strong> Beabsichtigt die
          Auftragsverarbeiterin, einen weiteren Subprozessor hinzuzuziehen oder einen
          bestehenden zu ersetzen, teilt sie dies der Verantwortlichen mindestens{" "}
          <strong>vier Wochen</strong> vorher in Textform mit. Die Verantwortliche kann der
          Änderung innerhalb dieser Frist aus datenschutzrechtlichen Gründen widersprechen.
          Widerspricht sie, kann die Auftragsverarbeiterin den Wechsel unterlassen oder den
          Nutzungsvertrag zum beabsichtigten Wechselzeitpunkt kündigen; bereits im Voraus
          gezahlte Entgelte werden anteilig erstattet.
        </p>
      </LegalSection>

      <LegalSection title="5. Verarbeitungsort und Drittlandübermittlung">
        <p>
          Die Verarbeitung findet in der Europäischen Union statt. Einzelne Subprozessoren
          haben ihren Sitz in den USA und können dort auf Daten zugreifen (insbesondere
          Vercel Inc. und Google). Soweit dabei personenbezogene Daten in ein Drittland
          übermittelt werden, stützt sich die Übermittlung auf geeignete Garantien nach
          Kapitel V DSGVO — die EU-Standardvertragsklauseln (Durchführungsbeschluss (EU)
          2021/914) bzw. den Angemessenheitsbeschluss zum EU-U.S. Data Privacy Framework,
          soweit der jeweilige Empfänger dort zertifiziert ist.
        </p>
        <p>
          Die KI-Funktionen sind <strong>standardmäßig ausgeschaltet</strong>. Erst wenn die
          Verantwortliche sie aktiviert, werden die dafür benötigten Inhalte an Google
          übermittelt: bei der Vorqualifizierung Titel und Beschreibung des Vorgangs, beim
          Assistenten die Frage samt der dazu gefundenen Textauszüge, beim Objekt-Import
          das hochgeladene PDF <strong>vollständig</strong>. Welche Unterlagen sie dort
          einstellt, entscheidet allein die Verantwortliche. Einzelheiten unter{" "}
          <Link href="/ki-transparenz" className="text-brand-green hover:underline">
            KI-Transparenz
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="6. Technisch-organisatorische Maßnahmen (Art. 32 DSGVO)">
        <p>Die Auftragsverarbeiterin unterhält mindestens folgende Maßnahmen:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Zugangskontrolle:</strong> Anmeldung mit E-Mail und Passwort; Passwörter
            werden ausschließlich als kryptografischer Hash (bcrypt) gespeichert, nie im
            Klartext. Begrenzung fehlgeschlagener Anmeldeversuche.
          </li>
          <li>
            <strong>Zugriffskontrolle:</strong> rollenbasierte Rechte (Verwaltung,
            Eigentümer, Mieter) und Mandantentrennung je Organisation. Jede Datenabfrage
            wird serverseitig auf Berechtigung geprüft; die Trennung wird durch
            automatisierte Prüfungen gegen eine echte Datenbank abgesichert, die bei jeder
            Änderung an der Software laufen.
          </li>
          <li>
            <strong>Übertragungskontrolle:</strong> ausschließlich verschlüsselte
            Verbindungen (TLS/HTTPS). Ruhende Daten werden bei den eingesetzten
            Subprozessoren verschlüsselt gespeichert.
          </li>
          <li>
            <strong>Eingabekontrolle:</strong> Protokollierung sicherheitsrelevanter und
            verwaltungsrelevanter Vorgänge mit Zeitstempel und handelnder Person
            (Audit-Log), für die Verantwortliche einsehbar.
          </li>
          <li>
            <strong>Verfügbarkeit und Wiederherstellbarkeit:</strong> regelmäßige,
            automatisierte Datensicherung durch den Datenbank-Dienstleister mit der
            Möglichkeit der Wiederherstellung auf einen früheren Zeitpunkt.
          </li>
          <li>
            <strong>Trennungskontrolle:</strong> Daten verschiedener Organisationen werden
            logisch getrennt gehalten; ein Zugriff über Organisationsgrenzen hinweg ist
            nicht vorgesehen und wird serverseitig unterbunden.
          </li>
        </ul>
        <p className="text-gray-500">
          Die Maßnahmen unterliegen dem technischen Fortschritt. Die Auftragsverarbeiterin
          darf sie anpassen, solange das Schutzniveau nicht unterschritten wird.
        </p>
      </LegalSection>

      <LegalSection title="7. Nachweise und Überprüfungen">
        <p>
          Die Auftragsverarbeiterin stellt der Verantwortlichen auf Anfrage die zum
          Nachweis der Einhaltung dieses Vertrags erforderlichen Informationen zur
          Verfügung. Die Verantwortliche kann sich — auch durch beauftragte Prüfer — von
          der Einhaltung überzeugen. Überprüfungen erfolgen nach angemessener Vorankündigung
          (in der Regel zwei Wochen), zu üblichen Geschäftszeiten und ohne vermeidbare
          Störung des Betriebs. Der Nachweis kann auch durch aktuelle Testate, Zertifikate
          oder Prüfberichte geführt werden.
        </p>
      </LegalSection>

      <LegalSection title="8. Löschung und Rückgabe nach Vertragsende">
        <p>
          Nach Beendigung des Nutzungsvertrags löscht die Auftragsverarbeiterin die im
          Auftrag verarbeiteten Daten oder gibt sie nach Wahl der Verantwortlichen zurück.
          Die Verantwortliche kann ihre Daten dafür <strong>mindestens 30 Tage</strong> lang
          über die Export-Funktionen der Anwendung abrufen. Nach Ablauf dieser Frist werden
          die Daten binnen <strong>weiterer 30 Tage</strong> gelöscht, einschließlich
          bestehender Sicherungskopien im Rahmen der jeweiligen Sicherungszyklen.
        </p>
        <p>
          Ausgenommen sind Daten, für die eine gesetzliche Aufbewahrungspflicht besteht
          (insbesondere Rechnungsdaten nach § 147 AO). Diese werden gesperrt und
          ausschließlich zu diesem Zweck weiter aufbewahrt.
        </p>
      </LegalSection>

      <LegalSection title="9. Meldepflichten">
        <p>
          Die Auftragsverarbeiterin informiert die Verantwortliche unverzüglich über
          Verletzungen des Schutzes personenbezogener Daten in ihrem
          Verantwortungsbereich und unterstützt bei den erforderlichen Meldungen nach
          Art. 33 und 34 DSGVO. Die Meldung enthält, soweit bekannt, Art der Verletzung,
          betroffene Datenkategorien und Personengruppen, wahrscheinliche Folgen sowie
          ergriffene Gegenmaßnahmen.
        </p>
      </LegalSection>

      <LegalSection title="10. Haftung und Schlussbestimmungen">
        <p>
          Es gelten die Haftungsregelungen der DSGVO (Art. 82). Im Übrigen gelten die
          Bestimmungen des Nutzungsvertrags entsprechend. Bei Widersprüchen zwischen diesem
          Vertrag und dem Nutzungsvertrag geht dieser Vertrag in Bezug auf den Datenschutz
          vor. Sollten einzelne Bestimmungen unwirksam sein, bleibt die Wirksamkeit der
          übrigen unberührt.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
