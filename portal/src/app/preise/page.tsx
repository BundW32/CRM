// Preisseite von wegportal24. Drei bescheidene Stufen, jede skaliert
// nachvollziehbar: Der Einstieg ist kostenlos, Basic rechnet je Nutzer,
// Verwalter-Plus je Einheit — inklusive Ticket-Weg zu einem zertifizierten
// Verwalter (§ 26a WEG) für die Fragen, bei denen die Gemeinschaft
// professionellen Rat will, ohne das Amt aus der Hand zu geben.
//
// Die Beträge kommen aus ./preise-daten (eine Quelle für Karten, Rechner und
// die FAQ der Startseite). Bewusst NICHT auf der Seite: Vertragslaufzeiten,
// Kündigungsfristen und Umsatzsteuer-Darstellung — beides ist noch nicht
// festgelegt und wird nicht erfunden.
import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { wpButtonClass, wpButtonSecondaryClass } from "@/components/marketing/brand";
import { CtaBand, MarketingFooter, MarketingHeader } from "@/components/marketing/site";
import { Reveal } from "@/components/marketing/reveal";
import { assertMainDomain } from "@/lib/marketing";
import { PreisRechner } from "./preis-rechner";
import { BASIC_JE_NUTZER_EUR, PLUS_JE_EINHEIT_EUR } from "./preise-daten";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Preise – WEG-Selbstverwaltung ab 10 € | wegportal24",
  description:
    "Kostenlos starten, dann fair skaliert: Basic für 10 € je Nutzer/Monat oder " +
    "Verwalter-Plus für 13,90 € je Einheit/Monat – mit Ticket-System zu einem " +
    "zertifizierten Verwalter (§ 26a WEG).",
};

const euro = (betrag: number) =>
  betrag.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Drei Stufen. `takt` ist die Größe, nach der der Tarif skaliert — genau eine
// je Tarif, damit die Rechnung auf einen Blick nachvollziehbar bleibt.
const TARIFE = [
  {
    name: "Start",
    preis: "0 €",
    takt: "zum Kennenlernen",
    beschreibung:
      "Richten Sie Ihre WEG vollständig ein und sehen Sie sich alles an – " +
      "ohne Zahlungsdaten, ohne Frist im Nacken.",
    punkte: [
      "WEG anlegen: Einheiten, Miteigentumsanteile, Konten",
      "Kostenarten aus dem WEG-Standardkatalog",
      "Miteigentümer einladen und Rollen vergeben",
      "Alle Funktionen ansehen und ausprobieren",
    ],
    cta: { text: "Kostenlos starten", href: "/registrieren", primaer: false },
  },
  {
    name: "Basic",
    preis: `${BASIC_JE_NUTZER_EUR} €`,
    takt: "je Nutzer / Monat",
    beschreibung:
      "Die komplette Selbstverwaltung. Sie zahlen nur für Menschen, die " +
      "wirklich einen Zugang haben – nicht für Wohnungen.",
    punkte: [
      "Wirtschaftsplan mit Assistent und Beschlussvorlage (§ 28 WEG)",
      "Jahresabrechnung mit Kontenprüfung, § 35a-Ausweis, Vermögensbericht",
      "Hausgeld, Mahnwesen als DIN-A4-Brief, SEPA-Einzug",
      "Buchhaltung mit CSV-Bankimport und Belegen",
      "Versammlung, Abstimmung nach MEA, Beschluss-Sammlung",
      "Dokumente, Aushänge, Schäden mit Foto, Handwerker",
    ],
    cta: { text: "Mit Basic starten", href: "/registrieren", primaer: true },
  },
  {
    name: "Verwalter-Plus",
    preis: `${euro(PLUS_JE_EINHEIT_EUR)} €`,
    takt: "je Einheit / Monat",
    beschreibung:
      "Alles aus Basic – plus ein direkter Draht zu einem zertifizierten " +
      "Verwalter (§ 26a WEG), wenn Ihre Gemeinschaft fachlichen Rat braucht.",
    punkte: [
      "Alle Funktionen aus Basic, unbegrenzte Nutzer",
      "Ticket-System für Anfragen an einen zertifizierten Verwalter",
      "Antworten von echten Verwaltungs-Profis, dokumentiert im Portal",
      "Für die Fälle, in denen die Gemeinschaft Rückendeckung will – " +
        "Abrechnungsfragen, Beschlussformulierungen, schwierige Einzelfälle",
    ],
    cta: { text: "Mit Verwalter-Plus starten", href: "/registrieren", primaer: false },
  },
];

