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
import { Reveal } from "@/components/marketing/reveal";
import { assertMainDomain } from "@/lib/marketing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Eigentümerversammlung & Beschlüsse",
  description:
    "Versammlung mit Ladungsfrist einberufen, Anwesenheit und Vollmachten " +
    "erfassen, nach Ihrem Stimmprinzip abstimmen und Beschlüsse dokumentieren.",
};

const VERSAMMLUNGS_FRAGEN = [
  {
    f: "Wie lange vorher müssen wir zur Versammlung einladen?",
    a:
      "Mindestens drei Wochen, in Textform und mit vollständiger Tagesordnung " +
      "(§ 24 Abs. 4 WEG) – eine kürzere Frist ist nur bei besonderer Dringlichkeit " +
      "zulässig. Im Portal rechnet ein Fristenrechner mit: Liegt der Termin zu " +
      "nah, warnt er, bevor die Einladung herausgeht. Das ist der häufigste " +
      "Grund, aus dem ein Beschluss später angefochten wird.",
  },
  {
    f: "Ist unsere Versammlung beschlussfähig, wenn nur wenige kommen?",
    a:
      "Ja. Das frühere Quorum – mehr als die Hälfte der Miteigentumsanteile – " +
      "ist mit dem Wohnungseigentumsmodernisierungsgesetz zum 1. Dezember 2020 " +
      "entfallen. Seither ist jede ordnungsgemäß einberufene Versammlung " +
      "beschlussfähig, gleich wie viele Eigentümer erscheinen. Eine Versammlung " +
      "mangels Beteiligung abzusagen, ist also nicht nötig.",
  },
  {
    f: "Können wir auch ohne Versammlung beschließen?",
    a:
      "Ja, als Umlaufbeschluss nach § 23 Abs. 3 WEG in Textform. Der Regelfall " +
      "ist dabei Allstimmigkeit: Alle Eigentümer müssen zustimmen, wer nicht " +
      "antwortet, blockiert. Die Gemeinschaft kann für einen einzelnen " +
      "Gegenstand vorher beschließen, dass eine geringere Mehrheit genügt " +
      "(§ 23 Abs. 3 Satz 2 WEG). Das Portal ist deshalb auf Allstimmigkeit " +
      "voreingestellt und weist darauf hin, sobald jemand davon abweicht.",
  },
  {
    f: "Was gilt für Vollmachten, wenn jemand nicht kommen kann?",
    a:
      "Wer verhindert ist, kann sich vertreten lassen; die Vollmacht braucht " +
      "dafür Textform (§ 25 Abs. 3 WEG). Ihre Gemeinschaftsordnung kann den " +
      "Kreis der Bevollmächtigten einschränken – häufig auf andere " +
      "Miteigentümer, Ehegatten oder den Verwalter. Wer für wen aufgetreten " +
      "ist, halten Sie im Portal im Anwesenheits- und Vertretungsvermerk fest; " +
      "er wird Teil des Protokolls.",
  },
  {
    f: "Dürfen Eigentümer online teilnehmen?",
    a:
      "Die Versammlung kann per Beschluss zulassen, dass Eigentümer online " +
      "teilnehmen (§ 23 Abs. 1a WEG). Das Portal nimmt den Zuschaltungs-Link " +
      "in die Einladung auf und hält die Online-Teilnahme im " +
      "Anwesenheitsvermerk fest. Die Videokonferenz selbst und die Abstimmung " +
      "laufen bewusst außerhalb: Das Portal ist kein Konferenzdienst, und eine " +
      "Live-Abstimmung, deren Technik im entscheidenden Moment klemmt, macht " +
      "den Beschluss angreifbar.",
  },
];

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
          // Kein Wort mehr zur Beschlussfähigkeit: Das Quorum des § 25 Abs. 3
          // WEG a. F. ist mit dem WEMoG zum 01.12.2020 entfallen — seither ist
          // jede ordnungsgemäß einberufene Versammlung beschlussfähig, gleich
          // wie viele kommen. Es als Fehlerquelle zu nennen, verunsichert
          // gerade die Laien, für die diese Seite geschrieben ist: Sie könnten
          // eine Versammlung mangels Beteiligung absagen, die längst
          // beschließen dürfte.
          "Die Eigentümerversammlung ist das Herz jeder WEG – und ihre größte " +
          "Fehlerquelle. Ob ein Beschluss später Bestand hat, entscheidet sich " +
          "meist schon bei der Einladung: Textform, drei Wochen Frist, " +
          "vollständige Tagesordnung (§ 24 Abs. 4 WEG). Das Portal führt Sie so " +
          "durch die Versammlung, dass am Ende alles sauber dokumentiert ist."
        }
        image={{
          src: "/images/marketing/versammlung.jpg",
          alt: "Eigentümerversammlung am Tisch mit Protokoll und Tagesordnung",
        }}
        badge={{ icon: <Users className="h-4 w-4 text-wp-accent-ink" />, text: "Anwesenheit und Vertretung erfasst" }}
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
          Unterlagen zusammenstellen, fristgerecht einladen. Das gilt auch für
          die Eigentümerversammlung ohne externen Verwalter – lädt bei Ihnen
          ein Miteigentümer als bestellter Verwalter ein, führt ihn das Portal
          durch Fristen und Form. Sie legen die Versammlung mit allen
          Tagesordnungspunkten an; Vorlagen wie der Wirtschaftsplan oder die
          Jahresabrechnung hängen automatisch mit den richtigen Zahlen daran.
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
        title="Anwesenheit, Vertretung und Abstimmung nach Ihrem Stimmprinzip"
        reverse
        visual={<VoteVisual />}
        points={[
          // Vorher stand hier „das Portal rechnet die vertretenen Anteile
          // zusammen". Das kann es nicht: Anwesenheit und Vertretung sind ein
          // Vermerk fürs Protokoll (`Meeting.attendanceNote`), keine Erfassung
          // je Eigentümer. Eine Zusage, die das Produkt nicht einlöst, fällt
          // spätestens in der ersten Versammlung auf.
          "Anwesenheit und Vertretung als Vermerk fürs Protokoll festhalten",
          "Stimmgewichte nach dem Prinzip Ihrer Gemeinschaft: Kopf, MEA oder Objekt",
          "Angenommen oder abgelehnt: das Ergebnis wird direkt festgehalten",
        ]}
      >
        <p>
          Während der Versammlung halten Sie fest, wer anwesend und wer
          vertreten ist – der Vermerk geht so ins Protokoll ein. Bei jeder
          Abstimmung zählen Sie Ja, Nein und Enthaltung, und das System gewichtet die
          Stimmen nach dem Prinzip, das in Ihrer Gemeinschaft gilt: Gesetzlicher
          Regelfall ist das Kopfprinzip – eine Stimme je Eigentümer (§ 25 WEG).
          Sieht Ihre Gemeinschaftsordnung stattdessen Miteigentumsanteile
          (Wertprinzip) oder eine Stimme je Einheit (Objektprinzip) vor, rechnet
          das Portal genau danach – auch bei Mehrheiten, die zusätzlich auf die
          MEA schauen, etwa der doppelt qualifizierten nach § 21 WEG.
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

      {/* ── Häufige Fragen ──────────────────────────────────────────────────
          Die vier Fragen, an denen Beschlüsse in der Praxis scheitern. Native
          <details>, wie auf /so-funktionierts – kein Client-JS, kein
          Accordion-Paket. Jede Angabe ist am geltenden WEG geprüft: Das
          Beschlussfähigkeits-Quorum ist mit dem WEMoG entfallen, und § 25
          Abs. 3 WEG trägt seither die Textform-Regel für Vollmachten. */}
      <section className="mx-auto w-full max-w-3xl px-4 pt-20 sm:px-6 sm:pt-24">
        <Reveal>
          <h2 className="text-balance text-2xl font-bold text-wp-ink sm:text-3xl">
            Häufige Fragen zur Eigentümerversammlung
          </h2>
          <p className="mt-3 text-wp-ink/70">
            Vier Punkte entscheiden darüber, ob ein Beschluss später Bestand
            hat – Ladungsfrist, Beschlussfähigkeit, Umlaufbeschluss und
            Vollmacht. Allgemeine Information, keine Rechtsberatung.
          </p>
        </Reveal>
        <div className="mt-6 space-y-3">
          {VERSAMMLUNGS_FRAGEN.map((faq, i) => (
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
        title="Die nächste Versammlung souverän leiten"
        text="Legen Sie Ihre WEG kostenlos an und bereiten Sie die nächste Eigentümerversammlung im Portal vor."
      />
      <MarketingFooter />
    </main>
  );
}
