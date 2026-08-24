import type { Metadata } from "next";
import { CheckCircle2, Scale } from "lucide-react";
import {
  CtaBand,
  MarketingFooter,
  MarketingHeader,
  MarketingHero,
} from "@/components/marketing/site";
import { Reveal } from "@/components/marketing/reveal";
import { assertMainDomain } from "@/lib/marketing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "WEG-Selbstverwaltung in fünf Schritten",
  description:
    "Von der Registrierung bis zur laufenden WEG-Selbstverwaltung: WEG anlegen, " +
    "Einheiten erfassen, Wirtschaftsplan beschließen, Eigentümer einladen.",
};

const steps = [
  {
    title: "Kostenlos registrieren",
    text:
      "Legen Sie ein Konto als selbstverwaltende WEG an – nur Name, E-Mail und " +
      "Passwort, keine Zahlungsdaten. Direkt danach richten Sie Name und " +
      "Erscheinungsbild Ihrer Gemeinschaft ein.",
  },
  {
    title: "Einheiten und Miteigentumsanteile erfassen",
    text:
      "Übernehmen Sie die Einheiten aus Ihrer Teilungserklärung mit " +
      "Miteigentumsanteilen, Wohnfläche und Personenzahl. Das Portal prüft die " +
      "MEA-Summe automatisch – Tippfehler fallen sofort auf. Zu jeder Einheit " +
      "hinterlegen Sie die Eigentümer, auf Wunsch mit Stichtag bei " +
      "Eigentümerwechsel.",
  },
  {
    title: "Konten und Kostenarten einrichten",
    text:
      "Girokonto und Erhaltungsrücklage mit ihren Anfangsbeständen anlegen, " +
      "Kostenarten aus dem WEG-Standardkatalog übernehmen (inklusive § 35a- und " +
      "Betriebskosten-Kennzeichnung) und die Umlageschlüssel festlegen. Danach " +
      "können Sie sofort buchen oder den ersten Kontoauszug als CSV importieren.",
  },
  {
    title: "Wirtschaftsplan aufstellen und beschließen",
    text:
      "Der Assistent erstellt aus Ihren Kostenarten den Wirtschaftsplan samt " +
      "Einzelwirtschaftsplänen je Einheit und einer Beschlussvorlage für die " +
      "Versammlung. Mit dem Beschluss entstehen automatisch die monatlichen " +
      "Hausgeld-Sollstellungen.",
  },
  {
    title: "Eigentümer und Hausgemeinschaft einladen",
    text:
      "Jeder Miteigentümer erhält einen eigenen Zugang und sieht Abrechnungen, " +
      "Dokumente und Beschlüsse jederzeit selbst ein. Auf Wunsch laden Sie auch " +
      "Beirat und Mieter ein – jeder mit genau passenden Rechten. Mieter " +
      "melden Schäden mit Foto direkt im Portal.",
  },
];

const faqs = [
  {
    q: "Was kostet das Portal?",
    a:
      "Der Start ist kostenlos: Konto anlegen, WEG einrichten und loslegen – " +
      "ohne Zahlungsdaten. Die Konditionen finden Sie transparent in den AGB.",
  },
  {
    q: "Welche Unterlagen brauchen wir für den Start?",
    a:
      "Im Kern drei Dinge: die Teilungserklärung (für Einheiten und " +
      "Miteigentumsanteile), die aktuellen Kontostände von Girokonto und " +
      "Rücklage sowie die laufenden Verträge (Versicherung, Heizung, Pflege) " +
      "als Grundlage für den Wirtschaftsplan.",
  },
  {
    q: "Müssen alle Eigentümer mitmachen?",
    a:
      "Nein. In der Praxis übernimmt eine Person – meist der zum Verwalter " +
      "bestellte Eigentümer – die Pflege im Portal. Alle anderen brauchen nur " +
      "ihren Zugang, um Abrechnungen, Dokumente und Beschlüsse einzusehen.",
  },
  {
    q: "Wir hatten bisher eine Hausverwaltung – wie wechseln wir?",
    a:
      "Lassen Sie sich die Unterlagen übergeben (Kontostände, offene Posten, " +
      "Beschluss-Sammlung, Verträge) und erfassen Sie die Anfangsbestände im " +
      "Portal. Ein Wechsel klappt am saubersten zum Beginn eines " +
      "Wirtschaftsjahres – nötig ist das aber nicht.",
  },
  {
    q: "Sind unsere Daten sicher?",
    a:
      "Jeder Zugang meldet sich mit eigenem Passwort an, und sämtliche Dateien " +
      "werden nur nach Berechtigungsprüfung ausgeliefert – ein Mieter sieht " +
      "also nie die Rückstandsliste oder die Abrechnung der Gemeinschaft. " +
      "Details stehen in der Datenschutzerklärung.",
  },
  {
    q: "Was passiert, wenn wir doch wieder einen Verwalter finden?",
    a:
      "Nichts geht verloren: Buchungen, Abrechnungen und die Beschluss-Sammlung " +
      "bleiben dokumentiert und können einer neuen Verwaltung geordnet übergeben " +
      "werden. Das Portal selbst ist auch für professionelle Verwalter nutzbar.",
  },
];

