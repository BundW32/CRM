// Preisseite von wegportal24. Beide Tarife rechnen je Einheit und Monat —
// alle Zugänge sind immer inklusive, es gibt keine Preisspaltung nach
// Nutzern. Die Mengenstaffel macht die einzelne Einheit mit wachsender
// Gemeinschaft günstiger; oberhalb von 12 Einheiten endet der Self-Service
// und ein Hinweis verweist auf den direkten Kontakt zur Verwaltung hinter
// dem Portal (ohne Namensnennung — die Betreiberin steht im Impressum).
//
// Die Beträge und die Staffel kommen aus ./preise-daten (eine Quelle für
// Karten, Rechner und die FAQ der Startseite). Bewusst NICHT auf der Seite:
// Vertragslaufzeiten, Kündigungsfristen und Umsatzsteuer-Darstellung — beides
// ist noch nicht festgelegt und wird nicht erfunden.
import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import {
  BRAND_EMAIL,
  wpButtonClass,
  wpButtonSecondaryClass,
} from "@/components/marketing/brand";
import { CtaBand, MarketingFooter, MarketingHeader } from "@/components/marketing/site";
import { Reveal } from "@/components/marketing/reveal";
import { assertMainDomain } from "@/lib/marketing";
import { PreisRechner } from "./preis-rechner";
import {
  BASIC_JE_EINHEIT_EUR,
  MAX_EINHEITEN,
  PLUS_JE_EINHEIT_EUR,
  RABATT_STAFFEL,
} from "./preise-daten";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Preise – WEG-Selbstverwaltung je Einheit, alle Zugänge inklusive | wegportal24",
  description:
    "Kostenlos starten, dann je Einheit und Monat: Basic 10 €, Verwalter-Plus " +
    "13,90 € mit Ticket-System zu einem zertifizierten Verwalter (§ 26a WEG). " +
    "Alle Zugänge inklusive, Mengenrabatt ab 5 Einheiten.",
};

const euro = (betrag: number) =>
  betrag.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ganz = (betrag: number) =>
  betrag.toLocaleString("de-DE", {
    minimumFractionDigits: betrag % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });

// Drei Stufen. Beide bezahlten Tarife skalieren an derselben Größe — der Zahl
// der Einheiten. Das ist die Größe, die eine WEG ohnehin kennt.
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
    preis: `${ganz(BASIC_JE_EINHEIT_EUR)} €`,
    takt: "je Einheit / Monat",
    beschreibung:
      "Die komplette Selbstverwaltung. Alle Zugänge inklusive – Eigentümer, " +
      "Beirat und Mieter zählen nicht extra.",
    punkte: [
      "Wirtschaftsplan mit Assistent und Beschlussvorlage (§ 28 WEG)",
      "Jahresabrechnung mit Kontenprüfung, § 35a-Ausweis, Vermögensbericht",
      "Hausgeld, Mahnwesen als DIN-A4-Brief, SEPA-Einzug",
      "Buchhaltung mit CSV-Bankimport und Belegen",
      "Versammlung, Abstimmung nach MEA, Beschluss-Sammlung",
      "Dokumente, Aushänge, Schäden mit Foto, Handwerker-Aufträge per Link",
      "Unbegrenzte Zugänge für Eigentümer, Beirat und Mieter",
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
      "Alle Funktionen und Zugänge aus Basic",
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
    f: "Warum wird je Einheit gerechnet – und nicht je Nutzer?",
    a:
      "Weil die Einheit die Größe ist, die Ihre WEG ohnehin kennt: Sie steht " +
      "in der Teilungserklärung und ändert sich nicht. Zugänge sind dagegen " +
      "immer inklusive – laden Sie so viele Eigentümer, Beiräte und Mieter " +
      "ein, wie Ihre Gemeinschaft braucht, ohne dass sich am Preis etwas " +
      "ändert. Handwerker brauchen gar kein Konto: Sie erhalten ihre Aufträge " +
      "über einen sicheren Link.",
  },
  {
    f: "Wie funktioniert der Mengenrabatt?",
    a:
      `Je mehr Einheiten, desto günstiger die einzelne: ab ` +
      `${RABATT_STAFFEL[1].abEinheiten} Einheiten ` +
      `${Math.round(RABATT_STAFFEL[1].rabatt * 100)} % Rabatt je Einheit, ab ` +
      `${RABATT_STAFFEL[0].abEinheiten} Einheiten ` +
      `${Math.round(RABATT_STAFFEL[0].rabatt * 100)} %. Der Rechner oben zeigt ` +
      `den Monatsbetrag für Ihre Gemeinschaft auf einen Blick.`,
  },
  {
    f: `Was ist, wenn wir mehr als ${MAX_EINHEITEN} Einheiten haben?`,
    a:
      "Dann ist Selbstverwaltung meist nicht mehr der richtige Weg – der " +
      "Aufwand wächst schneller als die Gemeinschaft. Schreiben Sie an " +
      `${BRAND_EMAIL}: Die Verwaltung hinter wegportal24 übernimmt größere ` +
      "Gemeinschaften direkt und meldet sich mit einem Angebot.",
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
            Ein Preis je Einheit. Alle Zugänge inklusive.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-wp-ink/75 sm:text-lg">
            Kostenlos starten, ohne Zahlungsdaten. Danach zahlt Ihre
            Gemeinschaft je Einheit und Monat – und je mehr Einheiten es sind,
            desto günstiger wird die einzelne.
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

        {/* ── Mengenstaffel als eine Zeile, dann der Rechner ── */}
        <Reveal>
          <p className="mt-6 text-center text-sm text-wp-ink/65">
            Mengenrabatt in beiden Tarifen: ab {RABATT_STAFFEL[1].abEinheiten}{" "}
            Einheiten {Math.round(RABATT_STAFFEL[1].rabatt * 100)} % günstiger
            je Einheit, ab {RABATT_STAFFEL[0].abEinheiten} Einheiten{" "}
            {Math.round(RABATT_STAFFEL[0].rabatt * 100)} %.
          </p>
        </Reveal>
        <div className="mt-8">
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
