// Preisseite von wegportal24. Beide Tarife rechnen je Einheit und Monat —
// alle Zugänge sind immer inklusive, es gibt keine Preisspaltung nach
// Nutzern. Die Mengenstaffel macht die einzelne Einheit mit wachsender
// Gemeinschaft günstiger; oberhalb von 12 Einheiten endet der Self-Service
// und ein Hinweis verweist auf den direkten Kontakt zur Verwaltung hinter
// dem Portal (ohne Namensnennung — die Betreiberin steht im Impressum).
//
// Die Beträge und die Staffel kommen aus ./preise-daten (eine Quelle für
// Karten, Rechner und die FAQ der Startseite). Seit den AGB vom 05.08.2026
// festgelegt und deshalb auf der Seite: Alle Preise sind BRUTTOPREISE
// (Gesamtpreise inkl. Umsatzsteuer, AGB Ziffer 6), es gibt keine
// Mindestlaufzeit, gekündigt wird jederzeit zum Ende des Abrechnungsmonats
// (AGB Ziffer 8). Die Brutto-Transparenz wird aktiv ausgespielt — Wettbewerber
// werben mit Nettopreisen, der Endbetrag ist das ehrliche Vergleichsmaß.
import type { Metadata } from "next";
import { BRAND_EMAIL } from "@/components/marketing/brand";
import { CtaBand, MarketingFooter, MarketingHeader } from "@/components/marketing/site";
import { Reveal } from "@/components/marketing/reveal";
import { assertMainDomain } from "@/lib/marketing";
import { TarifBereich } from "./tarif-bereich";
import {
  BASIC_JE_EINHEIT_EUR,
  MAX_EINHEITEN,
  monatspreis,
  RABATT_STAFFEL,
  rabattFuer,
  VERGLEICH_VERWALTUNG_JE_EINHEIT_EUR,
} from "./preise-daten";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Preise – WEG-Selbstverwaltung je Einheit, alle Zugänge inklusive | wegportal24",
  description:
    "Kostenlos starten, dann je Einheit und Monat: Basic 10 €, Verwalter-Plus " +
    "13,90 € mit Ticket-System zu einem zertifizierten Verwalter (§ 26a WEG). " +
    "Endpreise inkl. MwSt., alle Zugänge inklusive, Mengenrabatt ab 5 Einheiten, " +
    "keine Mindestlaufzeit.",
};

// Rechenbeispiele je WEG-Größe: eine kleine, eine mittlere und eine große
// Gemeinschaft im Self-Service-Bereich — die Größen decken die drei Stufen
// der Mengenstaffel ab (ohne Rabatt, 10 %, 20 %).
const BEISPIEL_GROESSEN = [3, 6, 9] as const;

const euro = (betrag: number) =>
  betrag.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });

