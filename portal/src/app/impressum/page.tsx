import type { Metadata } from "next";
import Link from "next/link";
import { PublicBrand } from "@/components/public-brand";
import { isWegSaas, productName } from "@/lib/app-mode";

export const dynamic = "force-static";

// Ohne eigenen Titel fiel diese Seite auf den Rückfall aus `layout.tsx`
// zurück — genau wie sieben weitere. Die Marke hängt am `title.template`
// dort; hier steht nur, was die Seite ist.
export function generateMetadata(): Metadata {
  return {
    title: "Impressum und Anbieterkennzeichnung",
    description:
      `Anbieterkennzeichnung nach § 5 DDG: Betreiberin, Vertretung, Anschrift, ` +
      `Kontakt und Registereintrag des Portals ${productName()}.`,
  };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1">
      <h2 className="font-semibold text-gray-900">{title}</h2>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

// Die Fundstellen sind die aktuellen: Das Telemediengesetz wurde im Mai 2024
// vom **Digitale-Dienste-Gesetz** abgelöst (§ 5 TMG → § 5 DDG, § 7 TMG →
// § 7 DDG), der Rundfunkstaatsvertrag im November 2020 vom
// **Medienstaatsvertrag** (§ 55 Abs. 2 RStV → § 18 Abs. 2 MStV). Hier standen
// bis zum 04.08.2026 die aufgehobenen Normen — inhaltlich richtig, aber unter
// falscher Überschrift, und ein Impressum lebt von der richtigen Fundstelle.
export default function ImpressumPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-4">
      <div className={`rounded-2xl border border-white/10 bg-white p-8 shadow-2xl shadow-black/30 ${isWegSaas() ? "wp-brand" : ""}`}>
        <PublicBrand />
        {/* H1 in Titellänge: Ein-Wort-Überschriften melden SEO-Prüfungen als
            „H1 zu kurz" — und der Titel der Seite heißt ohnehin so. */}
        <h1 className="mb-4 text-2xl font-bold text-gray-900">
          Impressum und Anbieterkennzeichnung
        </h1>

        <p className="mb-6 text-sm text-gray-700">
          Dieses Impressum ist die Anbieterkennzeichnung nach § 5 DDG: Wer
          diese Website und das Portal betreibt, wer die Betreiberin vertritt
          und auf welchen Wegen Sie uns erreichen. Es gilt für alle Seiten
          dieses Auftritts einschließlich des Bereichs hinter der Anmeldung.
          Weitere rechtliche Hinweise zur Nutzung finden Sie in den verlinkten
          Seiten am Ende.
        </p>

        <div className="space-y-4 text-sm text-gray-700">
          <Section title="Angaben gemäß § 5 DDG">
            {/* Nur in der WEG-SaaS: dort tritt dieselbe UG unter der Marke
                wegportal24 auf und muss sich als Betreiberin zu erkennen
                geben. Auf portal.bundwimmobilien.de wäre der Satz sinnlos. */}
            {isWegSaas() ? (
              <p className="mb-2 text-gray-600">
                Dieses Impressum gilt für die Website und das Portal{" "}
                <strong>wegportal24</strong>. Betreiberin ist:
              </p>
            ) : null}
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

          <Section title="Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV">
            <p>
              Franz-Josef Barth
              <br />
              Goethestraße 42
              <br />
              45964 Gladbeck
            </p>
          </Section>

          {/* Nur in der WEG-SaaS-Tür: Auf portal.bundwimmobilien.de gehört
              die andere Marke nicht auf die Seite (zwei Türen, zwei Marken). */}
          {isWegSaas() ? (
            <Section title="Über die Betreiberin">
              <p>
                Die B&amp;W Immobilien Management UG (haftungsbeschränkt) ist
                eine Immobilien- und Hausverwaltung mit Sitz in Gladbeck. Sie
                betreibt das Portal wegportal24 für selbstverwaltete
                Wohnungseigentümergemeinschaften; aus ihrer Verwaltungspraxis
                stammt auch der Ticket-Weg zu einem zertifizierten Verwalter
                nach § 26a WEG im Verwalter-Plus-Tarif.
              </p>
            </Section>
          ) : null}

          <Section title="Haftung für Links">
            <p>
              Unser Angebot enthält einzelne Links zu externen Websites
              Dritter, auf deren Inhalte wir keinen Einfluss haben. Deshalb
              können wir für diese fremden Inhalte auch keine Gewähr
              übernehmen; verantwortlich ist stets der jeweilige Anbieter oder
              Betreiber der verlinkten Seiten. Die verlinkten Seiten wurden
              zum Zeitpunkt der Verlinkung auf mögliche Rechtsverstöße
              überprüft; rechtswidrige Inhalte waren dabei nicht erkennbar.
              Werden uns Rechtsverletzungen bekannt, entfernen wir derartige
              Links umgehend.
            </p>
          </Section>

          <Section title="Haftung für Inhalte und Ratgeber-Texte">
            <p>
              Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG für eigene Inhalte auf diesen
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
          <Section title="Urheberrecht">
            <p>
              Die durch die Betreiberin erstellten Inhalte und Werke auf
              diesen Seiten unterliegen dem deutschen Urheberrecht.
              Vervielfältigung, Bearbeitung, Verbreitung und jede Art der
              Verwertung außerhalb der Grenzen des Urheberrechts bedürfen der
              schriftlichen Zustimmung der Betreiberin. Downloads und Kopien
              dieser Seiten sind nur für den privaten, nicht kommerziellen
              Gebrauch gestattet. Das gilt insbesondere für Texte, Grafiken
              und die Gestaltung der Seiten. Soweit Inhalte nicht von der
              Betreiberin erstellt wurden, werden die Urheberrechte Dritter
              beachtet und entsprechend gekennzeichnet.
            </p>
          </Section>

          <p className="text-xs text-gray-500">Stand: 17. August 2026</p>
        </div>

        <div className="mt-8 flex flex-wrap gap-4 text-sm">
          <Link href="/login" className="text-brand-green hover:underline">
            ← Zur Anmeldung
          </Link>
          <Link href="/datenschutz" className="text-brand-green hover:underline">
            Datenschutzerklärung
          </Link>
          <Link href="/agb" className="text-brand-green hover:underline">
            AGB
          </Link>
          <Link href="/avv" className="text-brand-green hover:underline">
            AVV
          </Link>
          <Link href="/ki-transparenz" className="text-brand-green hover:underline">
            KI-Transparenz
          </Link>
          {isWegSaas() ? (
            <>
              <Link href="/widerruf" className="text-brand-green hover:underline">
                Widerrufsbelehrung
              </Link>
              {/* § 312k Abs. 2 BGB — die Beschriftung gibt das Gesetz vor. */}
              <Link href="/kuendigen" className="text-brand-green hover:underline">
                Verträge hier kündigen
              </Link>
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}
