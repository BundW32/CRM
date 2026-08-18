// Funktionsseite „KI-Berater". Jede Aussage ist am Code geprüft: Der
// Assistent „Frag deine Gemeinschaft" (lib/assistant.ts) antwortet nur aus
// Inhalten, die die Rolle des Fragenden sehen darf, die Vorsortierung
// (lib/triage.ts), der Objekt-Import (lib/objekt-extraction.ts) und der
// Kostenart-Vorschlag (lib/weg/kostenart-ki.ts) schlagen vor, entscheiden
// aber nie. Alle vier Funktionen sind standardmäßig abgeschaltet — die Seite
// sagt das offen, gleiche Linie wie /ki-transparenz (Art. 50 KI-VO).
import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import {
  CtaBand,
  FeatureSection,
  MarketingFooter,
  MarketingHeader,
  MarketingHero,
} from "@/components/marketing/site";
import {
  BankImportVisual,
  OnboardingVisual,
  StatementVisual,
  TicketVisual,
} from "@/components/marketing/visuals";
import { Reveal } from "@/components/marketing/reveal";

// Statisch mit Hintergrund-Aktualisierung (ISR): Marketing-Seite ohne
// Nutzerdaten; nur der Stand der Willkommensaktion (Banner/Platzzähler) kommt
// aus der DB, und fünf Minuten Verzug sind dort verschmerzbar. Die Wächter
// (App-Modus, Mandanten-Subdomain) laufen im Proxy (src/proxy.ts) — eine
// statische Seite kann weder `headers()` noch `cookies()` lesen.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "KI-Berater für die WEG-Verwaltung",
  description:
    "Der KI-Berater beantwortet Fragen aus den Daten Ihrer WEG, sortiert " +
    "Schadensmeldungen vor und liest Objektdaten aus PDFs – optional, " +
    "standardmäßig abgeschaltet, ohne KI bei Geld und Beschlüssen.",
};

const KI_FRAGEN = [
  {
    f: "Rechnet die KI unsere Jahresabrechnung?",
    a:
      "Nein. Wirtschaftsplan, Hausgeld, Mahnwesen und Jahresabrechnung " +
      "arbeiten vollständig regelbasiert – jede Zahl lässt sich bis zur " +
      "einzelnen Buchung zurückverfolgen. Der KI-Berater beantwortet Fragen " +
      "und sortiert vor; rechnen, mahnen und feststellen bleibt Sache der " +
      "nachrechenbaren WEG-Software und Ihrer Gemeinschaft.",
  },
  {
    f: "Müssen wir den KI-Berater nutzen?",
    a:
      "Nein. Alle KI-Funktionen sind standardmäßig abgeschaltet und werden " +
      "erst aktiv, wenn Ihre Gemeinschaft sie ausdrücklich freischalten " +
      "lässt. Bleiben sie aus, verlassen keine Inhalte das Portal in " +
      "Richtung eines KI-Dienstes – und die WEG-Verwaltung im Portal " +
      "funktioniert unverändert.",
  },
  {
    f: "Sieht der KI-Berater Daten, die ich nicht sehen darf?",
    a:
      "Nein. Der Assistent greift ausschließlich auf die Inhalte zu, die " +
      "Ihre Rolle ohnehin einsehen darf – dieselben Rechteprüfungen wie im " +
      "übrigen Portal. Ein Mieter erfährt über den KI-Berater also nichts, " +
      "was er im Portal nicht auch selbst sehen dürfte.",
  },
  {
    f: "Welche Inhalte gehen an den KI-Dienst – und wohin?",
    a:
      "Nur die für die jeweilige Anfrage nötigen Textauszüge; als Modell " +
      "kommt die Gemini-API von Google zum Einsatz. Was je Funktion genau " +
      "übermittelt wird und was ausdrücklich nicht, steht offen auf der " +
      "Seite KI-Transparenz – Pflicht nach Artikel 50 der EU-KI-Verordnung " +
      "und bei uns ohne Kleingedrucktes.",
  },
];

