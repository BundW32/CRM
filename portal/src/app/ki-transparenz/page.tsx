// Öffentliche KI-Transparenzseite (Art. 50 KI-VO / EU AI Act).
// Die Verordnung (EU) 2024/1689 ist seit dem 2. August 2026 in vollem Umfang
// anwendbar. Anbieter der drei KI-Funktionen (Assistent, Triage und
// Objekt-Import) ist der Portalbetreiber, die selbstverwaltende WEG bzw.
// Hausverwaltung ist deren Betreiber. Der Produktname kommt aus `productName()`
// – die Seite wird in BEIDEN Türen ausgeliefert (Art. 50 KI-VO gilt auch für
// die B&W-Tür).
//
// Am 11.08.2026 nachgezogen: Die Seite nannte zwei Funktionen, im Code waren es
// drei — der Objekt-Import (`src/lib/objekt-extraction.ts`) fehlte. Und Ziffer 6
// versprach „Dokumente werden nicht ausgelesen", während genau diese Funktion
// das hochgeladene PDF vollständig an Google sendet. Eine ausdrückliche
// Verneinung, die nicht stimmt, ist schlimmer als eine Lücke.
// Diese Seite legt offen, welche KI eingesetzt wird, wozu, mit welchem Modell
// und wo die Grenzen liegen. Sie ist aus der Fußzeile jeder Marketing-Seite
// verlinkt.
import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal-page";
import { productName } from "@/lib/app-mode";

export const dynamic = "force-static";

export function generateMetadata(): Metadata {
  return {
    title: `KI-Transparenz nach Art. 50 KI-Verordnung | ${productName()}`,
    description:
      `Welche KI-Funktionen ${productName()} einsetzt, wozu, mit welchem Modell und ` +
      "wo die Grenzen liegen – offengelegt nach Artikel 50 der EU-KI-Verordnung.",
  };
}

