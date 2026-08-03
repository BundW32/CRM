// Öffentliche Startseite von wegportal24 (nur WEG-SaaS-Modus, nur Hauptdomain).
//
// Der Aufbau folgt der Sache, nicht der Vorlage: Eine WEG erlebt ihr Portal
// nicht als Funktionsliste, sondern als Jahr — Hausgeld läuft, Abrechnung
// entsteht, Beirat prüft, Versammlung beschließt, der nächste Plan steht an.
// Genau so ist die Seite gegliedert. Die Bausteine kommen aus `./dokument`
// und bilden Papier nach: Haarlinien, Marginalspalte für die Paragraphen,
// Tabellenziffern. Verbindlich ist `.claude/skills/marken-seiten/SKILL.md`.
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { wpButtonClass } from "@/components/marketing/brand";
import {
  Abschnitt,
  blatt,
  JahresEintrag,
  Meta,
  MitMarginalie,
  RegisterZeile,
  spalteText,
} from "@/components/marketing/dokument";
import { MarketingFooter, MarketingHeader } from "@/components/marketing/site";
import { Reveal } from "@/components/marketing/reveal";
import { ScrollyBuild } from "@/components/marketing/scrolly-build";
import { BrandGlyph } from "@/components/marketing/wordmark";
import { getUser } from "@/lib/session";
import { getTenantOrg } from "@/lib/tenant";
import { isWegSaas } from "@/lib/app-mode";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "WEG selbst verwalten – wegportal24",
  description:
    "Keine Hausverwaltung gefunden? Verwalten Sie Ihre Eigentümergemeinschaft selbst: " +
    "Wirtschaftsplan, Hausgeld, Buchhaltung, Versammlung und Jahresabrechnung nach WEG – " +
    "kostenlos starten.",
};

// ── Die Teilungserklärung als Auftakt-Bild ────────────────────────────────
// Sechs Einheiten, deren Miteigentumsanteile auf 1000/1000 aufgehen. Das ist
// kein Schmuck: Die Summenprüfung ist das Erste, was das Portal tut, und diese
// Spalte zeigt sie, statt sie zu behaupten.
const EINHEITEN = [
  { we: "WE 1", lage: "EG links", mea: 178 },
  { we: "WE 2", lage: "EG rechts", mea: 145 },
  { we: "WE 3", lage: "1. OG links", mea: 137 },
  { we: "WE 4", lage: "1. OG rechts", mea: 190 },
  { we: "WE 5", lage: "2. OG links", mea: 162 },
  { we: "WE 6", lage: "Dachgeschoss", mea: 188 },
];
const MEA_SUMME = EINHEITEN.reduce((s, e) => s + e.mea, 0);

