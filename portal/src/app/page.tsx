// Öffentliche Startseite von wegportal24 (nur WEG-SaaS-Modus, nur Hauptdomain).
//
// Aufbau nach dem 11-Elemente-Rahmen für Landing Pages (Skill
// `landing-page-guide`): Logo, SEO-Titel, Haupt-CTA, Vertrauens-Fakten,
// Bilder, Nutzen-Karten, Stimmen, FAQ, Abschluss-CTA, Fußzeile mit Kontakt
// und Rechtlichem. Umgesetzt mit den Bausteinen dieses Repos statt ShadCN —
// eigene UI-Bibliothek und ESLint-Regeln gehen vor, der Rahmen bleibt.
//
// Zwei Grenzen, die bewusst gezogen sind:
// - Der „Social Proof" besteht aus Produkt- und Gesetzes-Fakten, die Stimmen
//   aus klar benannten Situationen. Erfundene Kundenzitate mit Namen und Foto
//   gibt es nicht — das Portal ist neu, und eine Seite, die mit erfundenen
//   Bewertungen wirbt, verspielt genau das Vertrauen, das sie aufbauen soll.
// - Bewegung nur über `--ease-mk-out`; der Prüfbefehl aus
//   `.claude/skills/marken-seiten/SKILL.md` muss 0 Befunde melden.
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  FileCheck,
  HandCoins,
  Landmark,
  ShieldCheck,
  Users,
  Vote,
} from "lucide-react";
import { wpButtonClass } from "@/components/marketing/brand";
import {
  buttonOnPhotoClass,
  CtaBand,
  MarketingFooter,
  MarketingHeader,
  PhotoBand,
  StatsBand,
} from "@/components/marketing/site";
import { KenBurnsBackdrop } from "@/components/marketing/photo-hero";
import { Reveal } from "@/components/marketing/reveal";
import { ScrollyBuild } from "@/components/marketing/scrolly-build";
import { getUser } from "@/lib/session";
import { getTenantOrg } from "@/lib/tenant";
import { isWegSaas } from "@/lib/app-mode";

export const dynamic = "force-dynamic";

// Element 3: SEO-Titel mit den Suchbegriffen, unter denen Betroffene suchen.
export const metadata: Metadata = {
  title: "WEG selbst verwalten ohne Hausverwaltung – wegportal24",
  description:
    "Keine Hausverwaltung gefunden? Verwalten Sie Ihre WEG selbst: Wirtschaftsplan, " +
    "Hausgeld, Jahresabrechnung, Versammlung und Beschlüsse nach WEG-Recht – " +
    "kostenlos starten, ohne Zahlungsdaten.",
  keywords: [
    "WEG selbst verwalten",
    "WEG Selbstverwaltung",
    "keine Hausverwaltung gefunden",
    "Wirtschaftsplan WEG",
    "Jahresabrechnung WEG",
    "Hausgeld verwalten",
  ],
  openGraph: {
    title: "WEG selbst verwalten – wegportal24",
    description:
      "Wirtschaftsplan, Hausgeld, Jahresabrechnung und Versammlung für " +
      "selbstverwaltete Eigentümergemeinschaften.",
  },
};