export default async function SoFunktioniertsPage() {
  await assertMainDomain();

  return (
    <main className="mk-light flex-1">
      <MarketingHeader active="/so-funktionierts" />

      <MarketingHero
        eyebrow="So funktioniert’s"
        title={
          <>
            WEG-Selbstverwaltung –{" "}
            <span className="underline decoration-wp-accent-bright decoration-4 underline-offset-8">in fünf Schritten.</span>
          </>
        }
        intro={
          "Von null zur WEG-Selbstverwaltung: In fünf Schritten steht Ihre " +
          "Eigentümergemeinschaft im Portal – ohne Buchhaltungswissen und ohne " +
          "Software-Schulung. Das Portal führt Ihre Gemeinschaft der Reihe " +
          "nach durch die Einrichtung und prüft an den kritischen Stellen " +
          "automatisch mit."
        }
        image={{
          src: "/images/marketing/so-funktionierts.jpg",
          alt: "Eigentümerin richtet das Portal zuhause am Laptop ein",
        }}
        badge={{ icon: <CheckCircle2 className="h-4 w-4 text-wp-accent-ink" />, text: "In wenigen Minuten eingerichtet" }}
        showSecondaryCta={false}
      />

      {/* ── Schritte im Detail ── */}
      <section className="mx-auto w-full max-w-3xl px-4 pt-10 sm:px-6">
        <ol className="space-y-6">
          {steps.map((step, i) => (
            <Reveal key={step.title}>
              <li className="flex gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-e1">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-wp-accent font-display text-base font-bold text-wp-on-accent">
                  {i + 1}
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{step.title}</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{step.text}</p>
                </div>
              </li>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* ── Rechtlicher Rahmen ── */}
      <section className="mx-auto w-full max-w-3xl px-4 pt-16 sm:px-6">
        <Reveal>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-e1 sm:p-8">
            <div className="flex items-start gap-4">
              <Scale className="mt-1 h-8 w-8 shrink-0 text-wp-accent-ink" />
              <div>
                <h2 className="text-xl font-bold text-wp-ink sm:text-2xl">
                  Der rechtliche Rahmen der Selbstverwaltung
                </h2>
                <div className="mt-3 space-y-3 leading-relaxed text-gray-700">
                  <p>
                    Keine WEG ist gesetzlich verpflichtet, eine externe
                    Hausverwaltung zu beauftragen – eine Eigentümergemeinschaft
                    darf sich selbst verwalten. „WEG ohne Verwalter“ heißt dabei
                    in der Praxis: ohne <em>externen</em> Verwalter. Die
                    Gemeinschaft bestellt stattdessen einen Miteigentümer ins
                    Amt – und genau hier macht das Gesetz kleinen
                    Gemeinschaften den Weg frei:
                  </p>
                  <p>
                    Nach § 19 Abs. 2 Nr. 6 WEG braucht ein zum Verwalter
                    bestellter Wohnungseigentümer <strong className="text-gray-900">keine
                    Zertifizierung nach § 26a WEG</strong>, wenn die Gemeinschaft
                    weniger als neun Sondereigentumsrechte hat – es sei denn, ein
                    Drittel der Eigentümer verlangt einen zertifizierten
                    Verwalter. Die Pflichten aus § 28 WEG (Wirtschaftsplan,
                    Jahresabrechnung, Vermögensbericht) gelten trotzdem – und
                    genau die deckt dieses Portal ab.
                  </p>
                  <p>
                    Für die Bestellung des internen Verwalters erstellt Ihnen
                    das Portal einen <strong className="text-gray-900">Mustervertrag
                    für die eigene Selbstverwaltung</strong> als PDF –
                    vorausgefüllt mit den Daten Ihrer WEG, mit allen Punkten
                    von Laufzeit über Vergütung bis Haftung. Ihre Gemeinschaft
                    füllt ihn aus, passt ihn an und beschließt ihn.
                  </p>
                </div>
                <p className="mt-3 text-xs text-gray-500">
                  Hinweis: allgemeine Information, keine Rechtsberatung.
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── Häufige Fragen ── */}
      <section className="mx-auto w-full max-w-3xl px-4 pt-16 sm:px-6">
        <Reveal>
          <h2 className="text-balance text-2xl font-bold text-wp-ink sm:text-3xl">Häufige Fragen</h2>
        </Reveal>
        <div className="mt-6 space-y-3">
          {faqs.map((faq, i) => (
            <Reveal key={faq.q} delay={i * 60}>
              <details className="group rounded-2xl border border-gray-200 bg-white shadow-e1 open:bg-wp-accent-light/30">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 font-medium text-gray-900 [&::-webkit-details-marker]:hidden">
                  {faq.q}
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
        title="Der erste Schritt dauert zwei Minuten"
        text="Registrieren Sie Ihre WEG kostenlos – alles Weitere erklärt das Portal Schritt für Schritt."
      />
      <MarketingFooter />
    </main>
  );
}
