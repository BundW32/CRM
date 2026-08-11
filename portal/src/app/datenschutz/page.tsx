import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal-page";
import { isWegSaas, productName } from "@/lib/app-mode";

export const dynamic = "force-dynamic";

/**
 * Datenschutzerklärung — für BEIDE Türen, mit einem entscheidenden Unterschied.
 *
 * Bis zum 05.08.2026 stand hier ein einziger Text, der stillschweigend die
 * B&W-Sicht beschrieb: „Wir verarbeiten Daten, um die Hausverwaltung
 * abzuwickeln." Auf wegportal24 stimmt das nicht. Dort verwaltet nicht die
 * Anbieterin, sondern die Gemeinschaft selbst — die Anbieterin stellt nur das
 * Werkzeug. Damit gibt es zwei getrennte Rollen, und wer sie vermischt, sagt
 * dem Leser das Falsche darüber, wer für seine Daten einsteht:
 *
 *   1. Vertragsdaten der Kundin (Registrierung, Abrechnung, Support)
 *      → Anbieterin ist EIGENE Verantwortliche (Art. 4 Nr. 7 DSGVO).
 *   2. Inhaltsdaten in der Anwendung (Eigentümer, Mieter, Handwerker,
 *      Beschlüsse, Belege) → die GEMEINSCHAFT ist Verantwortliche, die
 *      Anbieterin nur Auftragsverarbeiterin (Art. 28 DSGVO, siehe AVV).
 *
 * Außerdem trug die Seite den Hinweis, sie sei „vor dem Produktivbetrieb zu
 * prüfen" — auf einer Pflichtinformation nach Art. 13 DSGVO ein Eingeständnis,
 * dass die Pflicht nicht erfüllt ist.
 */