// Element 7: Kern-Nutzen als sechs Karten, jede mit Weg zur Unterseite.
const NUTZEN = [
  {
    icon: CalendarCheck,
    titel: "Wirtschaftsplan mit Assistent",
    text:
      "Vorjahres-Istwerte daneben, Verteilung nach Ihren Umlageschlüsseln, " +
      "Beschlussvorlage fertig. Aus dem Beschluss entstehen die monatlichen " +
      "Hausgeld-Beträge automatisch – centgenau.",
    href: "/funktionen/finanzen#wirtschaftsplan",
  },
  {
    icon: FileCheck,
    titel: "Jahresabrechnung, die aufgeht",
    text:
      "Die Abrechnung lässt sich erst festschreiben, wenn der Endbestand laut " +
      "Kontoauszug stimmt. Einzelabrechnungen je Einheit, § 35a-Ausweis, " +
      "Vermögensbericht – revisionssicher.",
    href: "/funktionen/finanzen#jahresabrechnung",
  },
  {
    icon: HandCoins,
    titel: "Hausgeld & Mahnwesen",
    text:
      "Soll, Ist und Saldo je Einheit. Mahnungen als fertiger DIN-A4-Brief in " +
      "drei Stufen, Verzugszinsen nach Basiszinssatz – und auf Wunsch " +
      "SEPA-Einzug ohne Bank-API.",
    href: "/funktionen/hausgeld",
  },
  {
    icon: Landmark,
    titel: "Buchhaltung ohne Buchhalter",
    text:
      "Buchen mit Beleg, CSV-Import vom Bankkonto mit Duplikaterkennung, " +
      "Rücklage strikt getrennt. Journal und Kontoblatt als CSV für Beirat " +
      "oder Steuerberatung.",
    href: "/funktionen/finanzen#buchhaltung",
  },
  {
    icon: Vote,
    titel: "Versammlung & Beschlüsse",
    text:
      "Einladung mit Fristenrechner, Anwesenheit erfassen, nach " +
      "Miteigentumsanteilen abstimmen. Jeder Beschluss landet dauerhaft in der " +
      "Beschluss-Sammlung.",
    href: "/funktionen/versammlung",
  },
  {
    icon: Users,
    titel: "Alle im Haus, jeder mit Zugang",
    text:
      "Eigentümer, Beirat, Mieter und Handwerker – jede Rolle sieht genau das, " +
      "was sie betrifft. Schäden mit Foto melden, Dokumente und Aushänge " +
      "zentral, auch am Handy.",
    href: "/funktionen/kommunikation",
  },
];

// Element 8: Stimmen-Slot – drei Situationen aus der Zielgruppe, als solche
// benannt. Keine erfundenen Namen, keine erfundenen Sterne.
const SITUATIONEN = [
  {
    rolle: "Die Eigentümerin, die das Amt übernimmt",
    text:
      "Vier Absagen von Hausverwaltungen, dann macht sie es selbst. Das Portal " +
      "führt sie durch Wirtschaftsplan und Abrechnung, prüft die Summen mit und " +
      "erklärt jeden Fachbegriff per Klick – Buchhaltungswissen braucht sie " +
      "nicht.",
  },
  {
    rolle: "Der Beirat, der prüfen soll",
    text:
      "Statt eines Ordners voller Kopien sieht er Plan, Abrechnung und Belege " +
      "im Portal, Journal und Kontoblatt als CSV. Sein Prüfvermerk nach § 29 " +
      "WEG steht direkt am Dokument – nachvollziehbar für die ganze " +
      "Gemeinschaft.",
  },
  {
    rolle: "Die Miteigentümer, die mitentscheiden",
    text:
      "Einladung, Tagesordnung und eigene Anträge im Portal, abgestimmt wird " +
      "nach Miteigentumsanteilen. Wer nicht dabei sein kann, gibt eine " +
      "Vollmacht – und liest den Beschluss hinterher in der Sammlung nach.",
  },
];

