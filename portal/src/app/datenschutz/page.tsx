import Link from "next/link";
import { PublicBrand } from "@/components/public-brand";
import { isWegSaas } from "@/lib/app-mode";

export const dynamic = "force-static";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1">
      <h2 className="font-semibold text-gray-900">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

export default function DatenschutzPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-4">
      <div className={`rounded-2xl border border-white/10 bg-white p-8 shadow-2xl shadow-black/30 ${isWegSaas() ? "wp-brand" : ""}`}>
        <PublicBrand />
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Datenschutzerklärung</h1>
        <p className="mb-6 text-xs text-gray-400">
          Hinweis: Diese Erklärung beschreibt die Datenverarbeitung im Kundenportal. Bitte vor
          dem Produktivbetrieb durch eine/n Datenschutzbeauftragte/n oder Rechtsbeistand prüfen
          lassen.
        </p>

        <div className="space-y-5 text-sm text-gray-700">
          <Section title="1. Verantwortlicher">
            <p>
              B &amp; W Immobilien Management UG (haftungsbeschränkt), Goethestraße 42, 45964
              Gladbeck, vertreten durch die Geschäftsführer Franz-Josef Barth und Alexander Wachtel
              (stv.). Telefon: +49 151 29468127, E-Mail: info@bundwimmobilien.de.
            </p>
          </Section>

          <Section title="2. Zweck und Rechtsgrundlage der Verarbeitung">
            <p>
              Wir verarbeiten personenbezogene Daten, um die Hausverwaltung und die Kommunikation
              zwischen Verwaltung, Eigentümern, Mietern und beauftragten Handwerkern über dieses
              Portal abzuwickeln (z. B. Schadensmeldungen, Dokumente, Aushänge, Abstimmungen,
              Zählerstände, Nachrichten).
            </p>
            <p>
              Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung bzw. vorvertragliche
              Maßnahmen) sowie Art. 6 Abs. 1 lit. c DSGVO (rechtliche Verpflichtungen, z. B. WEG-rechtliche
              Dokumentationspflichten) und ggf. Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an
              einer effizienten Verwaltung).
            </p>
          </Section>

          <Section title="3. Verarbeitete Datenkategorien">
            <p>
              Stammdaten (Name, Anschrift/Objekt-/Einheitszuordnung, E-Mail, Telefon, bevorzugter
              Kontaktweg), Zugangsdaten (Benutzername, verschlüsseltes Passwort), Inhalte (Vorgänge,
              Kommentare, Fotos, Dokumente, Nachrichten, Abstimmungen, Zählerstände) sowie technische
              Daten (Zeitstempel).
            </p>
          </Section>

          <Section title="4. Empfänger / Auftragsverarbeiter">
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
                KI-Funktionen (Assistent, Vorqualifizierung eingehender Meldungen) – optional,
                nur bei Aktivierung durch die Verwaltung: Google (Gemini API); Einzelheiten
                unter{" "}
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
              Einzelne Dienste (u. a. Google) können Daten außerhalb der EU (USA)
              verarbeiten. Soweit dies der Fall ist, erfolgt die Übermittlung auf Grundlage
              geeigneter Garantien (Standardvertragsklauseln bzw. Angemessenheitsbeschluss).
            </p>
          </Section>

          <Section title="5. Speicherdauer">
            <p>
              Daten werden für die Dauer des Verwaltungsverhältnisses und im Rahmen gesetzlicher
              Aufbewahrungsfristen gespeichert und anschließend gelöscht bzw. anonymisiert.
              IP-Adressen in internen Sicherheitsprotokollen werden spätestens nach 90 Tagen
              entfernt.
            </p>
          </Section>

          <Section title="6. Datensicherheit">
            <p>
              Die Übertragung erfolgt verschlüsselt (TLS/HTTPS). Passwörter werden ausschließlich als
              kryptografischer Hash gespeichert. Der Zugriff erfolgt rollenbasiert; jede Datenabfrage
              wird serverseitig auf Berechtigung geprüft. Ruhende Daten werden durch die eingesetzten
              Dienstleister verschlüsselt gespeichert.
            </p>
          </Section>

          <Section title="7. Einsatz von KI-Systemen">
            <p>
              Das Portal enthält zwei optionale KI-Funktionen: einen Assistenten, der Fragen
              aus den für Sie freigegebenen Unterlagen beantwortet, und eine
              Vorqualifizierung eingehender Schadensmeldungen (Vorschlag für Gewerk und
              Dringlichkeit). Beide sind standardmäßig deaktiviert und werden nur aktiv,
              wenn die Verwaltung sie ausdrücklich freischaltet. Ist eine Funktion aktiv,
              werden die jeweils benötigten Textinhalte an die Gemini-API von Google
              übermittelt; eine Verarbeitung außerhalb der EU ist dabei möglich.
            </p>
            <p>
              Die KI trifft <strong>keine automatisierte Entscheidung im Einzelfall</strong>{" "}
              im Sinne von Art. 22 DSGVO: Sie erzeugt Vorschläge und Auskünfte, über die
              Menschen entscheiden. Bei Finanzen, Hausgeld, Mahnwesen, Abrechnungen und
              Abstimmungen kommt keine KI zum Einsatz. Welche Systeme wir mit welcher
              Risikoeinstufung nach der EU-KI-Verordnung betreiben, legen wir unter{" "}
              <Link href="/ki-transparenz" className="text-brand-green hover:underline">
                KI-Transparenz
              </Link>{" "}
              offen.
            </p>
          </Section>

          <Section title="8. Ihre Rechte">
            <p>
              Sie haben das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17),
              Einschränkung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21) sowie
              das Recht auf Beschwerde bei einer Aufsichtsbehörde. Eingeloggte Nutzer können ihre Daten
              im Bereich „Konto“ exportieren. Für Löschanfragen wenden Sie sich an
              info@bundwimmobilien.de.
            </p>
          </Section>
        </div>

        <div className="mt-8 flex gap-4 text-sm">
          <Link href="/login" className="text-brand-green hover:underline">
            ← Zur Anmeldung
          </Link>
          <Link href="/impressum" className="text-brand-green hover:underline">
            Impressum
          </Link>
          <Link href="/ki-transparenz" className="text-brand-green hover:underline">
            KI-Transparenz
          </Link>
        </div>
      </div>
    </main>
  );
}
