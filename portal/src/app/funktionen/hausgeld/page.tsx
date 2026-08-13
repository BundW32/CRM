import type { Metadata } from "next";
import { HandCoins } from "lucide-react";
import {
  CtaBand,
  FeatureSection,
  MarketingFooter,
  MarketingHeader,
  MarketingHero,
} from "@/components/marketing/site";
import {
  ArrearsVisual,
  BankImportVisual,
  DunningVisual,
  UnitPlanVisual,
} from "@/components/marketing/visuals";
import { isSepaLastschriftEnabled } from "@/lib/features";
import { assertMainDomain } from "@/lib/marketing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Hausgeld & Mahnwesen für kleine WEGs",
  description:
    "Sollstellungen aus dem Wirtschaftsplan, Rückstände je Einheit, Zahlungen " +
    "zugeordnet, Mahnungen als fertiger Brief – Hausgeld ohne Zettelwirtschaft.",
};

export default async function HausgeldPage() {
  await assertMainDomain();

  return (
    <main className="mk-light flex-1">
      <MarketingHeader active="/funktionen/hausgeld" />

      <MarketingHero
        eyebrow="Hausgeld & offene Posten"
        title={
          <>
            Hausgeld im Griff –{" "}
            <span className="underline decoration-wp-accent-bright decoration-4 underline-offset-8">ohne Zettelwirtschaft, ohne Streit.</span>
          </>
        }
        intro={
          "Wer zahlt wie viel, wer ist im Rückstand, und wie mahnt man den " +
          "Nachbarn, ohne Streit im Haus? Das Portal hält das Hausgeld ohne " +
          "Zettelwirtschaft im Griff: Soll, Ist und Saldo stehen je Einheit " +
          "fest, und das Mahnwesen läuft fair und formal korrekt ab."
        }
        image={{
          src: "/images/marketing/hausgeld.jpg",
          alt: "Kontoauszug und Umschlag am Briefkasten einer WEG",
        }}
        badge={{ icon: <HandCoins className="h-4 w-4 text-wp-accent-ink" />, text: "Soll / Ist / Saldo je Einheit" }}
      />

      <FeatureSection
        id="sollstellungen"
        eyebrow="Automatische Sollstellungen"
        title="Jede Einheit weiß, was sie zahlt"
        visual={<UnitPlanVisual />}
        points={[
          "Monatliche Sollstellungen entstehen automatisch aus dem beschlossenen Wirtschaftsplan",
          "Centgenaue Verteilung nach den Umlageschlüsseln Ihrer Teilungserklärung",
          "Änderungen (z. B. Eigentümerwechsel) werden tagesgenau berücksichtigt",
        ]}
      >
        <p>
          Sobald die Versammlung den Wirtschaftsplan beschlossen hat, legt das
          Portal für jede Einheit automatisch zwölf monatliche Zahlungspflichten
          an. Es gibt keine Nebenrechnung in Excel und keine Diskussion, wie der
          Betrag zustande kommt: Jeder Eigentümer sieht in seinem
          Einzelwirtschaftsplan genau, welche Kostenart mit welchem Schlüssel
          auf ihn umgelegt wird.
        </p>
      </FeatureSection>

      <FeatureSection
        id="offene-posten"
        eyebrow="Offene Posten"
        title="Rückstände auf einen Blick – Zahlungen in Sekunden zugeordnet"
        reverse
        visual={<ArrearsVisual />}
        points={[
          "Rückstandsliste je Einheit mit Soll, Ist und Saldo",
          "Zahlungseingänge aus dem Bankimport den Einheiten zuordnen",
          "Automatischer Vorschlag aus dem Verwendungszweck der Überweisung",
        ]}
      >
        <p>
          Jeder Zahlungseingang aus dem Bankimport landet in einer
          Zuordnungsliste. Das Portal liest den Verwendungszweck („Hausgeld WE 2
          Müller“) und schlägt die passende Einheit gleich vor – Sie bestätigen
          nur noch. Die Rückstandsliste zeigt danach live, welche Einheit im
          Plus, im Soll oder im Rückstand ist.
        </p>
        <p>
          Das nimmt der Selbstverwaltung die häufigste Fehlerquelle: vergessene
          oder doppelt verbuchte Zahlungen, die am Jahresende niemand mehr
          rekonstruieren kann.
        </p>
      </FeatureSection>

      <FeatureSection
        id="mahnwesen"
        eyebrow="Mahnwesen"
        title="Mahnen unter Nachbarn – sachlich, schriftlich, eskalationssicher"
        visual={<DunningVisual />}
        points={[
          "Stufen: Zahlungserinnerung → 1. Mahnung → 2. Mahnung",
          "Fertiger DIN-A4-Brief mit Adressfeld für Fensterumschläge",
          "Eskalation nur über tatsächlich versendete Schreiben („als versendet markieren“)",
          "Keine automatischen Mahngebühren – die Gemeinschaft entscheidet selbst",
          "Verzugszinsen auf Basis des amtlichen Basiszinssatzes (§ 247 BGB), halbjährlich gepflegt",
        ]}
      >
        <p>
          Gerade wenn Eigentümer sich persönlich kennen, ist Mahnen unangenehm.
          Das Portal macht daraus einen sachlichen, dokumentierten Prozess: Aus
          dem Rückstand einer Einheit erzeugen Sie mit einem Klick eine
          Zahlungserinnerung als druckfertigen Brief – höflich formuliert, mit
          allen Beträgen und Fristen.
        </p>
        <p>
          Erst wenn ein Schreiben wirklich versendet wurde, lässt sich die
          nächste Stufe erzeugen. So ist der Ablauf später lückenlos belegbar –
          wichtig, falls ein Rückstand doch einmal vor Gericht landet.
        </p>
      </FeatureSection>

      {/* Der SEPA-Lastschrifteinzug ist vorerst abgeschaltet (`lib/features.ts`).
          Der Abschnitt verschwindet mit dem Schalter statt aus dem Quelltext:
          Eine Funktion zu bewerben, die im Portal nicht auffindbar ist, ist
          schlimmer, als sie wegzulassen — und beim Wiedereinschalten steht die
          Werbung wieder, ohne dass sie jemand neu schreiben muss. */}
      {isSepaLastschriftEnabled() ? (
      <FeatureSection
        id="lastschrift"
        eyebrow="SEPA-Lastschrift"
        title="Hausgeld einziehen, statt auf Überweisungen zu warten"
        reverse
        visual={<BankImportVisual />}
        points={[
          "Mandate je Einheit erfassen, mit Referenz und Unterschriftsdatum",
          "Einzugsdatei im Format pain.008 – im Online-Banking hochladen, fertig",
          "Erst- und Folgelastschriften werden getrennt gruppiert, wie es die Banken verlangen",
          "Kein Bank-API-Zugang, keine Kontofreigabe an Dritte",
        ]}
      >
        <p>
          Die meisten Rückstände entstehen nicht aus Unwillen, sondern weil eine
          Überweisung vergessen wird. Mit einem SEPA-Lastschriftmandat holt die
          Gemeinschaft das Hausgeld selbst ab – und das Portal erzeugt dafür die
          Einzugsdatei.
        </p>
        <p>
          Bewusst ohne Anbindung an Ihr Konto: Die Datei wird im Portal erzeugt
          und von Ihnen im Online-Banking hochgeladen. Niemand außer Ihnen
          bekommt Zugriff auf das Gemeinschaftskonto.
        </p>
      </FeatureSection>
      ) : null}

      <CtaBand
        title="Nie wieder offenen Posten hinterhertelefonieren"
        text="Starten Sie kostenlos und bringen Sie die Hausgeld-Zahlungen Ihrer WEG in geordnete Bahnen."
      />
      <MarketingFooter />
    </main>
  );
}
