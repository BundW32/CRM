// Öffentliche KI-Transparenzseite (Art. 50 KI-VO / EU AI Act).
// Die Verordnung (EU) 2024/1689 ist seit dem 2. August 2026 in vollem Umfang
// anwendbar. wegportal.24 ist Anbieter der beiden KI-Funktionen (Assistent und
// Triage), die selbstverwaltende WEG bzw. Hausverwaltung ist deren Betreiber.
// Diese Seite legt offen, welche KI eingesetzt wird, wozu, mit welchem Modell
// und wo die Grenzen liegen. Sie ist aus der Fußzeile jeder Marketing-Seite
// verlinkt.
import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "KI-Transparenz nach Art. 50 KI-Verordnung | wegportal.24",
  description:
    "Welche KI-Funktionen wegportal.24 einsetzt, wozu, mit welchem Modell und " +
    "wo die Grenzen liegen – offengelegt nach Artikel 50 der EU-KI-Verordnung.",
};

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
          wegportal.24 mit einem KI-System zu tun haben. Diese Seite tut das – in
          verständlicher Sprache und ohne Kleingedrucktes.
        </p>
      }
    >
      <LegalSection title="1. Kurzfassung">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            wegportal.24 enthält <strong>zwei</strong> KI-Funktionen: einen Assistenten für
            Rückfragen zu Ihren eigenen Unterlagen und eine Vorsortierung eingehender
            Schadensmeldungen.
          </li>
          <li>
            Beide sind <strong>standardmäßig ausgeschaltet</strong> und werden erst aktiv,
            wenn Ihre Gemeinschaft bzw. Verwaltung sie ausdrücklich freischaltet.
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
      </LegalSection>

      <LegalSection title="3. Wer welche Rolle hat">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Anbieter</strong> im Sinne der KI-Verordnung ist wegportal.24 (siehe{" "}
            <Link href="/impressum" className="text-brand-green hover:underline">
              Impressum
            </Link>
            ): Wir stellen die beiden KI-Systeme unter eigenem Namen bereit.
          </li>
          <li>
            <strong>Betreiber</strong> ist Ihre Eigentümergemeinschaft bzw. Hausverwaltung,
            sobald sie die Funktionen freischaltet und im Alltag nutzt.
          </li>
          <li>
            <strong>Modellanbieter</strong> ist Google: Beide Funktionen nutzen die
            Gemini-API. Wir trainieren kein eigenes Modell.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Risikoeinstufung">
        <p>
          Beide Funktionen sind nach unserer Einschätzung <strong>keine
          Hochrisiko-KI-Systeme</strong> im Sinne von Artikel 6 in Verbindung mit Anhang III
          der KI-Verordnung, und sie fallen nicht unter die verbotenen Praktiken nach
          Artikel 5. Sie unterstützen bei Auskunft und Vorsortierung; sie entscheiden nicht
          über den Zugang zu wesentlichen Leistungen, bewerten keine Kreditwürdigkeit und
          treffen keine Entscheidungen mit rechtlicher Wirkung.
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
          Textinhalte (z. B. Titel und Beschreibung einer Meldung, Ihre Frage samt der
          gefundenen Textauszüge) an die Gemini-API von Google übermittelt. Dabei kann eine
          Verarbeitung außerhalb der EU stattfinden; die Übermittlung erfolgt auf Grundlage
          geeigneter Garantien. Dokumente werden nicht ausgelesen – als Quelle dienen nur
          Titel und die im Portal erfassten Texte.
        </p>
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
          danebenliegen. Prüfen Sie die genannten Quellen, bevor Sie auf eine Auskunft hin
          handeln. Der Assistent ist ausdrücklich <strong>keine Rechtsberatung</strong> und
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
        <p className="text-xs text-gray-500">Stand: August 2026.</p>
      </LegalSection>
    </LegalPage>
  );
}
