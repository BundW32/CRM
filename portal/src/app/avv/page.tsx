import { LegalPage, LegalSection } from "@/components/legal-page";

export const dynamic = "force-static";

export default function AvvPage() {
  return (
    <LegalPage
      title="Vertrag zur Auftragsverarbeitung (AVV)"
      draft
      intro={
        <p>
          Dieser Vertrag konkretisiert die datenschutzrechtlichen Pflichten gemäß Art. 28
          DSGVO für die Verarbeitung personenbezogener Daten im Auftrag. <strong>Verantwortlicher
          </strong> ist die Hausverwaltung (Kunde); <strong>Auftragsverarbeiter</strong> ist
          die B&amp;W Immobilien Management UG (haftungsbeschränkt) als Betreiber der Software.
        </p>
      }
    >
      <LegalSection title="1. Gegenstand und Dauer">
        <p>
          Gegenstand ist die Verarbeitung personenbezogener Daten durch den
          Auftragsverarbeiter im Rahmen der Bereitstellung der Software. Die Dauer entspricht
          der Laufzeit des Hauptvertrags (Nutzung der Software).
        </p>
      </LegalSection>

      <LegalSection title="2. Art, Zweck, Datenarten, betroffene Personen">
        <p>
          <strong>Zweck:</strong> Verwaltung von Immobilien, Vorgängen, Dokumenten und
          Kommunikation. <strong>Art der Daten:</strong> Stammdaten (Name, Anschrift,
          Kontaktdaten), Vertrags-/Objektdaten, Vorgangs- und Kommunikationsinhalte,
          hochgeladene Dokumente und Fotos, ggf. Unterschriften.{" "}
          <strong>Betroffene Personen:</strong> Mieter, Eigentümer, Dienstleister/Handwerker,
          Beschäftigte des Kunden.
        </p>
      </LegalSection>

      <LegalSection title="3. Pflichten des Auftragsverarbeiters">
        <p>Der Auftragsverarbeiter verpflichtet sich insbesondere:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Daten nur auf dokumentierte Weisung des Verantwortlichen zu verarbeiten;</li>
          <li>die zur Verarbeitung befugten Personen zur Vertraulichkeit zu verpflichten;</li>
          <li>
            geeignete technische und organisatorische Maßnahmen nach Art. 32 DSGVO zu treffen
            (siehe Ziffer 5);
          </li>
          <li>
            den Verantwortlichen bei Betroffenenrechten, Datenschutz-Folgenabschätzungen und
            Meldepflichten angemessen zu unterstützen;
          </li>
          <li>
            Daten nach Beendigung nach Wahl des Verantwortlichen zu löschen oder
            zurückzugeben;
          </li>
          <li>
            dem Verantwortlichen die erforderlichen Informationen zum Nachweis der Einhaltung
            bereitzustellen und Überprüfungen zu ermöglichen.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Unterauftragsverhältnisse (Subprozessoren)">
        <p>
          Der Verantwortliche stimmt der Einbindung folgender Subprozessoren zu:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Hosting / Anwendungsbetrieb: Vercel Inc. (USA), Server-Region EU;</li>
          <li>Datenbank: Neon (PostgreSQL), EU-Region;</li>
          <li>Datei-/Objektspeicher für Uploads: Vercel Blob;</li>
          <li>E-Mail-Versand: Google (Gmail / Google Workspace);</li>
          <li>Optionaler Dokumenten-Import: Google Drive;</li>
          <li>
            Optionale KI-gestützte Vorqualifizierung von Vorgängen: Google (Gemini API) –
            nur bei Aktivierung durch die Verwaltung;
          </li>
          <li>
            Push-Benachrichtigungen: geräteabhängige Push-Dienste von Google, Apple bzw.
            Mozilla.
          </li>
        </ul>
        <p>
          Für jeden Subprozessor sind Sitz, Verarbeitungsort und – bei Drittlandbezug –
          geeignete Garantien (z. B. EU-Standardvertragsklauseln) sicherzustellen. Der
          EU-Hosting-Nachweis wird gesondert dokumentiert.
        </p>
      </LegalSection>

      <LegalSection title="5. Technisch-organisatorische Maßnahmen (TOM)">
        <p>
          Zugangs-, Zugriffs- und Übertragungskontrolle (verschlüsselte Verbindungen,
          rollenbasierte Berechtigungen, Mandantentrennung je Organisation), Protokollierung
          sicherheitsrelevanter Vorgänge, regelmäßige Datensicherung sowie Maßnahmen zur
          Wiederherstellbarkeit. Die ausführliche TOM-Beschreibung ist Anlage zu diesem
          Vertrag.
        </p>
      </LegalSection>

      <LegalSection title="6. Meldepflichten">
        <p>
          Der Auftragsverarbeiter informiert den Verantwortlichen unverzüglich über
          Verletzungen des Schutzes personenbezogener Daten, die in seinem
          Verantwortungsbereich auftreten, und unterstützt bei den erforderlichen Meldungen
          nach Art. 33/34 DSGVO.
        </p>
      </LegalSection>

      <LegalSection title="7. Haftung und Schlussbestimmungen">
        <p>
          Es gelten die Haftungsregelungen der DSGVO. Im Übrigen gelten die Bestimmungen des
          Hauptvertrags entsprechend. Bei Widersprüchen zwischen AVV und Hauptvertrag in
          Bezug auf den Datenschutz geht dieser AVV vor.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