export default async function KiBeraterPage() {
  return (
    <main className="mk-light flex-1">
      <MarketingHeader active="/funktionen/ki-berater" />

      <MarketingHero
        eyebrow="KI-Berater"
        title={
          <>
            Ein KI-Berater, der{" "}
            <span className="underline decoration-wp-accent-bright decoration-4 underline-offset-8">
              Ihre WEG kennt.
            </span>
          </>
        }
        intro={
          "Wer eine WEG-Verwaltung zum ersten Mal übernimmt, hat vor allem " +
          "Fragen. Der KI-Berater beantwortet sie direkt aus den Daten Ihrer " +
          "Gemeinschaft – aus Beschlüssen, Vorgängen und Finanzen statt aus " +
          "dem Internet. Optional, standardmäßig abgeschaltet, und nie " +
          "zuständig für Geld und Beschlüsse."
        }
        image={{
          src: "/images/marketing/so-funktionierts.jpg",
          alt: "Eigentümerin stellt dem KI-Berater am Laptop eine Frage zu ihrer WEG",
        }}
        badge={{
          icon: <Sparkles className="h-4 w-4 text-wp-accent-ink" />,
          text: "Antworten mit Quellenangabe",
        }}
      />

      <FeatureSection
        id="assistent"
        eyebrow="Frag deine Gemeinschaft"
        title="Fragen im Klartext – Antworten aus Ihren eigenen Unterlagen"
        visual={<OnboardingVisual />}
        points={[
          "„Was haben wir zur Dachsanierung beschlossen?“ – gefragt wird in normalem Deutsch",
          "Quellen: Beschlüsse, Versammlungen, Anträge, Vorgänge, Aushänge und Dokumente Ihrer WEG",
          "Bei Geldfragen: Kontostand, Rückstände und Hausgeld – rollengeprüft",
          "Jede Antwort nennt ihre Quellen; findet der Berater nichts, sagt er das",
        ]}
      >
        <p>
          Der KI-Berater ist ein Chatfenster im Portal – für Verwalter und
          Eigentümer. Er beantwortet Fragen ausschließlich aus den Unterlagen,
          die Ihre Rolle ohnehin einsehen darf, und verlinkt zu jeder Antwort
          die verwendeten Quellen. So bleibt jede Auskunft nachprüfbar, statt
          im Ungefähren zu enden.
        </p>
        <p>
          Das unterscheidet ihn von einer Suchmaschine: Gefragt wird nicht
          „Was gilt in deutschen WEGs?“, sondern „Was gilt bei uns?“ – und die
          Antwort kommt aus der Beschluss-Sammlung und den Vorgängen Ihrer
          eigenen Gemeinschaft.
        </p>
      </FeatureSection>

      <FeatureSection
        id="triage"
        eyebrow="Vorsortierung"
        title="Schadensmeldungen kommen vorsortiert an"
        reverse
        visual={<TicketVisual />}
        points={[
          "Gewerk und Dringlichkeit werden vorgeschlagen, der Fall in einem Satz zusammengefasst",
          "Der Vorschlag steht als klar gekennzeichnete Notiz am Vorgang",
          "Hat der Melder selbst ein Gewerk angegeben, hat seine Angabe Vorrang",
          "Die Verwaltung kann jeden Vorschlag jederzeit ändern",
        ]}
      >
        <p>
          Trifft eine Schadensmeldung ein – im Portal oder per E-Mail –,
          schlägt der KI-Berater vor, welches Gewerk zuständig ist und wie
          dringend der Fall wirkt. Wer abends zehn Meldungen durchsieht,
          erkennt so auf einen Blick, was bis morgen warten kann und was
          nicht.
        </p>
        <p>
          Entschieden wird trotzdem von Menschen: Der Vorschlag ist eine
          Notiz am Vorgang, keine Weichenstellung. Kein Handwerker wird
          automatisch beauftragt, keine Meldung automatisch geschlossen.
        </p>
      </FeatureSection>

      <FeatureSection
        id="import"
        eyebrow="Tipparbeit sparen"
        title="Objektdaten aus dem PDF, Kostenarten aus dem Kontoauszug"
        visual={<BankImportVisual />}
        points={[
          "Objekt-Import: Adresse, Baujahr, Wohnfläche und Einheitenliste aus einem PDF vorausgefüllt",
          "Gespeichert wird erst, wenn Sie die Felder geprüft und abgeschickt haben",
          "Bankimport: Kostenart-Vorschlag nur für Ausgaben, zu denen es keine frühere Buchung gibt",
          "Übermittelt wird dafür nur der von Zahlen und Kontonummern bereinigte Verwendungszweck",
        ]}
      >
        <p>
          Beim Anlegen eines Objekts liest der KI-Berater auf Wunsch ein
          Objektdatenblatt oder Exposé und füllt das Formular vor – aus einer
          Stunde Abtippen werden fünf Minuten Prüfen. Beim CSV-Bankimport
          schlägt zunächst die Erfahrung vor: Wer schon einmal bezahlt wurde,
          bekommt wieder dieselbe Kostenart. Nur wo es keine solche Erfahrung
          gibt, wird – falls freigeschaltet – die KI gefragt.
        </p>
        <p>
          Ihr Vorschlag trägt dann immer den Gütegrad „unsicher“ und wird nur
          gebucht, wenn die Verwaltung ihn ausdrücklich bestätigt. Welcher
          Eigentümer eine Zahlung geleistet hat, entscheidet nie die KI.
        </p>
      </FeatureSection>

      <FeatureSection
        id="grenzen"
        eyebrow="Klare Grenzen"
        title="Wo der KI-Berater nichts zu suchen hat"
        reverse
        visual={<StatementVisual />}
        points={[
          "Keine KI bei Wirtschaftsplan, Jahresabrechnung und Vermögensbericht",
          "Keine KI bei Zahlungszuordnung, Mahnwesen und Mahnstufen",
          "Keine KI bei Abstimmungen, Stimmgewichten und Beschlüssen",
          "Standardmäßig abgeschaltet – ohne Freischaltung verlässt kein Inhalt das Portal",
        ]}
      >
        <p>
          Eine WEG-Verwaltung braucht Zahlen, die vor der Versammlung und
          notfalls vor Gericht Bestand haben. Deshalb bleibt alles, was Geld
          und Recht betrifft, in diesem Portal regelbasiert und nachrechenbar
          – der KI-Berater schlägt vor und erklärt, aber er bucht nicht,
          mahnt nicht und stellt keine Beschlüsse fest.
        </p>
        <p>
          Welche Daten die vier KI-Funktionen im Einzelnen verarbeiten, legt
          die Seite{" "}
          <Link
            href="/ki-transparenz"
            className="font-medium text-wp-accent-ink underline underline-offset-2"
          >
            KI-Transparenz
          </Link>{" "}
          offen – nach Artikel 50 der EU-KI-Verordnung.
        </p>
      </FeatureSection>

      {/* ── Häufige Fragen zum KI-Berater ──────────────────────────────────
          Native <details> wie auf den übrigen Funktionsseiten – kein
          Client-JS, kein Accordion-Paket. */}
      <section className="mx-auto w-full max-w-3xl px-4 pt-20 sm:px-6 sm:pt-24">
        <Reveal>
          <h2 className="text-balance text-2xl font-bold text-wp-ink sm:text-3xl">
            Häufige Fragen zum KI-Berater
          </h2>
          <p className="mt-3 text-wp-ink/70">
            Was die KI in der WEG-Verwaltung darf, was nicht – und wer es
            entscheidet. Allgemeine Information, keine Rechtsberatung.
          </p>
        </Reveal>
        <div className="mt-6 space-y-3">
          {KI_FRAGEN.map((faq, i) => (
            <Reveal key={faq.f} delay={i * 60}>
              <details className="group rounded-2xl border border-gray-200 bg-white shadow-e1 open:bg-wp-accent-light/30">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 font-medium text-gray-900 [&::-webkit-details-marker]:hidden">
                  {faq.f}
                  <span className="text-wp-accent-ink transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="px-5 pb-4 text-sm leading-relaxed text-gray-600">{faq.a}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </section>

      <CtaBand
        title="Erst die Software, dann die KI"
        text="Richten Sie Ihre WEG kostenlos ein – ob der KI-Berater dazukommt, entscheidet Ihre Gemeinschaft später selbst."
      />
      <MarketingFooter />
    </main>
  );
}
