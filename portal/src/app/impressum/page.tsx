import Link from "next/link";
import { BwLogo } from "@/components/logo";
import { Wordmark } from "@/components/marketing/wordmark";
import { isWegSaas } from "@/lib/app-mode";

export const dynamic = "force-static";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1">
      <h2 className="font-semibold text-gray-900">{title}</h2>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

export default function ImpressumPage() {
  const weg = isWegSaas();
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-4">
      <div className={`rounded-2xl border border-white/10 bg-white p-8 shadow-2xl shadow-black/30 ${weg ? "wp-brand" : ""}`}>
        {weg ? (
          <div className="mb-6">
            <Wordmark className="text-2xl" />
          </div>
        ) : (
          <BwLogo className="mb-6 h-14 w-auto" />
        )}
        <h1 className="mb-4 text-2xl font-bold text-gray-900">Impressum</h1>

        <div className="space-y-4 text-sm text-gray-700">
          <Section title="Angaben gemäß § 5 TMG">
            <p>
              B &amp; W Immobilien Management UG (haftungsbeschränkt)
              <br />
              Goethestraße 42
              <br />
              45964 Gladbeck
              <br />
              Deutschland
            </p>
          </Section>

          <Section title="Vertreten durch">
            <p>
              Franz-Josef Barth (Geschäftsführer)
              <br />
              Alexander Wachtel (stellvertretender Geschäftsführer)
            </p>
          </Section>

          <Section title="Kontakt">
            <p>
              Telefon: +49 151 29468127
              <br />
              E-Mail:{" "}
              <a href="mailto:info@bundwimmobilien.de" className="text-brand-green hover:underline">
                info@bundwimmobilien.de
              </a>
              <br />
              Web:{" "}
              <a
                href="https://www.bundwimmobilien.de"
                target="_blank"
                rel="noreferrer"
                className="text-brand-green hover:underline"
              >
                www.bundwimmobilien.de
              </a>
            </p>
          </Section>

          <Section title="Registereintrag">
            <p>
              Eingetragen im Handelsregister beim Amtsgericht Gelsenkirchen
              <br />
              Handelsregisternummer: HRB 19149
            </p>
          </Section>

          <Section title="Umsatzsteuer-ID">
            <p>
              Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz: DE456949310
            </p>
          </Section>

          <Section title="Erlaubnis nach § 34c GewO">
            <p>
              Erteilt durch: Ordnungsamt Recklinghausen
              <br />
              Kurt-Schumacher-Allee 1
              <br />
              45657 Recklinghausen
            </p>
          </Section>

          <Section title="Berufshaftpflichtversicherung">
            <p>
              Provinzial
              <br />
              Asselner Hellweg 131
              <br />
              44319 Dortmund
              <br />
              Geltungsraum der Versicherung: Deutschland
            </p>
          </Section>

          <Section title="Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV">
            <p>
              Franz-Josef Barth
              <br />
              Goethestraße 42
              <br />
              45964 Gladbeck
            </p>
          </Section>

          <Section title="Haftung für Inhalte und Ratgeber-Texte">
            <p>
              Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf diesen
              Seiten nach den allgemeinen Gesetzen verantwortlich. Die auf unserer Website
              (insbesondere im Bereich „Ratgeber“) veröffentlichten Inhalte und Artikel wurden mit
              größter Sorgfalt und nach bestem Wissen erstellt. Sie dienen jedoch ausschließlich der
              unverbindlichen Erstinformation der Nutzer. Wir übernehmen ausdrücklich keine Gewähr
              für die Aktualität, Richtigkeit, Vollständigkeit oder juristische Verlässlichkeit der
              bereitgestellten Informationen. Dies gilt insbesondere für Beiträge zu steuerlichen,
              rechtlichen oder fördertechnischen Themen (z. B. WEG-Recht, Mietrecht,
              Gebäudeenergiegesetz). Durch das Lesen, Herunterladen oder sonstige Nutzen der
              Ratgeber-Inhalte kommt kein vertragliches Beratungsverhältnis (Auskunftsvertrag)
              zwischen dem Nutzer und B&amp;W Immobilien Management zustande. Haftungsansprüche, die
              sich auf Schäden materieller oder ideeller Art beziehen, welche durch die Nutzung oder
              Nichtnutzung der dargebotenen Informationen verursacht wurden, sind grundsätzlich
              ausgeschlossen, sofern unsererseits kein nachweislich vorsätzliches oder grob
              fahrlässiges Verschulden vorliegt.
            </p>
          </Section>
        </div>

        <div className="mt-8 flex gap-4 text-sm">
          <Link href="/login" className="text-brand-green hover:underline">
            ← Zur Anmeldung
          </Link>
          <Link href="/datenschutz" className="text-brand-green hover:underline">
            Datenschutzerklärung
          </Link>
        </div>
      </div>
    </main>
  );
}