const PREIS_FAQ = [
  {
    f: "Warum rechnet Basic nach Nutzern, Verwalter-Plus nach Einheiten?",
    a:
      "Basic kostet nur, wer das Portal wirklich benutzt – eine kleine " +
      "Gemeinschaft, in der zwei Personen alles erledigen, zahlt genau zwei " +
      "Zugänge. Verwalter-Plus enthält die Arbeit eines zertifizierten " +
      "Verwalters, und dieser Aufwand hängt an der Zahl der Einheiten – " +
      "deshalb der Einheiten-Takt mit unbegrenzten Zugängen.",
  },
  {
    f: "Was ist der zertifizierte Verwalter in Verwalter-Plus?",
    a:
      "Ein Verwalter mit Zertifizierung nach § 26a WEG. Über das Ticket-System " +
      "stellen Sie ihm Fragen aus Ihrer Verwaltungspraxis – etwa zu einer " +
      "Abrechnungsposition, einer Beschlussformulierung oder einem " +
      "schwierigen Einzelfall. Die Antworten bleiben im Portal dokumentiert. " +
      "Das Amt und die Entscheidungen bleiben bei Ihrer Gemeinschaft.",
  },
  {
    f: "Können wir jederzeit zwischen den Stufen wechseln?",
    a:
      "Ja. Ihre Daten bleiben beim Wechsel vollständig erhalten – es ändert " +
      "sich nur, was Ihnen berechnet wird und ob der Verwalter-Draht offen ist.",
  },
  {
    f: "Was passiert mit unseren Daten, wenn wir kündigen?",
    a:
      "Sie gehören Ihrer Gemeinschaft. Journal und Kontoblatt lassen sich als " +
      "CSV exportieren, Beschluss-Sammlung und Abrechnungen bleiben bis zum " +
      "Schluss einsehbar – kein Lock-in.",
  },
];

export default async function PreisePage() {
  await assertMainDomain();

  return (
    <main className="mk-light flex-1">
      <MarketingHeader active="/preise" />

      <section id="inhalt" className="mx-auto w-full max-w-6xl px-4 pt-14 sm:px-6 sm:pt-20">
        <Reveal>
          <h1 className="text-balance text-3xl font-semibold text-wp-ink sm:text-5xl">
            Kostenlos starten. Fair skalieren.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-wp-ink/75 sm:text-lg">
            Keine Einrichtungsgebühr, keine Zahlungsdaten zum Start. Danach
            wächst der Preis mit Ihrer Gemeinschaft – nachvollziehbar an genau
            einer Größe je Tarif.
          </p>
        </Reveal>

        {/* ── Die drei Stufen ── */}
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {TARIFE.map((tarif, i) => (
            <Reveal key={tarif.name} delay={i * 90}>
              <div
                className={`flex h-full flex-col rounded-2xl border bg-white p-6 sm:p-7 ${
                  tarif.cta.primaer
                    ? "border-wp-accent shadow-e2"
                    : "border-wp-ink/10 shadow-e1"
                }`}
              >
                <h2 className="text-lg font-semibold text-wp-ink">{tarif.name}</h2>
                <p className="mt-3">
                  <span className="text-4xl font-semibold tabular-nums text-wp-ink">
                    {tarif.preis}
                  </span>
                  <span className="ml-2 text-sm font-medium text-wp-ink/60">{tarif.takt}</span>
                </p>
                <p className="mt-3 text-sm leading-relaxed text-wp-ink/70">
                  {tarif.beschreibung}
                </p>
                <ul className="mt-5 flex-1 space-y-2.5">
                  {tarif.punkte.map((punkt) => (
                    <li key={punkt} className="flex items-start gap-2.5 text-sm text-wp-ink/80">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-wp-accent-ink" />
                      {punkt}
                    </li>
                  ))}
                </ul>
                <Link
                  href={tarif.cta.href}
                  className={`${
                    tarif.cta.primaer ? wpButtonClass : wpButtonSecondaryClass
                  } mt-6 w-full py-3`}
                >
                  {tarif.cta.text}
                </Link>
              </div>
            </Reveal>
          ))}
        </div>

        {/* ── Der Rechner: Skalierung anfassbar machen ── */}
        <div className="mt-10">
          <Reveal>
            <PreisRechner />
          </Reveal>
        </div>

        {/* ── Fragen zu den Preisen ── */}
        <div className="mx-auto mt-16 max-w-3xl">
          <Reveal>
            <h2 className="text-center text-2xl font-semibold text-wp-ink sm:text-3xl">
              Fragen zu den Preisen
            </h2>
          </Reveal>
          <div className="mt-6">
            {PREIS_FAQ.map(({ f, a }, i) => (
              <Reveal key={f} delay={Math.min(i * 60, 180)}>
                <details className="group border-t border-wp-ink/15 last:border-b">
                  <summary className="flex cursor-pointer list-none items-baseline gap-3 py-4 text-left font-semibold text-wp-ink transition-colors hover:text-wp-accent-ink [&::-webkit-details-marker]:hidden">
                    <span className="text-wp-accent-ink transition-transform group-open:rotate-45">
                      +
                    </span>
                    {f}
                  </summary>
                  <p className="max-w-[62ch] pb-5 pl-6 text-[15px] leading-relaxed text-wp-ink/75">
                    {a}
                  </p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <CtaBand
        title="Erst einrichten, dann entscheiden"
        text="Legen Sie Ihre WEG kostenlos an – für den Start brauchen Sie keine Zahlungsdaten und keinen Tarif."
      />
      <MarketingFooter />
    </main>
  );
}