export default function DatenschutzPage() {
  const weg = isWegSaas();

  return (
    <LegalPage
      title="Datenschutzerklärung"
      intro={
        <>
          <p>
            Diese Erklärung informiert nach Art. 13 und 14 DSGVO über die Verarbeitung
            personenbezogener Daten bei der Nutzung von <strong>{productName()}</strong>.
          </p>
          <p className="mt-2 text-gray-500">Stand: 11. August 2026</p>
        </>
      }
    >
      <LegalSection title="1. Verantwortliche Stelle">
        <p>
          B &amp; W Immobilien Management UG (haftungsbeschränkt), Goethestraße 42, 45964
          Gladbeck, vertreten durch die Geschäftsführer Franz-Josef Barth und Alexander
          Wachtel (stv.). Telefon: +49 151 29468127, E-Mail:{" "}
          <a href="mailto:info@bundwimmobilien.de" className="text-brand-green hover:underline">
            info@bundwimmobilien.de
          </a>
          .
        </p>
        {weg ? (
          <p className="text-gray-500">
            Die vorgenannte Gesellschaft betreibt das Portal unter der Marke{" "}
            {productName()}.
          </p>
        ) : null}
      </LegalSection>

      {weg ? (
        <LegalSection title="2. Zwei Rollen — wer wofür verantwortlich ist">
          <p>
            Bei {productName()} verwaltet nicht die Anbieterin Ihre Immobilie, sondern Ihre
            Gemeinschaft selbst. Die Anbieterin stellt die Anwendung bereit. Daraus ergeben
            sich <strong>zwei getrennte Verantwortlichkeiten</strong>:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Vertragsdaten der Gemeinschaft</strong> — Registrierung, Zugangsdaten
              der Administratorin oder des Administrators, Abrechnung, Support-Anfragen,
              Sicherheitsprotokolle. Hierfür ist die Anbieterin{" "}
              <strong>eigene Verantwortliche</strong>. Für diese Daten gilt die vorliegende
              Erklärung.
            </li>
            <li>
              <strong>Inhaltsdaten in der Anwendung</strong> — Daten der Eigentümer, Mieter
              und Handwerker, Vorgänge, Dokumente, Beschlüsse, Zählerstände, Belege.
              Verantwortlich ist hierfür die <strong>Wohnungseigentümergemeinschaft</strong>
              , die sie einstellt; die Anbieterin verarbeitet sie ausschließlich
              weisungsgebunden als <strong>Auftragsverarbeiterin</strong> nach Art. 28 DSGVO
              auf Grundlage des{" "}
              <Link href="/avv" className="text-brand-green hover:underline">
                Vertrags zur Auftragsverarbeitung
              </Link>
              .
            </li>
          </ul>
          <p>
            Sind Sie Eigentümerin, Eigentümer, Mieterin oder Mieter und möchten Auskunft
            über Ihre Daten oder deren Löschung verlangen, richten Sie sich bitte an{" "}
            <strong>Ihre Gemeinschaft</strong> als verantwortliche Stelle. Die Anbieterin
            unterstützt sie dabei, darf aber ohne deren Weisung nicht selbst über diese
            Daten verfügen.
          </p>
        </LegalSection>
      ) : (
        <LegalSection title="2. Zweck und Rechtsgrundlage der Verarbeitung">
          <p>
            Wir verarbeiten personenbezogene Daten, um die Hausverwaltung und die
            Kommunikation zwischen Verwaltung, Eigentümern, Mietern und beauftragten
            Handwerkern über dieses Portal abzuwickeln (z. B. Schadensmeldungen, Dokumente,
            Aushänge, Abstimmungen, Zählerstände, Nachrichten).
          </p>
          <p>
            Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung bzw.
            vorvertragliche Maßnahmen) sowie Art. 6 Abs. 1 lit. c DSGVO (rechtliche
            Verpflichtungen, z. B. WEG-rechtliche Dokumentationspflichten) und ggf.
            Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einer effizienten
            Verwaltung).
          </p>
        </LegalSection>
      )}

      {weg ? (
        <LegalSection title="3. Zweck und Rechtsgrundlage (Vertragsdaten)">
          <p>
            Wir verarbeiten die Vertragsdaten, um den Zugang einzurichten und zu betreiben,
            die Anwendung bereitzustellen, Rechnungen zu stellen und Support zu leisten.
          </p>
          <p>
            Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Erfüllung des
            Nutzungsvertrags), für die Aufbewahrung von Rechnungen Art. 6 Abs. 1 lit. c
            DSGVO in Verbindung mit § 147 AO und § 257 HGB, sowie für die Abwehr von
            Missbrauch (Anmeldeversuche, Ratenbegrenzung) Art. 6 Abs. 1 lit. f DSGVO — das
            berechtigte Interesse besteht in der Sicherheit des Dienstes.
          </p>
        </LegalSection>
      ) : null}

      <LegalSection title={weg ? "4. Verarbeitete Datenkategorien" : "3. Verarbeitete Datenkategorien"}>
        <p>
          Stammdaten (Name, Anschrift/Objekt-/Einheitszuordnung, E-Mail, Telefon,
          bevorzugter Kontaktweg), Zugangsdaten (E-Mail-Adresse, kryptografisch gehashtes
          Passwort), Inhalte (Vorgänge, Kommentare, Fotos, Dokumente, Nachrichten,
          Abstimmungen, Zählerstände) sowie technische Daten (Zeitstempel, IP-Adresse in
          Sicherheitsprotokollen).
        </p>
        <p>
          Ein Nutzungsprofil wird nicht gebildet. Die Anwendung setzt{" "}
          <strong>keine Analyse- oder Werbe-Cookies</strong> ein; gesetzt werden
          ausschließlich technisch erforderliche Cookies für die Anmeldesitzung
          (§ 25 Abs. 2 Nr. 2 TDDDG — insoweit ist keine Einwilligung erforderlich).
        </p>
      </LegalSection>

      <LegalSection title={weg ? "5. Empfänger und Auftragsverarbeiter" : "4. Empfänger / Auftragsverarbeiter"}>
        <p>
          Zum Betrieb des Portals setzen wir Dienstleister ein, mit denen Verträge zur
          Auftragsverarbeitung nach Art. 28 DSGVO bestehen:
        </p>
        <ul className="list-disc pl-5">
          <li>Hosting/Betrieb der Anwendung: Vercel Inc.</li>
          <li>Datenbank: Neon (PostgreSQL, EU-Region)</li>
          <li>Datei-Speicher: Vercel Blob (Dokumente, Fotos, Unterschriften)</li>
          <li>E-Mail-Versand: Google (Gmail / Google Workspace)</li>
          <li>
            Zahlungsabwicklung kostenpflichtiger Tarife: Stripe. Übermittelt werden dabei
            eine interne Kennnummer Ihrer Organisation und die gewählte Tarifbezeichnung;
            Rechnungsanschrift und Zahlungsdaten geben Sie direkt bei Stripe ein, sie
            durchlaufen unsere Anwendung nicht. Zurück erhalten wir Kundennummer,
            Abo-Kennung, Tarif, Abo-Status und das Ende einer Testphase.
          </li>
          <li>
            KI-Funktionen (Assistent, Vorqualifizierung eingehender Meldungen,
            Objekt-Import aus PDF) – optional, nur bei Aktivierung durch die Verwaltung:
            Google (Gemini API); Einzelheiten unter{" "}
            <Link href="/ki-transparenz" className="text-brand-green hover:underline">
              KI-Transparenz
            </Link>
          </li>
          <li>Optionaler Dokumenten-Import aus Google Drive</li>
          <li>
            Push-Benachrichtigungen (optional, je nach Gerät/Browser): Push-Dienste von
            Google, Apple oder Mozilla
          </li>
        </ul>
        <p className="mt-2">
          Stripe verarbeitet die Zahlungsdaten zugleich <strong>in eigener
          Verantwortung</strong>, soweit das Unternehmen dazu gesetzlich verpflichtet ist
          (Zahlungsdiensteaufsicht, Geldwäscheprävention, Betrugsabwehr). Insoweit ist
          Stripe nicht unser Auftragsverarbeiter, sondern eigener Verantwortlicher; es
          gelten die Datenschutzhinweise von Stripe.
        </p>
        <p className="mt-2">
          Einzelne Dienste (u. a. Google und Stripe) können Daten außerhalb der EU (USA)
          verarbeiten. Soweit dies der Fall ist, erfolgt die Übermittlung auf Grundlage
          geeigneter Garantien nach Kapitel V DSGVO — Standardvertragsklauseln bzw.
          Angemessenheitsbeschluss (EU-U.S. Data Privacy Framework).
        </p>
      </LegalSection>

      <LegalSection title={weg ? "6. Speicherdauer" : "5. Speicherdauer"}>
        <p>
          Daten werden für die Dauer des Vertrags- bzw. Verwaltungsverhältnisses und im
          Rahmen gesetzlicher Aufbewahrungsfristen gespeichert und anschließend gelöscht
          oder anonymisiert. IP-Adressen in internen Sicherheitsprotokollen werden
          spätestens nach 90 Tagen entfernt. Rechnungsdaten werden nach § 147 AO zehn Jahre
          aufbewahrt.
        </p>
        {weg ? (
          <p>
            Nach Vertragsende bleibt der Datenexport mindestens 30 Tage möglich; danach
            werden die Inhaltsdaten gelöscht, soweit keine Aufbewahrungspflicht
            entgegensteht.
          </p>
        ) : null}
      </LegalSection>

      <LegalSection title={weg ? "7. Datensicherheit" : "6. Datensicherheit"}>
        <p>
          Die Übertragung erfolgt verschlüsselt (TLS/HTTPS). Passwörter werden
          ausschließlich als kryptografischer Hash gespeichert. Der Zugriff erfolgt
          rollenbasiert; jede Datenabfrage wird serverseitig auf Berechtigung geprüft.
          Ruhende Daten werden durch die eingesetzten Dienstleister verschlüsselt
          gespeichert.
        </p>
      </LegalSection>

      <LegalSection title={weg ? "8. Einsatz von KI-Systemen" : "7. Einsatz von KI-Systemen"}>
        <p>
          Das Portal enthält <strong>drei</strong> optionale KI-Funktionen: einen
          Assistenten, der Fragen aus den für Sie freigegebenen Unterlagen beantwortet,
          eine Vorqualifizierung eingehender Schadensmeldungen (Vorschlag für Gewerk und
          Dringlichkeit) und einen Objekt-Import, der beim Anlegen eines Objekts die
          Stammdaten aus einem hochgeladenen PDF vorschlägt. Alle drei sind standardmäßig
          deaktiviert und werden nur aktiv, wenn die Verwaltung sie ausdrücklich
          freischaltet. Ist eine Funktion aktiv, werden die dafür benötigten Inhalte an die
          Gemini-API von Google übermittelt; eine Verarbeitung außerhalb der EU ist dabei
          möglich.
        </p>
        <p>
          <strong>Der Umfang unterscheidet sich je Funktion.</strong> Die
          Vorqualifizierung übermittelt Titel und Beschreibung der Meldung. Der Assistent
          übermittelt Ihre Frage, Ihre Rolle im Portal und die dazu gefundenen
          Textauszüge — bei Fragen zu Geld auch Angaben zu Kontostand, Rückständen und
          Hausgeld. Der Objekt-Import übermittelt das hochgeladene PDF{" "}
          <strong>vollständig</strong>; laden Sie dort daher nur Unterlagen hoch, deren
          Weitergabe an Google Sie verantworten können.
        </p>
        <p>
          Die KI trifft <strong>keine automatisierte Entscheidung im Einzelfall</strong> im
          Sinne von Art. 22 DSGVO: Sie erzeugt Vorschläge und Auskünfte, über die Menschen
          entscheiden. Bei Finanzen, Hausgeld, Mahnwesen, Abrechnungen und Abstimmungen
          kommt keine KI zum Einsatz. Welche Systeme wir mit welcher Risikoeinstufung nach
          der EU-KI-Verordnung betreiben, legen wir unter{" "}
          <Link href="/ki-transparenz" className="text-brand-green hover:underline">
            KI-Transparenz
          </Link>{" "}
          offen.
        </p>
      </LegalSection>

      <LegalSection title={weg ? "9. Ihre Rechte" : "8. Ihre Rechte"}>
        <p>
          Sie haben das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung
          (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit
          (Art. 20) und Widerspruch (Art. 21 DSGVO). Angemeldete Nutzer können ihre Daten
          im Bereich „Konto“ selbst exportieren.
        </p>
        <p>
          <strong>Widerspruchsrecht:</strong> Soweit wir Daten auf Grundlage eines
          berechtigten Interesses verarbeiten (Art. 6 Abs. 1 lit. f DSGVO), können Sie der
          Verarbeitung aus Gründen, die sich aus Ihrer besonderen Situation ergeben,
          jederzeit widersprechen.
        </p>
        <p>
          Wenden Sie sich dafür an{" "}
          <a href="mailto:info@bundwimmobilien.de" className="text-brand-green hover:underline">
            info@bundwimmobilien.de
          </a>
          {weg ? (
            <>
              {" "}— bei Daten, die Ihre Gemeinschaft eingestellt hat, an deren Verwaltung
              (siehe Ziffer 2)
            </>
          ) : null}
          .
        </p>
        <p>
          Ihnen steht ferner ein <strong>Beschwerderecht bei einer Aufsichtsbehörde</strong>{" "}
          zu (Art. 77 DSGVO). Zuständig für uns ist die Landesbeauftragte für Datenschutz
          und Informationsfreiheit Nordrhein-Westfalen, Kavalleriestraße 2–4, 40213
          Düsseldorf.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
