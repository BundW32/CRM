// Funktionsseite „Sondereigentum & Mietermanagement". Jede Aussage ist am
// Code geprüft: Mieterzugang mit eigener Navigation (lib/app-nav.ts,
// mieterItems), Mietverhältnis mit Kaltmiete, Kaution, BK-Vorauszahlung und
// Mietvertrags-Datei (prisma: Tenancy), Betriebskostenabrechnung aus der
// WEG-Jahresabrechnung (lib/weg/operating-cost-service.ts, Route
// verwaltung/weg/[propertyId]/betriebskosten) und CO₂-Aufteilung nach
// CO2KostAufG (Route …/co2). Nicht behauptet wird, was das Portal nicht tut:
// Es zieht keine Miete ein und überwacht keine Mieteingänge.
import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import {
  CtaBand,
  FeatureSection,
  MarketingFooter,
  MarketingHeader,
  MarketingHero,
} from "@/components/marketing/site";
import {
  OrbitVisual,
  RolesVisual,
  StatementVisual,
  UnitPlanVisual,
} from "@/components/marketing/visuals";
import { Reveal } from "@/components/marketing/reveal";
import { assertMainDomain } from "@/lib/marketing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sondereigentum & Mietermanagement",
  description:
    "Vermietete Wohnung in der WEG? Mieterzugang, Mietverhältnis mit " +
    "Kaltmiete und Vertrag, Betriebskostenabrechnung aus der " +
    "Jahresabrechnung und CO₂-Aufteilung – inklusive, ohne Aufpreis.",
};

const SEV_FRAGEN = [
  {
    f: "Was heißt Sondereigentumsverwaltung – und was davon deckt das Portal ab?",
    a:
      "Sondereigentumsverwaltung ist die Verwaltung der eigenen, meist " +
      "vermieteten Wohnung – im Unterschied zur Verwaltung des " +
      "Gemeinschaftseigentums. wegportal24 deckt den Alltag des vermietenden " +
      "Eigentümers ab: Mieterzugang, Mietverhältnis mit Kaltmiete, Kaution " +
      "und Vertrag, Betriebskostenabrechnung aus der Jahresabrechnung und " +
      "die CO₂-Aufteilung. Mietzahlungen zieht das Portal nicht ein – Ihr " +
      "Mietkonto bleibt Ihres.",
  },
  {
    f: "Sehen Mieter die Finanzen der Gemeinschaft?",
    a:
      "Nein. Jede Rolle sieht nur das, was sie betrifft: Mieter melden " +
      "Schäden, lesen Aushänge, sehen eigene Dokumente und Zählerstände. " +
      "Rückstandslisten, Buchungen und Abrechnungen der WEG bleiben für sie " +
      "unsichtbar – jede Datei wird nur nach Berechtigungsprüfung " +
      "ausgeliefert.",
  },
  {
    f: "Kostet der Zugang für Mieter extra?",
    a:
      "Nein. Alle Zugänge sind in jedem Tarif inklusive – Eigentümer, " +
      "Beirat und Mieter. Abgerechnet wird je Einheit, nicht je Nutzer; ob " +
      "eine Wohnung selbst bewohnt oder vermietet ist, ändert am Preis " +
      "nichts.",
  },
  {
    f: "Was ist mit Mietern ohne E-Mail-Adresse?",
    a:
      "Für sie erstellt das Portal ein Zugangsschreiben zum Ausdrucken: ein " +
      "Brief mit Benutzername und Erst-Passwort, den Sie in den Briefkasten " +
      "werfen. Beim ersten Anmelden legt der Mieter dann sein eigenes " +
      "Passwort fest.",
  },
];

