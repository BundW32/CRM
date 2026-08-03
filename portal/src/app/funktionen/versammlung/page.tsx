import type { Metadata } from "next";
import { Users } from "lucide-react";
import {
  CtaBand,
  FeatureSection,
  MarketingFooter,
  MarketingHeader,
  MarketingHero,
} from "@/components/marketing/site";
import { MeetingVisual, RolesVisual, VoteVisual } from "@/components/marketing/visuals";
import { assertMainDomain } from "@/lib/marketing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Eigentümerversammlung & Beschlüsse digital organisieren",
  description:
    "Versammlungen vorbereiten, Anwesenheit und Beschlussfähigkeit erfassen, " +
    "nach Miteigentumsanteilen abstimmen und Beschlüsse dauerhaft dokumentieren – " +
    "für selbstverwaltete WEGs.",
};

export default async function VersammlungPage() {
  await assertMainDomain();

  return (
    <main className="mk-light flex-1">
      <MarketingHeader active="/funktionen/versammlung" />

      <MarketingHero
        eyebrow="Versammlung & Beschlüsse"
        title={
          <>
            Beschlüsse, die{" "}
            <span className="underline decoration-wp-accent-bright decoration-4 underline-offset-8">Bestand haben.</span>
          </>
        }
        intro={
          "Die Eigentümerversammlung ist das Herz jeder WEG – und ihre größte " +
          "Fehlerquelle. Formfehler bei Einladung, Beschlussfähigkeit oder " +
          "Protokoll machen Beschlüsse angreifbar. Das Portal führt Sie so durch " +
          "die Versammlung, dass am Ende alles sauber dokumentiert ist."
        }
        image={{
          src: "/images/marketing/versammlung.jpg",
          alt: "Eigentümerversammlung am Tisch mit Protokoll und Tagesordnung",
        }}
        badge={{ icon: <Users className="h-4 w-4 text-wp-accent-ink" />, text: "Beschlussfähig – Anwesenheit erfasst" }}
      />

      <FeatureSection
        id="vorbereitung"
        eyebrow="Vorbereitung"
        title="Einladung, Tagesordnung, Beschlussvorlagen"
        visual={<MeetingVisual />}
        points={[
          "Versammlung mit Datum, Ort und Tagesordnungspunkten anlegen",
          "Beschlussvorlagen aus dem Portal übernehmen – z. B. den Wirtschaftsplan",
          "Eigentümer können vorab eigene Anträge und Anliegen einreichen",
        ]}
      >
        <p>
          Eine Versammlung beginnt lange vor dem Termin: Tagesordnung aufstellen,
          Unterlagen zusammenstellen, fristgerecht einladen. Im Portal legen Sie
          die Versammlung mit allen Tagesordnungspunkten an; Vorlagen wie der
          Wirtschaftsplan oder die Jahresabrechnung hängen automatisch mit den
          richtigen Zahlen daran.
        </p>
        <p>
          Auch die Miteigentümer werden einbezogen: Wer ein Anliegen hat – vom
          Fahrradkeller bis zur Ladestation – reicht es vorab digital ein,
          damit es auf die Tagesordnung kommt statt in der Kaffeepause
          unterzugehen.
        </p>
      </FeatureSection>

      <FeatureSection
        id="abstimmung"
        eyebrow="Durchführung"
        title="Anwesenheit, Beschlussfähigkeit und Abstimmung nach MEA"
        reverse
        visual={<VoteVisual />}
        points={[
          "Anwesenheit digital erfassen – das Portal rechnet die vertretenen MEA zusammen",
          "Abstimmen nach Miteigentumsanteilen, Ergebnis sofort sichtbar",
          "Angenommen oder abgelehnt: das Ergebnis wird direkt festgehalten",
        ]}
      >
        <p>
          Während der Versammlung haken Sie einfach ab, wer da ist – das Portal
          zeigt live, wie viele Miteigentumsanteile vertreten sind. Bei jeder
          Abstimmung zählen Sie Ja, Nein und Enthaltung, und das System rechnet
          das Ergebnis korrekt nach MEA aus, statt Köpfe zu zählen, wo Anteile
          gefragt sind.
        </p>
      </FeatureSection>

      <FeatureSection
        id="beschluesse"
        eyebrow="Dokumentation"
        title="Die Beschluss-Sammlung: das Gedächtnis Ihrer WEG"
        visual={<MeetingVisual />}
        points={[
          "Jeder Beschluss dauerhaft dokumentiert – mit Versammlung, TOP und Ergebnis",
          "Für alle Eigentümer jederzeit einsehbar, auch für später hinzukommende Käufer",
          "Protokolle und Unterlagen direkt an der Versammlung abgelegt",
        ]}
      >
        <p>
          WEGs sind gesetzlich verpflichtet, eine Beschluss-Sammlung zu führen –
          in der Praxis ist sie oft ein verschollener Ordner im Keller des
          früheren Verwalters. Im Portal entsteht sie nebenbei: Jeder gefasste
          Beschluss wird automatisch mit Datum, Tagesordnungspunkt und Ergebnis
          abgelegt und bleibt dauerhaft auffindbar.
        </p>
        <p>
          Das zahlt sich spätestens beim Wohnungsverkauf aus, wenn Käufer oder
          Notar die Beschlusslage sehen wollen – ein Klick statt einer
          Suchaktion.
        </p>
      </FeatureSection>

      <FeatureSection
        id="beirat"
        eyebrow="Verwaltungsbeirat & Anträge"
        title="Vier Augen auf Plan und Abrechnung – im Portal statt per E-Mail"
        reverse
        visual={<RolesVisual />}
        points={[
          "Beiratsmitglieder haben einen eigenen Bereich mit Aufgaben und Notizen",
          "Wirtschaftsplan und Jahresabrechnung werden dort geprüft und mit einem Vermerk versehen",
          "Ergebnis: „geprüft“ oder „mit Anmerkungen“ – nachvollziehbar für die ganze Gemeinschaft",
          "Eigentümer stellen Anträge zur Tagesordnung, statt Rundmails zu schreiben",
        ]}
      >
        <p>
          Wirtschaftsplan und Jahresabrechnung sollen vom Verwaltungsbeirat
          geprüft und mit seiner Stellungnahme versehen werden, bevor die
          Versammlung darüber beschließt (§ 29 Abs. 2 WEG). In der Praxis
          scheitert das oft an der Logistik: Wer hat welche Fassung, und wann?
        </p>
        <p>
          Im Portal sieht der Beirat genau die beschlussreifen Unterlagen und
          hinterlegt sein Prüfergebnis direkt daran. Wer später wissen will, ob
          geprüft wurde, sieht es am Dokument – nicht in einem alten
          E-Mail-Verlauf.
        </p>
      </FeatureSection>

      <CtaBand
        title="Die nächste Versammlung souverän leiten"
        text="Legen Sie Ihre WEG kostenlos an und bereiten Sie die nächste Eigentümerversammlung im Portal vor."
      />
      <MarketingFooter />
    </main>
  );
}