export default function KiTransparenzPage() {
  return (
    <LegalPage
      title="KI-Transparenz"
      draft
      intro={
        <p>
          Die Verordnung (EU) 2024/1689 über künstliche Intelligenz („KI-Verordnung“,
          EU AI Act) ist seit dem <strong>2. August 2026</strong> in vollem Umfang
          anwendbar. Artikel 50 verpflichtet uns, offenzulegen, wo Sie es in
          {" "}{productName()} mit einem KI-System zu tun haben. Diese Seite tut das – in
          verständlicher Sprache und ohne Kleingedrucktes.
        </p>
      }
    >
      <LegalSection title="1. Kurzfassung">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            {productName()} enthält <strong>drei</strong> KI-Funktionen: einen Assistenten
            für Rückfragen zu Ihren eigenen Unterlagen, eine Vorsortierung eingehender
            Schadensmeldungen und einen Objekt-Import, der Stammdaten aus einem PDF
            vorschlägt.
          </li>
          <li>
            Alle drei sind <strong>standardmäßig ausgeschaltet</strong> und werden erst
            aktiv, wenn Ihre Gemeinschaft bzw. Verwaltung sie ausdrücklich freischaltet.
          </li>
          <li>
            Keine KI-Funktion trifft eine <strong>endgültige Entscheidung</strong>. Sie
            schlägt vor – Menschen entscheiden.
          </li>
          <li>
            Es gibt <strong>keine</strong> KI bei Geld, Recht und Abstimmungen: keine
            Bonitätsbewertung, keine automatischen Mahnungen, keine Beschlüsse, keine
            Abrechnungen.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="2. Welche KI-Funktionen es gibt">
        <p>
          <strong>a) KI-Assistent („Frag deine Gemeinschaft“).</strong> Ein Chatfenster im
          Portal, das Fragen zu Beschlüssen, Versammlungen, Anträgen, Vorgängen und
          Aushängen beantwortet. Der Assistent antwortet ausschließlich auf Grundlage der
          Unterlagen, die Sie mit Ihrer Rolle ohnehin einsehen dürfen, und nennt zu jeder
          Antwort die verwendeten Quellen. Findet er nichts, sagt er das – er rät nicht.
          Er ist als KI gekennzeichnet, seine Antworten ebenfalls.
        </p>
        <p>
          <strong>b) KI-Vorsortierung eingehender Meldungen (Triage).</strong> Trifft eine
          Schadensmeldung ein – im Portal oder per E-Mail –, schlägt die KI das passende
          Gewerk und eine Dringlichkeit vor und fasst den Fall in einem Satz zusammen. Der
          Vorschlag landet als klar gekennzeichnete interne Notiz beim Vorgang. Hat der
          Melder selbst ein Gewerk angegeben, hat seine Angabe Vorrang. Die Verwaltung kann
          jeden Vorschlag jederzeit ändern.
        </p>
        <p>
          <strong>c) KI-Objekt-Import aus PDF.</strong> Legt die Verwaltung ein neues
          Objekt an, kann sie ein PDF hochladen — etwa ein Objektdatenblatt, ein Exposé
          oder einen Auszug aus einer Verwaltersoftware. Die KI liest daraus Adresse,
          Baujahr, Wohnfläche, Gebäude- und Heizungsart sowie eine Liste der Einheiten und
          <strong> füllt damit das Formular vor</strong>. Gespeichert wird nichts, bevor
          die Verwaltung die Felder geprüft und das Formular abgeschickt hat. Anders als
          bei den beiden anderen Funktionen wird hier das <strong>vollständige PDF</strong>
          {" "}an Google übermittelt — siehe Ziffer 6.
        </p>
      </LegalSection>

      <LegalSection title="3. Wer welche Rolle hat">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Anbieter</strong> im Sinne der KI-Verordnung ist {productName()} (siehe{" "}
            <Link href="/impressum" className="text-brand-green hover:underline">
              Impressum
            </Link>
            ): Wir stellen die drei KI-Systeme unter eigenem Namen bereit.
          </li>
          <li>
            <strong>Betreiber</strong> ist Ihre Eigentümergemeinschaft bzw. Hausverwaltung,
            sobald sie die Funktionen freischaltet und im Alltag nutzt.
          </li>
          <li>
            <strong>Modellanbieter</strong> ist Google: Alle drei Funktionen nutzen die
            Gemini-API. Wir trainieren kein eigenes Modell.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Risikoeinstufung">
        <p>
          Alle drei Funktionen sind nach unserer Einschätzung <strong>keine
          Hochrisiko-KI-Systeme</strong> im Sinne von Artikel 6 in Verbindung mit Anhang III
          der KI-Verordnung, und sie fallen nicht unter die verbotenen Praktiken nach
          Artikel 5. Sie unterstützen bei Auskunft, Vorsortierung und Dateneingabe; sie
          entscheiden nicht über den Zugang zu wesentlichen Leistungen, bewerten keine
          Kreditwürdigkeit und treffen keine Entscheidungen mit rechtlicher Wirkung.
        </p>
        <p>
          Damit gelten für uns die Transparenzpflichten aus Artikel 50 sowie die
          KI-Kompetenzpflicht aus Artikel 4 – nicht aber das Pflichtenprogramm für
          Hochrisiko-Systeme.
        </p>
      </LegalSection>

      <LegalSection title="5. Menschliche Aufsicht – und was die KI ausdrücklich nicht tut">
        <p>
          Die finanziell und rechtlich relevanten Teile des Portals arbeiten vollständig
          regelbasiert und nachrechenbar. Konkret gibt es <strong>keinen</strong> KI-Einsatz
          bei:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Wirtschaftsplan, Jahresabrechnung und Vermögensbericht;</li>
          <li>
            Hausgeld-Sollstellungen, Zahlungszuordnung, Mahnwesen und Mahnstufen;
          </li>
          <li>Bewertung der Zahlungsfähigkeit oder Kreditwürdigkeit von Eigentümern;</li>
          <li>Abstimmungen, Stimmgewichten und der Feststellung von Beschlüssen;</li>
          <li>Rechte- und Rollenvergabe.</li>
        </ul>
        <p>
          Wo die KI etwas vorschlägt, bleibt der Vorschlag sichtbar als solcher
          gekennzeichnet und ist von Menschen überschreibbar.
        </p>
      </LegalSection>

      <LegalSection title="6. Datenverarbeitung">
        <p>
          Ist eine KI-Funktion freigeschaltet, werden die für die jeweilige Anfrage nötigen
          Inhalte an die Gemini-API von Google übermittelt. Dabei kann eine Verarbeitung
          außerhalb der EU stattfinden; die Übermittlung erfolgt auf Grundlage geeigneter
          Garantien. <strong>Was genau übermittelt wird, hängt von der Funktion ab:</strong>
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Vorsortierung:</strong> Titel und Beschreibung der eingegangenen
            Meldung.
          </li>
          <li>
            <strong>Assistent:</strong> Ihre Frage, Ihre Rolle im Portal und die dazu
            gefundenen Textauszüge. Gespeicherte Dokumente werden dafür nicht geöffnet —
            als Quelle dienen deren Titel und die im Portal erfassten Texte. Fragen Sie
            nach Geld, gehören dazu auch Kontostand, Rückstände und Hausgeld.
          </li>
          <li>
            <strong>Objekt-Import:</strong> das hochgeladene PDF{" "}
            <strong>vollständig und unverändert</strong>. Diese Funktion ist die einzige,
            die eine Datei als Ganzes weitergibt. Wer sie freischaltet, sollte wissen, was
            in den Unterlagen steht, die dort eingelesen werden — eine Teilungserklärung
            etwa enthält Namen.
          </li>
        </ul>
        <p>
          Ist keine KI-Funktion freigeschaltet, verlassen <strong>keine</strong> Inhalte das
          Portal in Richtung eines KI-Dienstes. Einzelheiten in der{" "}
          <Link href="/datenschutz" className="text-brand-green hover:underline">
            Datenschutzerklärung
          </Link>{" "}
          und im{" "}
          <Link href="/avv" className="text-brand-green hover:underline">
            Auftragsverarbeitungsvertrag
          </Link>
          .
        </p>
        <p>
          Es findet <strong>keine automatisierte Entscheidung im Einzelfall</strong> nach
          Art. 22 DSGVO statt.
        </p>
      </LegalSection>

      <LegalSection title="7. Grenzen und bekannte Schwächen">
        <p>
          KI-Systeme können sich irren. Antworten des Assistenten können unvollständig sein
          oder eine Quelle falsch zusammenfassen; eine vorgeschlagene Dringlichkeit kann
          danebenliegen; ein aus einem PDF gelesener Wert — Wohnfläche, Baujahr, die Zahl
          der Einheiten — kann schlicht falsch sein und gehört vor dem Speichern geprüft.
          Prüfen Sie die genannten Quellen, bevor Sie auf eine Auskunft hin handeln. Der Assistent ist ausdrücklich <strong>keine Rechtsberatung</strong> und
          ersetzt weder Verwalterentscheidung noch Beschluss der Gemeinschaft. Fällt die
          KI aus, läuft das Portal unverändert weiter – sie ist nie Voraussetzung dafür,
          dass eine Meldung ankommt oder ein Vorgang bearbeitet wird.
        </p>
      </LegalSection>

      <LegalSection title="8. KI-Kompetenz (Artikel 4 KI-Verordnung)">
        <p>
          Wer KI-Systeme bereitstellt oder betreibt, muss dafür sorgen, dass die damit
          befassten Personen sie einschätzen können. Wir stellen jeder Gemeinschaft, die
          eine KI-Funktion freischaltet, vorab eine kurze Handreichung bereit: was die
          Funktion kann, was sie nicht kann, woran KI-Ausgaben zu erkennen sind und wie sie
          jederzeit wieder abgeschaltet wird.
        </p>
      </LegalSection>

      <LegalSection title="9. Fragen, Widerspruch, Meldung von Fehlern">
        <p>
          Sie möchten die KI-Funktionen abgeschaltet wissen, haben eine fehlerhafte
          KI-Ausgabe entdeckt oder eine Frage zu dieser Seite? Schreiben Sie uns an{" "}
          <a
            href="mailto:info@bundwimmobilien.de"
            className="text-brand-green hover:underline"
          >
            info@bundwimmobilien.de
          </a>
          . Wir antworten und dokumentieren gemeldete Fehler.
        </p>
        <p className="text-xs text-gray-500">Stand: 11. August 2026.</p>
      </LegalSection>
    </LegalPage>
  );
}