const PREIS_FAQ = [
  {
    f: "Sind die Preise brutto oder netto?",
    a:
      "Brutto. 10 € sind bei uns 10 € – die gesetzliche Mehrwertsteuer ist " +
      "bereits enthalten, es kommt kein Aufschlag dazu. Ihre WEG zahlt als " +
      "Verbraucherin genau den Betrag, der auf dieser Seite steht. " +
      "Software-Preise werden anderswo oft netto beworben; vergleichen Sie " +
      "deshalb immer den Endbetrag.",
  },
  {
    f: "Gibt es eine Mindestlaufzeit?",
    a:
      "Nein. Der Vertrag läuft auf unbestimmte Zeit und ist jederzeit zum " +
      "Ende des laufenden Abrechnungsmonats kündbar – formlos, zum Beispiel " +
      "per E-Mail oder über den Kündigen-Link in der Fußzeile. Ihre Daten " +
      "bleiben danach noch mindestens 30 Tage exportierbar.",
  },
  {
    f: "Warum wird je Einheit gerechnet – und nicht je Nutzer?",
    a:
      "Weil die Einheit die Größe ist, die Ihre WEG ohnehin kennt: Sie steht " +
      "in der Teilungserklärung und ändert sich nicht. Zugänge sind dagegen " +
      "immer inklusive – laden Sie so viele Eigentümer, Beiräte und Mieter " +
      "ein, wie Ihre Gemeinschaft braucht, ohne dass sich am Preis etwas " +
      "ändert.",
  },
  {
    f: "Wie funktioniert der Mengenrabatt?",
    a:
      `Je mehr Einheiten, desto günstiger die einzelne: ab ` +
      `${RABATT_STAFFEL[1].abEinheiten} Einheiten ` +
      `${Math.round(RABATT_STAFFEL[1].rabatt * 100)} % Rabatt je Einheit, ab ` +
      `${RABATT_STAFFEL[0].abEinheiten} Einheiten ` +
      `${Math.round(RABATT_STAFFEL[0].rabatt * 100)} %. Der Regler oben zeigt ` +
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
            desto günstiger wird die einzelne.{" "}
            <strong className="font-semibold text-wp-ink">
              Alle Preise sind Endpreise inklusive Mehrwertsteuer
            </strong>{" "}
            – 10 € sind bei uns 10 €.
          </p>
        </Reveal>

        {/* ── Regler und Tarife: eine Einheit, drei Stufen ── */}
        <div className="mt-10">
          <Reveal>
            <TarifBereich />
          </Reveal>
        </div>

        {/* ── Rechenbeispiele: Ersparnis gegenüber einer externen Verwaltung ──
            Drei WEG-Größen, die die drei Stufen der Mengenstaffel abdecken.
            Beide Seiten der Rechnung kommen aus preise-daten — dieselben
            Werte wie in der Beispielrechnung der Startseite. */}
        <div className="mt-16">
          <Reveal>
            <h2 className="text-balance text-2xl font-semibold text-wp-ink sm:text-3xl">
              Was Ihre WEG im Jahr spart – drei Beispielgrößen
            </h2>
            <p className="mt-3 max-w-2xl leading-relaxed text-wp-ink/70">
              Eine externe WEG-Verwaltung kostet marktüblich 25 bis 40 € je
              Einheit und Monat – kleine Gemeinschaften zahlen meist am oberen
              Rand, Sondervergütungen kommen häufig dazu. So rechnet sich die
              Selbstverwaltung mit dem Basic-Tarif, Mengenrabatt bereits
              eingerechnet:
            </p>
          </Reveal>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {BEISPIEL_GROESSEN.map((einheiten, i) => {
              const jahrVerwaltung =
                VERGLEICH_VERWALTUNG_JE_EINHEIT_EUR * einheiten * 12;
              const jahrPortal = monatspreis(BASIC_JE_EINHEIT_EUR, einheiten) * 12;
              const rabatt = rabattFuer(einheiten);
              return (
                <Reveal key={einheiten} delay={i * 90}>
                  <div className="flex h-full flex-col rounded-2xl border border-wp-ink/10 bg-white p-6 shadow-e1">
                    <p className="text-sm font-semibold text-wp-ink/60">
                      WEG mit {einheiten} Einheiten
                    </p>
                    <p className="mt-3 flex items-baseline justify-between gap-3 text-sm text-wp-ink/70">
                      <span>Externe Verwaltung</span>
                      <span className="font-semibold tabular-nums text-wp-ink">
                        {euro(jahrVerwaltung)} / Jahr
                      </span>
                    </p>
                    <p className="mt-2 flex items-baseline justify-between gap-3 text-sm text-wp-ink/70">
                      <span>
                        wegportal24 Basic
                        {rabatt > 0 ? ` (−${Math.round(rabatt * 100)} %)` : ""}
                      </span>
                      <span className="font-semibold tabular-nums text-wp-ink">
                        {euro(jahrPortal)} / Jahr
                      </span>
                    </p>
                    <p className="mt-4 border-t border-wp-ink/10 pt-3 text-sm font-semibold text-wp-accent-ink">
                      Bleibt in der Rücklage
                    </p>
                    <p className="text-2xl font-semibold tabular-nums text-wp-ink">
                      {euro(jahrVerwaltung - jahrPortal)}
                      <span className="text-base font-normal text-wp-ink/60">
                        {" "}
                        im Jahr
                      </span>
                    </p>
                  </div>
                </Reveal>
              );
            })}
          </div>
          <Reveal delay={120}>
            <p className="mt-3 text-xs text-wp-ink/50">
              Beispielrechnung mit {euro(VERGLEICH_VERWALTUNG_JE_EINHEIT_EUR)} je
              Einheit und Monat für die externe Verwaltung – marktübliche
              Vergütungen unterscheiden sich je nach Region und
              Leistungsumfang. Alle wegportal24-Preise inkl. MwSt.
            </p>
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