// Element 9: FAQ. Native <details> statt Accordion-Bibliothek – kein Client-JS.
const FAQ = [
  {
    f: "Dürfen wir unsere WEG überhaupt selbst verwalten?",
    a:
      "Ja. Keine Gemeinschaft ist verpflichtet, eine externe Verwaltung zu " +
      "beauftragen. Übernimmt ein Miteigentümer das Amt, braucht er in " +
      "Gemeinschaften mit weniger als neun Sondereigentumsrechten keine " +
      "Zertifizierung (§ 19 Abs. 2 Nr. 6 WEG) – solange nicht ein Drittel der " +
      "Eigentümer einen zertifizierten Verwalter verlangt.",
  },
  {
    f: "Was kostet wegportal24?",
    a:
      "Der Start ist kostenlos und ohne Zahlungsdaten. Sie legen Ihre WEG an, " +
      "richten Einheiten und Konten ein und laden die Miteigentümer ein – erst " +
      "danach entscheiden Sie, ob das Portal zu Ihrer Gemeinschaft passt.",
  },
  {
    f: "Brauchen wir Buchhaltungswissen?",
    a:
      "Nein. Die Assistenten führen durch Wirtschaftsplan, Buchhaltung und " +
      "Jahresabrechnung, rechnen centgenau und prüfen an den kritischen " +
      "Stellen mit – etwa, ob die Miteigentumsanteile aufgehen und ob die " +
      "Abrechnung zum Kontoauszug passt. Fachbegriffe erklären sich im Portal " +
      "per Klick.",
  },
  {
    f: "Wie kommt unser Bankkonto ins Portal?",
    a:
      "Per CSV-Export aus Ihrem Online-Banking (z. B. Sparkasse, Volksbank) – " +
      "mit Spalten-Zuordnung und Duplikaterkennung. Bewusst ohne " +
      "Konto-Anbindung: Niemand außer Ihnen erhält Zugriff auf das " +
      "Gemeinschaftskonto. Auch der SEPA-Einzug läuft über eine Datei, die Sie " +
      "selbst hochladen.",
  },
  {
    f: "Was ist mit unseren Mietern?",
    a:
      "Vermietende Eigentümer geben ihren Mietern einen eigenen Zugang: " +
      "Schäden mit Foto melden, Aushänge lesen, eigene Dokumente einsehen. " +
      "Jede Rolle sieht nur das, was sie betrifft.",
  },
  {
    f: "Sind unsere Daten sicher?",
    a:
      "Jede Gemeinschaft ist strikt von allen anderen getrennt; die Trennung " +
      "wird automatisiert gegen die Datenbank getestet. Dateien werden " +
      "ausschließlich über rechtegeprüfte Wege ausgeliefert, Passwörter " +
      "verschlüsselt gespeichert. Details stehen in der Datenschutzerklärung.",
  },
  {
    f: "Was passiert, wenn wir später doch eine Verwaltung finden?",
    a:
      "Ihre Daten gehören Ihrer Gemeinschaft. Beschluss-Sammlung, Abrechnungen " +
      "und Belege bleiben einsehbar, Journal und Kontoblatt lassen sich als " +
      "CSV exportieren und übergeben.",
  },
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
      {/* Elemente 1–2: sprechende URLs, Logo oben links in der Kopfzeile */}
      <MarketingHeader />

      {/* ── Elemente 3–5: Titel, Haupt-CTA, Vertrauens-Fakten – auf dem Foto ── */}
      <section id="inhalt" className="relative flex min-h-[82vh] items-center overflow-hidden">
        <KenBurnsBackdrop
          src="/images/marketing/hero-building.jpg"
          alt="Mehrfamilienhaus einer Wohnungseigentümergemeinschaft"
          preload
        />
        <div className="absolute inset-0 bg-gradient-to-r from-wp-ink/95 via-wp-ink/70 to-wp-ink/25" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-wp-ink/60 to-transparent" />

        <div className="relative mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
          <div className="max-w-2xl animate-page-in">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-white backdrop-blur-sm">
              <ShieldCheck className="h-3.5 w-3.5" />
              Für selbstverwaltete Wohnungseigentümergemeinschaften
            </p>
            <h1 className="text-balance text-4xl font-semibold leading-tight text-white sm:text-6xl">
              Keine Hausverwaltung gefunden?{" "}
              <span className="underline decoration-wp-accent decoration-4 underline-offset-8">
                Verwalten Sie Ihre WEG selbst.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg">
              Immer mehr kleine Gemeinschaften bekommen schlicht keinen Verwalter
              mehr – die Pflichten aus dem WEG-Gesetz bleiben trotzdem.
              wegportal24 gibt Ihnen alles an die Hand, um Ihre Gemeinschaft
              einfach, gemeinsam und rechtssicher selbst zu verwalten.
            </p>
            {/* Element 4: Haupt-CTA */}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/registrieren" className={`${wpButtonClass} px-6 py-3 text-base`}>
                Portal kostenlos einrichten
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/login" className={`${buttonOnPhotoClass} px-6 py-3 text-base`}>
                Ich habe schon einen Zugang
              </Link>
            </div>
            {/* Element 5: Vertrauens-Fakten – Produktfakten statt Sterne */}
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-white/80">
              {[
                "Kostenlos starten, keine Zahlungsdaten",
                "Ohne Bank-API – Ihr Konto bleibt Ihres",
                "Nach §§ 19, 24, 28 WEG",
              ].map((punkt) => (
                <li key={punkt} className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-wp-accent" />
                  {punkt}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Element 6: das Produkt in Bewegung – der Scroll-Aufbau ────────── */}
      <ScrollyBuild />

      {/* ── Element 7: Kern-Nutzen ────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-20 sm:px-6">
        <Reveal>
          <h2 className="text-balance text-2xl font-semibold text-wp-ink sm:text-3xl">
            Alles, was Ihre WEG braucht – nichts, was Sie überfordert
          </h2>
          <p className="mt-3 max-w-2xl text-wp-ink/70">
            Gebaut für Eigentümer, nicht für Verwaltungsprofis. Jede Funktion hat
            eine eigene Seite mit ausführlicher Erklärung.
          </p>
        </Reveal>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {NUTZEN.map(({ icon: Icon, titel, text, href }, i) => (
            <Reveal key={titel} delay={(i % 3) * 90}>
              <Link
                href={href}
                className="group flex h-full flex-col rounded-2xl border border-wp-ink/10 bg-white p-6 shadow-e1 transition-all hover:border-wp-accent-ink/30 hover:shadow-e2"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-wp-accent-light">
                  <Icon className="h-5 w-5 text-wp-accent-ink" />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-wp-ink">{titel}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-wp-ink/70">{text}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-wp-accent-ink">
                  Mehr erfahren
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Foto-Band als atmosphärischer Zwischenschnitt ─────────────────── */}
      <div className="mt-20">
        <PhotoBand
          src="/images/marketing/versammlung.jpg"
          alt="Eigentümer sitzen gemeinsam am Tisch einer Versammlung"
          claim="Gemeinsam entscheiden. Gemeinsam verwalten."
          sub="Ihre Gemeinschaft kennt ihr Haus besser als jeder externe Verwalter – wegportal24 gibt ihr das Handwerkszeug dazu."
        />
      </div>

      {/* ── Element 8: Stimmen – drei Situationen, als solche benannt ─────── */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-20 sm:px-6">
        <Reveal>
          <h2 className="text-balance text-2xl font-semibold text-wp-ink sm:text-3xl">
            Drei Situationen, ein Portal
          </h2>
        </Reveal>
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {SITUATIONEN.map(({ rolle, text }, i) => (
            <Reveal key={rolle} delay={i * 100}>
              <figure className="h-full rounded-2xl border border-wp-ink/10 bg-white p-6 shadow-e1">
                <blockquote className="text-[15px] leading-relaxed text-wp-ink/80">
                  {text}
                </blockquote>
                <figcaption className="mt-4 border-t border-wp-ink/10 pt-3 text-sm font-semibold text-wp-accent-ink">
                  {rolle}
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Produkt-Fakten in Zahlen ──────────────────────────────────────── */}
      <div className="mt-20">
        <StatsBand />
      </div>

      {/* ── Element 9: FAQ ────────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-3xl px-4 pt-20 sm:px-6">
        <Reveal>
          <h2 className="text-balance text-center text-2xl font-semibold text-wp-ink sm:text-3xl">
            Häufige Fragen
          </h2>
        </Reveal>
        <div className="mt-8">
          {FAQ.map(({ f, a }, i) => (
            <Reveal key={f} delay={Math.min(i * 60, 240)}>
              <details className="group border-t border-wp-ink/15 last:border-b">
                <summary className="flex cursor-pointer list-none items-baseline gap-3 py-4 text-left font-semibold text-wp-ink transition-colors hover:text-wp-accent-ink [&::-webkit-details-marker]:hidden">
                  <span className="text-wp-accent-ink transition-transform group-open:rotate-45">+</span>
                  {f}
                </summary>
                <p className="max-w-[62ch] pb-5 pl-6 text-[15px] leading-relaxed text-wp-ink/75">
                  {a}
                </p>
              </details>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Element 10: Abschluss-CTA ─────────────────────────────────────── */}
      <CtaBand
        title="Bereit, Ihre WEG selbst in die Hand zu nehmen?"
        text="Richten Sie wegportal24 für Ihre Gemeinschaft ein und laden Sie Ihre Miteigentümer ein – kostenlos und unverbindlich."
      />

      {/* Element 11: Fußzeile mit Kontakt und Rechtlichem */}
      <MarketingFooter />
    </main>
  );
}