// ── Das Jahr einer selbstverwalteten WEG ──────────────────────────────────
const JAHR = [
  {
    wann: "Januar – Dezember",
    paragraf: "§ 28 Abs. 1 WEG",
    titel: "Das Hausgeld läuft",
    text:
      "Aus dem beschlossenen Wirtschaftsplan entstehen zwölf monatliche " +
      "Sollstellungen je Einheit – centgenau nach den Umlageschlüsseln Ihrer " +
      "Teilungserklärung. Wer einziehen lassen will, erzeugt die SEPA-Datei und " +
      "lädt sie im Online-Banking hoch.",
    hinweis: "Kein Bank-API-Zugang, keine Kontofreigabe an Dritte.",
  },
  {
    wann: "Januar – März",
    paragraf: "§ 28 Abs. 2 WEG",
    titel: "Die Jahresabrechnung entsteht",
    text:
      "Gesamtabrechnung mit harter Kontenprüfung – der Endbestand laut " +
      "Kontoauszug muss aufgehen, sonst lässt sich nichts festschreiben. " +
      "Einzelabrechnungen je Einheit, Heizkosten verteilt, § 35a ausgewiesen, " +
      "Vermögensbericht nach Absatz 4. Bei Eigentümerwechsel tagesgenau.",
  },
  {
    wann: "Vor der Versammlung",
    paragraf: "§ 29 Abs. 2 WEG",
    titel: "Der Beirat prüft",
    text:
      "Wirtschaftsplan und Abrechnung sollen geprüft und mit einer Stellungnahme " +
      "versehen sein, bevor beschlossen wird. Der Beirat sieht die " +
      "beschlussreifen Unterlagen im Portal und hinterlegt sein Ergebnis direkt " +
      "am Dokument – nicht in einem E-Mail-Verlauf.",
  },
  {
    wann: "Drei Wochen vorher",
    paragraf: "§ 24 Abs. 4 WEG",
    titel: "Die Einladung geht hinaus",
    text:
      "Der Fristenrechner sagt, bis wann eingeladen sein muss. Auf der " +
      "Tagesordnung stehen auch die Anträge, die Eigentümer selbst im Portal " +
      "gestellt haben.",
  },
  {
    wann: "Die Versammlung",
    paragraf: "§§ 23, 25 WEG",
    titel: "Beschlüsse nach Miteigentumsanteilen",
    text:
      "Anwesenheit und Vertretung erfassen, abstimmen, Ergebnis eintragen. " +
      "Gezählt wird nach Miteigentumsanteilen – das Portal rechnet mit, statt " +
      "dass jemand am Abend Zettel addiert.",
  },
  {
    wann: "Unmittelbar danach",
    paragraf: "§ 24 Abs. 7 WEG",
    titel: "Die Beschluss-Sammlung wächst",
    text:
      "Jeder gefasste Beschluss landet fortlaufend nummeriert in der Sammlung – " +
      "mit Versammlung, Tagesordnungspunkt und Ergebnis. Beim nächsten " +
      "Wohnungsverkauf ist das ein Klick statt einer Suchaktion im Keller.",
  },
  {
    wann: "Herbst",
    paragraf: "§ 28 Abs. 1 WEG",
    titel: "Der Plan für das nächste Jahr",
    text:
      "Der Assistent legt die Istwerte des laufenden Jahres daneben, verteilt " +
      "nach Schlüssel auf die Einheiten und erzeugt die Beschlussvorlage. Mit " +
      "dem Beschluss beginnt das Jahr von vorn.",
  },
  {
    wann: "Wann immer nötig",
    titel: "Schaden, Handwerker, Erhaltung",
    text:
      "Schäden werden mit Foto gemeldet und verfolgt, Handwerker direkt " +
      "beauftragt. Größere Maßnahmen stehen in der Erhaltungsplanung mit ihrem " +
      "Finanzierungsbedarf – reicht die Rücklage nicht, wird daraus eine " +
      "Sonderumlage.",
  },
  {
    wann: "Wenn jemand nicht zahlt",
    paragraf: "§ 247 BGB",
    titel: "Mahnung, drei Stufen, auf Papier",
    text:
      "Zahlungserinnerung, erste, zweite Mahnung – jede als druckfertiger " +
      "DIN-A4-Brief mit Adressfeld für Fensterumschläge. Die nächste Stufe gibt " +
      "es erst, wenn die vorige wirklich versendet wurde. Verzugszinsen auf " +
      "Basis des amtlichen Basiszinssatzes.",
    hinweis: "Keine automatischen Mahngebühren – das entscheidet die Gemeinschaft.",
  },
];

// ── Die Einzelabrechnung, an der die Seite sich messen lässt ──────────────
// Beispielzahlen der Demo-WEG. Sie gehen auf: Die MEA-Positionen sind exakt
// 13,7 % des Gesamtbetrags, und die Abrechnungsspitze ist die Differenz aus
// Anteil und Vorauszahlung. Eine Seite über Abrechnungen, deren eigene Zahlen
// nicht stimmen, widerlegt sich selbst.
const ABRECHNUNG = [
  { art: "Heizung & Warmwasser", gesamt: "14.820,00", schluessel: "Verbrauch", anteil: "1.964,15" },
  { art: "Wasser & Abwasser", gesamt: "3.240,00", schluessel: "Personen", anteil: "540,00" },
  { art: "Hausstrom", gesamt: "1.180,00", schluessel: "MEA", anteil: "161,66" },
  { art: "Versicherungen", gesamt: "2.960,00", schluessel: "MEA", anteil: "405,52" },
  { art: "Hausmeister & Reinigung", gesamt: "5.400,00", schluessel: "MEA", anteil: "739,80" },
  { art: "Kontoführung", gesamt: "480,00", schluessel: "MEA", anteil: "65,76" },
];