export default async function SondereigentumPage() {
  await assertMainDomain();

  return (
    <main className="mk-light flex-1">
      <MarketingHeader active="/funktionen/sondereigentum" />

      <MarketingHero
        eyebrow="Sondereigentum & Vermietung"
        title={
          <>
            Vermietet? Ihr Sondereigentum{" "}
            <span className="underline decoration-wp-accent-bright decoration-4 underline-offset-8">
              verwalten Sie gleich mit.
            </span>
          </>
        }
        intro={
          // Bewusst knapp: Bei 375 × 667 muss der Haupt-CTA über der Falz
          // liegen — die längere Fassung schob ihn auf 737 px.
          "In vielen WEGs sind Wohnungen vermietet. Das Portal verwaltet Ihr " +
          "Sondereigentum gleich mit: Mieterzugang, Betriebskostenabrechnung " +
          "aus der Jahresabrechnung, CO₂-Aufteilung – ohne Aufpreis."
        }
        image={{
          src: "/images/marketing/hero-building.jpg",
          alt: "Mehrfamilienhaus mit vermieteten Wohnungen einer Eigentümergemeinschaft",
        }}
        badge={{
          icon: <KeyRound className="h-4 w-4 text-wp-accent-ink" />,
          text: "Mieterzugang inklusive – je Einheit, nicht je Nutzer",
        }}
      />

      <FeatureSection
        id="mieterzugang"
        eyebrow="Mietermanagement"
        title="Ihre Mieter bekommen einen eigenen Zugang"
        visual={<RolesVisual />}
        points={[
          "Schäden mit Foto melden und den Stand bis zur Erledigung verfolgen",
          "Aushänge und eigene Dokumente lesen – auch am Handy",
          "Zählerstände und eigenen Verbrauch einsehen",
          "Nachrichten direkt an die Verwaltung statt Zettel im Flur",
          "Zugang auch ohne E-Mail: Zugangsschreiben mit Erst-Passwort zum Ausdrucken",
        ]}
      >
        <p>
          Mietermanagement beginnt bei der Erreichbarkeit: Statt Anrufen beim
          vermietenden Eigentümer melden Mieter einen Schaden mit Foto direkt
          im Portal, lesen Aushänge und finden ihre Dokumente selbst. Der
          Eigentümer sieht jeden Vorgang mit – und muss nichts mehr
          weiterreichen.
        </p>
        <p>
          Dabei gilt eine harte Grenze: Ein Mieter sieht ausschließlich, was
          ihn betrifft. Die Finanzen der Gemeinschaft – Rückstände, Buchungen,
          Abrechnungen – bleiben für ihn unsichtbar.
        </p>
      </FeatureSection>

      <FeatureSection
        id="mietverhaeltnis"
        eyebrow="Mietverhältnis je Einheit"
        title="Kaltmiete, Kaution, Vertrag – an der Einheit hinterlegt"
        reverse
        visual={<UnitPlanVisual />}
        points={[
          "Mietverhältnis mit Beginn und Ende je Einheit erfassen",
          "Kaltmiete, Kaution und Betriebskosten-Vorauszahlung als Kerndaten",
          "Mietvertrag als Datei direkt am Mietverhältnis abgelegt",
          "Beim Mieterwechsel bleibt das alte Mietverhältnis dokumentiert",
        ]}
      >
        <p>
          Die Eckdaten jedes Mietverhältnisses stehen dort, wo sie
          hingehören: an der Einheit. Kaltmiete, Kaution und die monatliche
          Betriebskosten-Vorauszahlung sind hinterlegt, der Mietvertrag hängt
          als PDF daran – und die Vorauszahlung fließt später automatisch in
          die Betriebskostenabrechnung ein.
        </p>
        <p>
          So hat der vermietende Eigentümer seine Unterlagen nicht in einem
          zweiten Ordner neben der WEG-Software, sondern im selben Portal wie
          die Gemeinschaft.
        </p>
      </FeatureSection>

      <FeatureSection
        id="betriebskosten"
        eyebrow="Betriebskostenabrechnung"
        title="Aus der Jahresabrechnung wird die Abrechnung für Ihren Mieter"
        visual={<StatementVisual />}
        points={[
          "Abgeleitet aus der festgeschriebenen WEG-Jahresabrechnung – keine zweite Buchhaltung",
          "Nur nach Betriebskostenverordnung (BetrKV) umlagefähige Kosten werden weitergegeben",
          "Vorauszahlungen verrechnet: Nachzahlung oder Guthaben je Mieter",
          "Fertig als PDF zum Versenden",
        ]}
      >
        <p>
          Der lästigste Teil der Sondereigentumsverwaltung ist die jährliche
          Betriebskostenabrechnung. Im Portal entsteht sie aus der ohnehin
          vorhandenen WEG-Jahresabrechnung: Die umlagefähigen Kostenanteile
          Ihrer Einheit werden übernommen, nicht umlagefähige – etwa
          Verwaltungskosten und Rücklagenzuführung – bleiben automatisch
          draußen.
        </p>
        <p>
          Der Vermieteranteil an den CO₂-Kosten wird dabei gleich abgezogen,
          die Vorauszahlungen Ihres Mieters werden verrechnet. Heraus kommt
          eine nachvollziehbare Abrechnung als PDF – als Muster, das keine
          Rechtsberatung ersetzt.
        </p>
      </FeatureSection>

      <FeatureSection
        id="co2"
        eyebrow="CO₂-Kostenaufteilung"
        title="CO₂-Kosten fair geteilt – nach dem Stufenmodell des Gesetzes"
        reverse
        visual={<OrbitVisual />}
        points={[
          "Aufteilung zwischen Vermieter und Mieter nach CO2KostAufG",
          "Das Portal rechnet die Stufe aus dem Verbrauch des Gebäudes aus",
          "Der Vermieteranteil wird in der Betriebskostenabrechnung berücksichtigt",
        ]}
      >
        <p>
          Seit 2023 tragen vermietende Eigentümer einen Teil der CO₂-Kosten
          ihrer Mieter – wie viel, hängt vom CO₂-Ausstoß des Gebäudes ab. Das
          Portal nimmt Ihnen die Tabelle aus dem Gesetzestext ab: Es ermittelt
          die Stufe, weist Vermieter- und Mieteranteil aus und zieht den
          Vermieteranteil in der Betriebskostenabrechnung automatisch ab.
        </p>
        <p>
          Zusammen mit{" "}
          <Link
            href="/funktionen/kommunikation#verbrauch"
            className="font-medium text-wp-accent-ink underline underline-offset-2"
          >
            Zählerständen und Verbrauch
          </Link>{" "}
          und der{" "}
          <Link
            href="/funktionen/finanzen#jahresabrechnung"
            className="font-medium text-wp-accent-ink underline underline-offset-2"
          >
            Jahresabrechnung
          </Link>{" "}
          ist damit der ganze Weg von der Heizkostenrechnung bis zur
          Mieter-Abrechnung abgedeckt.
        </p>
      </FeatureSection>

      {/* ── Häufige Fragen zum Sondereigentum ──────────────────────────────
          Native <details> wie auf den übrigen Funktionsseiten – kein
          Client-JS, kein Accordion-Paket. */}
      <section className="mx-auto w-full max-w-3xl px-4 pt-20 sm:px-6 sm:pt-24">
        <Reveal>
          <h2 className="text-balance text-2xl font-bold text-wp-ink sm:text-3xl">
            Häufige Fragen zu Sondereigentum und Mietern
          </h2>
          <p className="mt-3 text-wp-ink/70">
            Was das Mietermanagement kann, wo seine Grenzen liegen – und was
            es kostet. Allgemeine Information, keine Rechtsberatung.
          </p>
        </Reveal>
        <div className="mt-6 space-y-3">
          {SEV_FRAGEN.map((faq, i) => (
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
        title="Gemeinschaft und Sondereigentum – ein Portal"
        text="Richten Sie Ihre WEG kostenlos ein und laden Sie Eigentümer, Beirat und Mieter dazu – alle Zugänge inklusive."
      />
      <MarketingFooter />
    </main>
  );
}
