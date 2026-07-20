import type { Metadata } from "next";
import { Scale } from "lucide-react";
import {
  CtaBand,
  MarketingFooter,
  MarketingHeader,
  MarketingHero,
} from "@/components/marketing/site";
import { Reveal } from "@/components/marketing/reveal";
import { OnboardingVisual } from "@/components/marketing/visuals";
import { assertMainDomain } from "@/lib/marketing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "So funktioniert die WEG-Selbstverwaltung mit dem Portal",
  description:
    "Schritt für Schritt von der Registrierung zur laufenden Selbstverwaltung: " +
    "WEG anlegen, Konten und Einheiten erfassen, Wirtschaftsplan beschließen, " +
    "Eigentümer einladen – plus rechtlicher Rahmen und häufige Fragen.",
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
      "Beirat, Mieter und Handwerker ein – jeder mit genau passenden Rechten.",
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
      "Jeder Nutzer meldet sich mit eigenem Passwort an, und sämtliche Dateien " +
      "werden nur nach Berechtigungsprüfung ausgeliefert – ein Handwerker sieht " +
      "also nie die Abrechnung, ein Mieter nie die Rückstandsliste. Details " +
      "stehen in der Datenschutzerklärung.",
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
    <main className="flex-1">
      <MarketingHeader active="/so-funktionierts" />

      <MarketingHero
        eyebrow="So funktioniert’s"
        title={
          <>
            Von null auf verwaltet –{" "}
            <span className="text-brand-orange">in fünf Schritten.</span>
          </>
        }
        intro={
          "Sie brauchen kein Buchhaltungswissen und keine Software-Schulung. " +
          "Das Portal führt Ihre WEG der Reihe nach durch die Einrichtung – " +
          "und prüft an den kritischen Stellen automatisch mit."
        }
        visual={<OnboardingVisual />}
        showSecondaryCta={false}
      />

      {/* ── Schritte im Detail ── */}
      <section className="mx-auto w-full max-w-3xl px-4 pt-10 sm:px-6">
        <ol className="space-y-6">
          {steps.map((step, i) => (
            <Reveal key={step.title}>
              <li className="flex gap-4 rounded-2xl border border-white/10 bg-white/5 p-6">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-orange font-display text-base font-bold text-brand-green-dark">
                  {i + 1}
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-white">{step.title}</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-gray-300">{step.text}</p>
                </div>
              </li>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* ── Rechtlicher Rahmen ── */}
      <section className="mx-auto w-full max-w-3xl px-4 pt-16 sm:px-6">
        <Reveal>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <Scale className="mt-1 h-8 w-8 shrink-0 text-brand-orange" />
              <div>
                <h2 className="text-xl font-bold text-white sm:text-2xl">
                  Der rechtliche Rahmen der Selbstverwaltung
                </h2>
                <div className="mt-3 space-y-3 leading-relaxed text-gray-300">
                  <p>
                    Keine WEG ist gesetzlich verpflichtet, eine externe
                    Hausverwaltung zu beauftragen. Die Gemeinschaft kann einen
                    Miteigentümer zum Verwalter bestellen – und genau hier macht
                    das Gesetz kleinen Gemeinschaften den Weg frei:
                  </p>
                  <p>
                    Nach § 19 Abs. 2 Nr. 6 WEG braucht ein zum Verwalter
                    bestellter Wohnungseigentümer <strong className="text-white">keine
                    Zertifizierung nach § 26a WEG</strong>, wenn die Gemeinschaft
                    weniger als neun Sondereigentumsrechte hat – es sei denn, ein
                    Drittel der Eigentümer verlangt einen zertifizierten
                    Verwalter. Die Pflichten aus § 28 WEG (Wirtschaftsplan,
                    Jahresabrechnung, Vermögensbericht) gelten trotzdem – und
                    genau die deckt dieses Portal ab.
                  </p>
                </div>
                <p className="mt-3 text-xs text-gray-400">
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
          <h2 className="text-balance text-2xl font-bold text-white sm:text-3xl">Häufige Fragen</h2>
        </Reveal>
        <div className="mt-6 space-y-3">
          {faqs.map((faq, i) => (
            <Reveal key={faq.q} delay={i * 60}>
              <details className="group rounded-2xl border border-white/10 bg-white/5 open:bg-white/10">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 font-medium text-white [&::-webkit-details-marker]:hidden">
                  {faq.q}
                  <span className="text-brand-orange transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="px-5 pb-4 text-sm leading-relaxed text-gray-300">{faq.a}</p>
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