const REGISTER = [
  { t: "Einheiten & Miteigentumsanteile", f: "Summenprüfung", h: "/funktionen/finanzen", d: "MEA, Fläche und Personenzahl je Einheit. Die Summe muss aufgehen." },
  { t: "Konten", f: "ordnungsmäßige Verwaltung", h: "/funktionen/finanzen#ruecklage", d: "Girokonto und Erhaltungsrücklage strikt getrennt geführt." },
  { t: "Buchhaltung", h: "/funktionen/finanzen#buchhaltung", d: "Buchungen mit Beleg-Upload, Umbuchung Giro ↔ Rücklage." },
  { t: "CSV-Bankimport", h: "/funktionen/finanzen#buchhaltung", d: "Sparkasse, Volksbank; Spalten-Zuordnung und Duplikaterkennung." },
  { t: "Journal & Kontoblatt", h: "/funktionen/finanzen#buchhaltung", d: "Als CSV heraus – für Beirat, Steuerberatung oder das eigene Archiv." },
  { t: "Wirtschaftsplan", f: "§ 28 Abs. 1 WEG", h: "/funktionen/finanzen#wirtschaftsplan", d: "Assistent, Einzelpläne je Einheit, Beschlussvorlage." },
  { t: "Jahresabrechnung", f: "§ 28 Abs. 2 WEG", h: "/funktionen/finanzen#jahresabrechnung", d: "Mit Kontenprüfung, § 35a-Ausweis und Abrechnungsspitze." },
  { t: "Vermögensbericht", f: "§ 28 Abs. 4 WEG", h: "/funktionen/finanzen#jahresabrechnung", d: "Stand der Rücklage und wesentliches Gemeinschaftsvermögen." },
  { t: "Hausgeld", h: "/funktionen/hausgeld", d: "Soll, Ist und Saldo je Einheit; Zahlungseingänge zuordnen." },
  { t: "SEPA-Lastschrift", f: "pain.008", h: "/funktionen/hausgeld#lastschrift", d: "Mandate verwalten, Einzugsdatei erzeugen, selbst hochladen." },
  { t: "Mahnwesen", f: "§ 247 BGB", h: "/funktionen/hausgeld#mahnwesen", d: "Drei Stufen als DIN-A4-Brief, Verzugszinsen, keine Automatik." },
  { t: "Sonderumlage & Erhaltungsplanung", h: "/funktionen/finanzen#ruecklage", d: "Maßnahmen mit Finanzierungsbedarf; Umlage nach Beschluss verteilt." },
  { t: "Versammlung", f: "§ 24 Abs. 4 WEG", h: "/funktionen/versammlung#vorbereitung", d: "Einladung mit Fristenrechner, Tagesordnung, Anwesenheit." },
  { t: "Abstimmung", f: "§ 25 WEG", h: "/funktionen/versammlung#abstimmung", d: "Nach Miteigentumsanteilen, mit Vertretung und Beschlussfähigkeit." },
  { t: "Beschluss-Sammlung", f: "§ 24 Abs. 7 WEG", h: "/funktionen/versammlung#beschluesse", d: "Fortlaufend, dauerhaft, für jeden Eigentümer einsehbar." },
  { t: "Verwaltungsbeirat", f: "§ 29 Abs. 2 WEG", h: "/funktionen/versammlung#beirat", d: "Prüfvermerk zu Plan und Abrechnung, direkt am Dokument." },
  { t: "Anträge der Eigentümer", h: "/funktionen/versammlung#beirat", d: "Zur Tagesordnung, ohne Sammel-E-Mails." },
  { t: "Zähler & Verbrauch", h: "/funktionen/kommunikation#verbrauch", d: "Stände erfassen, Heizkosten verteilen, Verbrauch je Einheit zeigen." },
  { t: "CO₂-Kostenaufteilung", f: "CO2KostAufG", h: "/funktionen/kommunikation#verbrauch", d: "Stufe ermitteln, Anteil zwischen Vermieter und Mieter ausweisen." },
  { t: "Schäden & Handwerker", h: "/funktionen/kommunikation#schaeden", d: "Melden mit Foto, beauftragen, Ausführung dokumentieren." },
  { t: "Dokumente & Aushänge", h: "/funktionen/kommunikation#dokumente", d: "Zentral abgelegt; jede Rolle sieht genau das, was sie betrifft." },
  { t: "Zugänge", h: "/funktionen/kommunikation#rollen", d: "Eigentümer, Beirat, Mieter, Handwerker – jeder mit eigenem Login." },
  { t: "Assistent & Fachbegriffe", h: "/funktionen/kommunikation#assistent", d: "Fragen im Klartext; Begriffe erklären sich per Klick." },
  { t: "Bauabzugsteuer", f: "§ 48a EStG", h: "/so-funktionierts", d: "Einbehalte anmelden, bis zum 10. des Folgemonats." },
];

