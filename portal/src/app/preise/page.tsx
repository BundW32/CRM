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
import { BRAND_EMAIL } from "@/components/marketing/brand";
import { CtaBand, MarketingFooter, MarketingHeader } from "@/components/marketing/site";
import { Reveal } from "@/components/marketing/reveal";
import { assertMainDomain } from "@/lib/marketing";
import { TarifBereich } from "./tarif-bereich";
import { MAX_EINHEITEN, RABATT_STAFFEL } from "./preise-daten";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Preise – WEG-Selbstverwaltung je Einheit, alle Zugänge inklusive | wegportal24",
  description:
    "Kostenlos starten, dann je Einheit und Monat: Basic 10 €, Verwalter-Plus " +
    "13,90 € mit Ticket-System zu einem zertifizierten Verwalter (§ 26a WEG). " +
    "Alle Zugänge inklusive, Mengenrabatt ab 5 Einheiten.",
};

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
            desto günstiger wird die einzelne.
          </p>
        </Reveal>

        {/* ── Regler und Tarife: eine Einheit, drei Stufen ── */}
        <div className="mt-10">
          <Reveal>
            <TarifBereich />
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