export default async function Home() {
  const user = await getUser();
  // Eingeloggt: in beiden Modi direkt ins Portal.
  if (user) redirect("/dashboard");

  // Verwaltungs-Variante (APP_MODE=verwaltung): Startseite ist der Login. Die
  // öffentliche Landing-Page gehört allein zur WEG-SaaS-Variante.
  if (!isWegSaas()) redirect("/login");

  // Auch im SaaS-Modus behalten Mandanten-Subdomains ihren gebrandeten Login –
  // die Landing-Page gehört auf die Hauptdomain.
  if (await getTenantOrg()) redirect("/login");

  return (
    <main className="mk-light flex-1">
      <MarketingHeader />

      {/* ── Auftakt ────────────────────────────────────────────────────────
          Kein Foto, kein Verlauf, keine Pille. Die Aussage steht als Satz da,
          und daneben liegt das Material, um das es geht: eine Aufteilung, die
          auf 1000/1000 aufgeht. */}
      <section id="inhalt" className={`${blatt} pt-14 sm:pt-20`}>
        <div className="grid gap-x-14 gap-y-10 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="animate-page-in">
            <Meta>Wohnungseigentumsgesetz · für Gemeinschaften mit 2 bis 20 Einheiten</Meta>
            <h1 className="mt-7 text-balance text-[2.6rem] font-semibold leading-[1.05] tracking-[-0.02em] text-wp-ink sm:text-[3.6rem]">
              Keine Hausverwaltung gefunden?
              <br />
              <span className="text-wp-accent-ink">Verwalten Sie selbst.</span>
            </h1>
            <p className={`${spalteText} mt-7 text-[19px] leading-[1.6] text-wp-ink/80`}>
              Immer mehr kleine Eigentümergemeinschaften bekommen keinen Verwalter
              mehr. Die Pflichten aus dem Wohnungseigentumsgesetz bleiben trotzdem —
              Wirtschaftsplan, Abrechnung, Rücklage, Versammlung, Beschluss.
              wegportal24 führt Ihre Gemeinschaft durch dieses Jahr.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-3">
              <Link href="/registrieren" className={`${wpButtonClass} px-6 py-3 text-base`}>
                Kostenlos einrichten
              </Link>
              <Link
                href="/login"
                className="text-[15px] font-semibold text-wp-ink underline decoration-wp-ink/30 underline-offset-[6px] transition-colors hover:decoration-wp-accent-ink"
              >
                Ich habe schon einen Zugang
              </Link>
            </div>
            <p className="mt-5 text-sm text-wp-ink/55">
              Ohne Zahlungsdaten. In wenigen Minuten eingerichtet.
            </p>
          </div>

          {/* Teilungserklärung als Tabelle – das Erste, was im Portal entsteht */}
          <Reveal delay={120}>
            <figure className="lg:pt-11">
              <figcaption className="flex items-center gap-2 border-b border-wp-ink/20 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-wp-ink/55">
                <BrandGlyph className="!h-3.5 !w-3.5" />
                Teilungserklärung · Auszug
              </figcaption>
              <table className="mt-1 w-full text-[15px] tabular-nums">
                <tbody>
                  {EINHEITEN.map((e) => (
                    <tr key={e.we} className="border-b border-wp-ink/10">
                      <td className="py-[7px] pr-2 font-semibold text-wp-ink">{e.we}</td>
                      <td className="py-[7px] pr-2 text-wp-ink/55">{e.lage}</td>
                      <td className="py-[7px] text-right text-wp-ink/85">{e.mea}/1000</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="pt-2.5 font-semibold text-wp-ink" colSpan={2}>
                      Summe
                    </td>
                    <td className="pt-2.5 text-right font-semibold text-wp-ink">
                      {MEA_SUMME}/1000
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className="mt-2.5 text-[13px] leading-snug text-wp-accent-ink">
                Geht auf. Fehlt ein Anteil, sagt es das Portal beim Anlegen — nicht
                erst in der Abrechnung.
              </p>
            </figure>
          </Reveal>
        </div>
      </section>

      {/* ── Warum das überhaupt eine Frage ist ─────────────────────────── */}
      <Abschnitt
        nr="01"
        titel="Die Pflichten bleiben, auch ohne Verwalter"
        vorspann={
          <p>
            Professionelle Hausverwaltungen nehmen kleine Gemeinschaften kaum noch
            an: gleiche Pflichten wie bei großen Objekten, zu wenig Honorar. Wer
            keine findet, verwaltet selbst — und stellt fest, dass das Gesetz keine
            Rücksicht auf die Größe nimmt.
          </p>
        }
      >
        <div className="mt-8 space-y-7">
          <Reveal>
            <MitMarginalie marginalie="§ 28 WEG">
              <p className="leading-relaxed text-wp-ink/80">
                Wirtschaftsplan und Jahresabrechnung sind zu beschließen. Beides
                muss rechnerisch aufgehen und nach den Schlüsseln der
                Teilungserklärung verteilt sein.
              </p>
            </MitMarginalie>
          </Reveal>
          <Reveal delay={80}>
            <MitMarginalie marginalie="§ 19 Abs. 2 WEG">
              <p className="leading-relaxed text-wp-ink/80">
                Erhaltungsrücklage bilden, Versammlung abhalten, Beschlüsse
                dokumentieren — unabhängig davon, ob sich ein Verwalter findet.
              </p>
            </MitMarginalie>
          </Reveal>
          <Reveal delay={160}>
            <MitMarginalie marginalie="In der Praxis">
              <p className="leading-relaxed text-wp-ink/80">
                Excel und Aktenordner tragen das eine Weile. Was fehlt, ist die
                Sicherheit, dass die Abrechnung aufgeht, die Fristen stimmen und
                die Beschlüsse in fünf Jahren noch auffindbar sind.
              </p>
            </MitMarginalie>
          </Reveal>
        </div>
      </Abschnitt>

      {/* Die eine handgezeichnete Szene der Seite – Aufbau beim Scrollen */}
      <div className="mt-20">
        <ScrollyBuild />
      </div>

      {/* ── Das Jahr ───────────────────────────────────────────────────── */}
      <Abschnitt
        nr="02"
        titel="Ein Jahr in Ihrer Gemeinschaft"
        vorspann={
          <p>
            Das Portal ist keine Sammlung von Werkzeugen, sondern ein Ablauf.
            So sieht er aus.
          </p>
        }
      >
        <div className="mt-9">
          {JAHR.map((e) => (
            <JahresEintrag
              key={e.titel}
              wann={e.wann}
              paragraf={e.paragraf}
              titel={e.titel}
              hinweis={e.hinweis}
            >
              <p>{e.text}</p>
            </JahresEintrag>
          ))}
          <div className="border-t border-wp-ink/20" />
        </div>
      </Abschnitt>

      {/* ── Der Auszug, der aufgeht ────────────────────────────────────── */}
      <Abschnitt
        nr="03"
        titel="Eine Einzelabrechnung, Zeile für Zeile"
        vorspann={
          <p>
            Am Ende steht das hier — für jede Einheit, aus den Buchungen des
            Jahres. Beispiel aus der Demo-Gemeinschaft: Einheit 3, 137/1000
            Miteigentumsanteile.
          </p>
        }
      >
        <Reveal>
          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-[15px] tabular-nums">
              <thead>
                <tr className="border-y border-wp-ink/25 text-left text-[12px] font-semibold uppercase tracking-wider text-wp-ink/55">
                  <th scope="col" className="py-2.5 pr-4 font-semibold">Kostenart</th>
                  <th scope="col" className="py-2.5 pr-4 text-right font-semibold">Gesamt €</th>
                  <th scope="col" className="py-2.5 pr-4 font-semibold">Schlüssel</th>
                  <th scope="col" className="py-2.5 text-right font-semibold">Anteil WE 3 €</th>
                </tr>
              </thead>
              <tbody>
                {ABRECHNUNG.map((z) => (
                  <tr key={z.art} className="border-b border-wp-ink/10">
                    <td className="py-2 pr-4 text-wp-ink/85">{z.art}</td>
                    <td className="py-2 pr-4 text-right text-wp-ink/60">{z.gesamt}</td>
                    <td className="py-2 pr-4 text-wp-ink/50">{z.schluessel}</td>
                    <td className="py-2 text-right text-wp-ink/85">{z.anteil}</td>
                  </tr>
                ))}
                <tr className="border-b border-wp-ink/25 font-semibold text-wp-ink">
                  <td className="py-2.5 pr-4">Summe Kosten</td>
                  <td className="py-2.5 pr-4 text-right">28.080,00</td>
                  <td className="py-2.5 pr-4" />
                  <td className="py-2.5 text-right">3.876,89</td>
                </tr>
                <tr className="border-b border-wp-ink/10">
                  <td className="py-2 pr-4 text-wp-ink/85">Zuführung Erhaltungsrücklage</td>
                  <td className="py-2 pr-4 text-right text-wp-ink/60">6.000,00</td>
                  <td className="py-2 pr-4 text-wp-ink/50">MEA</td>
                  <td className="py-2 text-right text-wp-ink/85">822,00</td>
                </tr>
                <tr className="border-b border-wp-ink/10">
                  <td className="py-2 pr-4 text-wp-ink/85" colSpan={3}>
                    Hausgeld-Vorauszahlungen 12 × 372,00
                  </td>
                  <td className="py-2 text-right text-wp-ink/85">−4.464,00</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-semibold text-wp-ink" colSpan={3}>
                    Abrechnungsspitze — Nachzahlung
                  </td>
                  <td className="py-3 text-right text-lg font-semibold text-wp-accent-ink">
                    234,89
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Reveal>
        <Reveal delay={100}>
          <p className={`${spalteText} mt-5 text-[15px] leading-relaxed text-wp-ink/65`}>
            Die Gesamtabrechnung lässt sich erst festschreiben, wenn der Endbestand
            laut Kontoauszug aufgeht. Danach ist sie eingefroren — spätere Buchungen
            ändern eine beschlossene Abrechnung nicht mehr.
          </p>
        </Reveal>
      </Abschnitt>

      {/* ── Register ───────────────────────────────────────────────────── */}
      <Abschnitt
        nr="04"
        weit
        titel="Register"
        vorspann={<p>Was das Portal im Einzelnen kann, mit der jeweiligen Fundstelle.</p>}
      >
        <div className="mt-8 grid gap-x-12 md:grid-cols-2">
          {REGISTER.map((r, i) => (
            <RegisterZeile key={r.t} nr={i + 1} titel={r.t} fundstelle={r.f} href={r.h}>
              {r.d}
            </RegisterZeile>
          ))}
          <div className="border-t border-wp-ink/20 md:col-span-2" />
        </div>
      </Abschnitt>

      {/* ── Rechtsrahmen ───────────────────────────────────────────────── */}
      <Abschnitt nr="05" titel="Dürfen wir das überhaupt selbst?">
        <div className="mt-8 space-y-7">
          <Reveal>
            <MitMarginalie marginalie="§ 19 Abs. 2 Nr. 6 WEG">
              <p className="leading-relaxed text-wp-ink/80">
                Ja. Keine Gemeinschaft ist verpflichtet, eine externe Verwaltung zu
                beauftragen. Übernimmt ein Miteigentümer das Verwalteramt, braucht
                er in Gemeinschaften mit weniger als neun Sondereigentumsrechten
                keine Zertifizierung — solange nicht ein Drittel der Eigentümer
                einen zertifizierten Verwalter verlangt.
              </p>
            </MitMarginalie>
          </Reveal>
          <Reveal delay={90}>
            <MitMarginalie marginalie="Hinweis">
              <p className="leading-relaxed text-wp-ink/65">
                Allgemeine Information, keine Rechtsberatung.{" "}
                <Link
                  href="/so-funktionierts"
                  className="font-semibold text-wp-accent-ink underline decoration-wp-accent-ink/40 underline-offset-4 hover:decoration-wp-accent-ink"
                >
                  Zum ausführlichen Einstieg
                </Link>
              </p>
            </MitMarginalie>
          </Reveal>
        </div>
      </Abschnitt>

      {/* ── Abschluss: die Handlung, ohne Band ─────────────────────────── */}
      <section className={`${blatt} pt-20 pb-4 sm:pt-28`}>
        <Reveal>
          <div className="border-t border-wp-ink/20 pt-8">
            <p className={`${spalteText} text-[19px] leading-[1.6] text-wp-ink/85`}>
              Legen Sie Ihre Gemeinschaft an, tragen Sie die Einheiten mit ihren
              Miteigentumsanteilen ein und laden Sie die Miteigentümer dazu. Der
              Rest ist das Jahr aus Abschnitt 02.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-3">
              <Link href="/registrieren" className={`${wpButtonClass} px-6 py-3 text-base`}>
                Kostenlos einrichten
              </Link>
              <Link
                href="/so-funktionierts"
                className="text-[15px] font-semibold text-wp-ink underline decoration-wp-ink/30 underline-offset-[6px] transition-colors hover:decoration-wp-accent-ink"
              >
                Erst die fünf Einrichtungsschritte ansehen
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      <MarketingFooter />
    </main>
  );
}
