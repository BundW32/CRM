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
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  FileCheck,
  FileSignature,
  HandCoins,
  Landmark,
  MessagesSquare,
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
import { MobileCtaBar } from "@/components/marketing/mobile-cta-bar";
import { KenBurnsBackdrop } from "@/components/marketing/photo-hero";
import { Reveal } from "@/components/marketing/reveal";
import { ScrollyBuild } from "@/components/marketing/scrolly-build";
import { registrierenLink } from "@/lib/aktion-server";
import { getUser } from "@/lib/session";
import { getTenantOrg } from "@/lib/tenant";
import { isWegSaas } from "@/lib/app-mode";
import { siteUrl } from "@/lib/site-url";
import {
  BASIC_JE_EINHEIT_EUR,
  monatspreis,
  PLUS_JE_EINHEIT_EUR,
  START_EINHEITEN,
  VERGLEICH_VERWALTUNG_JE_EINHEIT_EUR,
} from "./preise/preise-daten";

export const dynamic = "force-dynamic";

// Element 3: SEO-Titel mit den Suchbegriffen, unter denen Betroffene suchen.
// Die Marke steht NICHT mehr im Titel selbst: Das `title.template` in
// `layout.tsx` hängt sie an jeden Seitentitel an. Stünde sie hier weiter drin,
// hieße die Seite „… – wegportal24 | wegportal24".
export const metadata: Metadata = {
  title: "WEG selbst verwalten ohne Hausverwaltung",
  description:
    "Keine Hausverwaltung gefunden? Verwalten Sie Ihre WEG selbst – Wirtschaftsplan, " +
    "Hausgeld und Jahresabrechnung inklusive. Jetzt kostenlos starten.",
  keywords: [
    "WEG selbst verwalten",
    "WEG Selbstverwaltung",
    "keine Hausverwaltung gefunden",
    "Wirtschaftsplan WEG",
    "Jahresabrechnung WEG",
    "Hausgeld verwalten",
  ],
  openGraph: {
    type: "website",
    locale: "de_DE",
    siteName: "wegportal24",
    url: "/",
    title: "WEG selbst verwalten ohne Hausverwaltung – wegportal24",
    description:
      "Wirtschaftsplan, Hausgeld, Jahresabrechnung und Versammlung für " +
      "selbstverwaltete Eigentümergemeinschaften.",
    // Ohne Bild zeigen soziale Netze und Messenger nur einen grauen Kasten.
    images: [
      {
        url: "/images/marketing/hero-building-v2.jpg",
        alt: "Mehrfamilienhaus einer Wohnungseigentümergemeinschaft",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "WEG selbst verwalten ohne Hausverwaltung – wegportal24",
    description:
      "Wirtschaftsplan, Hausgeld, Jahresabrechnung und Versammlung für " +
      "selbstverwaltete Eigentümergemeinschaften.",
    images: ["/images/marketing/hero-building-v2.jpg"],
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
      "Einladung mit Fristenrechner, Anwesenheit erfassen, abstimmen nach dem " +
      "Stimmprinzip Ihrer Gemeinschaft – Kopfprinzip, Miteigentumsanteile oder " +
      "Objektprinzip. Jeder Beschluss landet dauerhaft in der Beschluss-Sammlung.",
    href: "/funktionen/versammlung",
  },
  {
    icon: Users,
    titel: "Alle im Haus eingebunden",
    text:
      "Eigentümer, Beirat und Mieter mit eigenem Zugang – jeder sieht genau " +
      "das, was ihn betrifft, auch am Handy. Schäden werden mit Foto direkt " +
      "im Portal gemeldet und behalten ihren Status bis zur Erledigung.",
    href: "/funktionen/kommunikation",
  },
];

// Vergleichsrechnung gegenüber einer externen Verwaltung. Beide Seiten der
// Rechnung kommen aus `preise/preise-daten.ts` (die eine Preisquelle) — die
// Preisseite rechnet mit denselben Werten je WEG-Größe.
const VERGLEICH_EINHEITEN = START_EINHEITEN;
const VERGLEICH_JAHR_VERWALTUNG =
  VERGLEICH_VERWALTUNG_JE_EINHEIT_EUR * VERGLEICH_EINHEITEN * 12;
const VERGLEICH_JAHR_PORTAL = monatspreis(BASIC_JE_EINHEIT_EUR, VERGLEICH_EINHEITEN) * 12;
const VERGLEICH_ERSPARNIS_JAHR = VERGLEICH_JAHR_VERWALTUNG - VERGLEICH_JAHR_PORTAL;

const euro = (betrag: number) =>
  betrag.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });

// Element 8: „Für wen"-Slot. Drei Rollen in direkter Ansprache — bewusst
// keine erzählten Einzelpersonen: Das Portal ist neu, und eine Karte, die wie
// der Fallbericht einer echten Kundin klingt, wäre eine erfundene Referenz.
const ROLLEN = [
  {
    rolle: "Sie übernehmen das Amt",
    text:
      "Das Portal führt Sie durch Wirtschaftsplan, Buchhaltung und " +
      "Jahresabrechnung, rechnet centgenau und prüft die Summen mit. " +
      "Fachbegriffe erklären sich per Klick – Buchhaltungswissen brauchen " +
      "Sie nicht.",
  },
  {
    rolle: "Sie sitzen im Beirat",
    text:
      "Statt eines Ordners voller Kopien sehen Sie Plan, Abrechnung und " +
      "Belege direkt im Portal, Journal und Kontoblatt als CSV. Ihr " +
      "Prüfvermerk nach § 29 WEG steht am Dokument – nachvollziehbar für die " +
      "ganze Gemeinschaft.",
  },
  {
    rolle: "Sie sind Miteigentümer",
    text:
      "Einladung, Tagesordnung und eigene Anträge im Portal, abgestimmt wird " +
      "nach dem Stimmprinzip Ihrer Gemeinschaftsordnung. Wer nicht dabei sein " +
      "kann, gibt eine Vollmacht – und liest den Beschluss hinterher in der " +
      "Sammlung nach.",
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
      "Der Start ist kostenlos und ohne Zahlungsdaten. Danach zahlt Ihre " +
      "Gemeinschaft je Einheit und Monat: Basic 10 €, Verwalter-Plus 13,90 € – " +
      "Letzterer mit einem Ticket-System, über das ein zertifizierter " +
      "Verwalter (§ 26a WEG) Ihre Fragen beantwortet. Alle Preise sind " +
      "Endpreise inklusive Mehrwertsteuer, alle Zugänge immer inklusive, und " +
      "je mehr Einheiten, desto günstiger wird die einzelne. Details und ein " +
      "Rechner stehen auf der Preisseite.",
  },
  {
    f: "Brauchen wir für die Selbstverwaltung einen Verwaltervertrag?",
    a:
      "Sinnvoll ist er: Auch ein Miteigentümer wird durch Beschluss zum " +
      "Verwalter bestellt, und ein Vertrag regelt Aufgaben, Laufzeit und " +
      "Vergütung. wegportal24 erstellt Ihnen dafür den Mustervertrag für die " +
      "eigene Selbstverwaltung als PDF, vorausgefüllt mit den Daten Ihrer " +
      "WEG – Ihre Gemeinschaft passt ihn an und beschließt ihn. Allgemeine " +
      "Vorlage, keine Rechtsberatung.",
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
    f: "Wo liegen unsere Daten – und sind sie sicher?",
    a:
      "Datenbank und Anwendung laufen in Frankfurt am Main (EU-Region), " +
      "DSGVO-konform. Jede Gemeinschaft ist strikt von allen anderen getrennt; " +
      "diese Trennung wird automatisiert gegen die Datenbank getestet. Dateien " +
      "werden ausschließlich über rechtegeprüfte Wege ausgeliefert, Passwörter " +
      "verschlüsselt gespeichert. Details stehen in der Datenschutzerklärung.",
  },
  {
    f: "Rechnet hier eine KI unsere Abrechnung?",
    a:
      "Nein. Wirtschaftsplan, Verteilung und Jahresabrechnung entstehen " +
      "regelbasiert und nachvollziehbar – jede Zahl lässt sich bis zur Buchung " +
      "zurückverfolgen. KI gibt es nur als optionale Zusatzfunktion (etwa einen " +
      "Frage-Assistenten), standardmäßig abgeschaltet.",
  },
  {
    f: "Wer steht hinter wegportal24?",
    a:
      "Entwickelt hat wegportal24 der Geschäftsführer einer Hausverwaltung – " +
      "aus der täglichen Arbeit mit Wirtschaftsplänen, Abrechnungen und " +
      "Versammlungen, nicht am Reißbrett. Dieselbe Verwaltung steht hinter " +
      "dem Verwalter-Plus-Tarif und übernimmt Gemeinschaften, die aus der " +
      "Selbstverwaltung herauswachsen. Die Betreiberin steht im Impressum.",
  },
  {
    f: "Was passiert, wenn wir später doch eine Verwaltung finden?",
    a:
      "Ihre Daten gehören Ihrer Gemeinschaft. Beschluss-Sammlung, Abrechnungen " +
      "und Belege bleiben einsehbar, Journal und Kontoblatt lassen sich als " +
      "CSV exportieren und übergeben.",
  },
];

// ── Strukturierte Daten (schema.org) ──────────────────────────────────────
// Es gab keine. Ohne sie kennt eine Suchmaschine nur den Fließtext; mit ihnen
// kann die FAQ direkt in der Trefferliste aufklappen, und Name, Betreiber und
// Preis des Produkts stehen maschinenlesbar da.
//
// Die Fragen kommen aus derselben Liste, die auch die Seite rendert — eine
// zweite, gepflegte Kopie würde irgendwann auseinanderlaufen, und Google
// verlangt, dass Auszeichnung und sichtbarer Text übereinstimmen.
function StrukturierteDaten() {
  const basis = siteUrl();
  const daten = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": basis + "/#website",
        url: basis + "/",
        name: "wegportal24",
        inLanguage: "de-DE",
      },
      {
        "@type": "Organization",
        "@id": basis + "/#organisation",
        name: "wegportal24",
        url: basis + "/",
        email: "info@wegportal24.de",
      },
      {
        "@type": "SoftwareApplication",
        name: "wegportal24",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: basis + "/",
        inLanguage: "de-DE",
        description:
          "Portal für selbstverwaltete Wohnungseigentümergemeinschaften: " +
          "Wirtschaftsplan, Hausgeld, Jahresabrechnung, Versammlung und Beschlüsse.",
        offers: {
          "@type": "Offer",
          price: BASIC_JE_EINHEIT_EUR,
          priceCurrency: "EUR",
          description: "je Einheit und Monat – der Start ist kostenlos",
        },
      },
      {
        "@type": "FAQPage",
        "@id": basis + "/#faq",
        mainEntity: FAQ.map(({ f, a }) => ({
          "@type": "Question",
          name: f,
          acceptedAnswer: { "@type": "Answer", text: a },
        })),
      },
    ],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(daten) }}
    />
  );
}

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

  // Weg zur Registrierung – mit Aktionscode, solange die Willkommensaktion
  // läuft. Eine Quelle für alle Knöpfe dieser Seite; die Angebots-Blöcke holen
  // ihren Stand selbst aus demselben, je Anfrage gecachten Aufruf.
  const registrieren = await registrierenLink();

  return (
    <main className="mk-light flex-1">
      <StrukturierteDaten />
      {/* Elemente 1–2: sprechende URLs, Logo oben links in der Kopfzeile */}
      <MarketingHeader />

      {/* ── Elemente 3–5: Titel, Haupt-CTA, Vertrauens-Fakten – auf dem Foto ── */}
      <section id="inhalt" className="relative flex min-h-[82svh] items-center overflow-hidden">
        <KenBurnsBackdrop
          src="/images/marketing/hero-building-v2.jpg"
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
              Immer mehr kleine Gemeinschaften finden <strong className="font-semibold text-white">keine Hausverwaltung
              mehr</strong> – die Pflichten aus dem WEG-Gesetz bleiben trotzdem.{" "}
              <span className="hidden sm:inline">
                wegportal24 gibt Ihnen alles an die Hand, um Ihre Gemeinschaft
                einfach, gemeinsam und rechtssicher selbst zu verwalten.
              </span>
            </p>
            {/* Element 4: Haupt-CTA. Läuft die Willkommensaktion, nimmt der
                Knopf den Code mit — wer hier klickt, muss ihn nicht
                abschreiben. */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Link
                href={registrieren}
                className={`${wpButtonClass} w-full px-6 py-3 text-base sm:w-auto`}
              >
                Portal kostenlos einrichten
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className={`${buttonOnPhotoClass} w-full px-6 py-3 text-base sm:w-auto`}
              >
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
            {/* Die Willkommensaktion steht NICHT im Hero (Entscheidung vom
                12.08.2026): Sie läuft als mitlaufende Leiste über der
                Kopfzeile — der Hero bleibt für sich, weil er eigenständig
                weiterentwickelt wird. Der Haupt-CTA oben nimmt den Aktionscode
                trotzdem mit (`registrierenLink()`). */}
          </div>
        </div>
      </section>

      {/* ── Element 6: das Produkt in Bewegung – der Scroll-Aufbau ────────── */}
      <ScrollyBuild registrierenHref={registrieren} />

      {/* ── Element 7: Kern-Nutzen ────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-20 sm:px-6">
        <Reveal>
          <h2 className="text-balance text-2xl font-semibold text-wp-ink sm:text-3xl">
            Gebaut für Eigentümer, nicht für Verwaltungsprofis
          </h2>
          <p className="mt-3 max-w-2xl text-wp-ink/70">
            Keine Hausverwaltung gefunden? Dann verwalten Sie Ihre WEG selbst — mit
                allem, was sie dafür braucht, und nichts, was Sie überfordert. Jede
            Funktion hat eine eigene Seite mit ausführlicher Erklärung.
          </p>
        </Reveal>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {NUTZEN.map(({ icon: Icon, titel, text, href }, i) => (
            <Reveal key={titel} delay={(i % 3) * 90}>
              <article className="group relative flex h-full flex-col rounded-2xl border border-wp-ink/10 bg-white p-6 shadow-e1 transition-all hover:border-wp-accent-ink/30 hover:shadow-e2">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-wp-accent-light">
                  <Icon className="h-5 w-5 text-wp-accent-ink" />
                </span>
                {/* Nur die Überschrift ist der Link — die ganze Karte bleibt trotzdem
                    klickbar, weil `after:inset-0` eine unsichtbare Fläche darüber legt.
                    Vorher umschloss das <a> die komplette Karte: Der Ankertext war damit
                    über 200 Zeichen lang — für Suchmaschinen wie für eine
                    Screenreader-Linkliste unbrauchbar. */}
                <h3 className="mt-4 text-lg font-semibold text-wp-ink">
                  <Link
                    href={href}
                    className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wp-accent-ink"
                  >
                    {titel}
                  </Link>
                </h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-wp-ink/70">{text}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-wp-accent-ink">
                  Mehr erfahren
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </article>
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

      {/* ── Echte Ansichten aus dem Portal ─────────────────────────────────
          Keine nachgebauten Mockups: Die Bilder sind Screenshots aus der
          laufenden Anwendung (Demo-Gemeinschaft „WEG Musterstraße 12"),
          beschnitten auf die Inhalts-Karten und in den Rahmen-Stil der Seite
          gesetzt. Wer neue aufnimmt: Betreiber-Branding (Seitenleiste,
          Fußzeile) darf nicht mit aufs Bild. */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-20 sm:px-6">
        <div className="grid items-start gap-8 lg:grid-cols-[1fr_1.3fr] lg:gap-12">
          <Reveal>
            <h2 className="text-balance text-2xl font-semibold text-wp-ink sm:text-3xl">
              So sieht es im Portal aus – ungeschönt
            </h2>
            <p className="mt-3 leading-relaxed text-wp-ink/70">
              Echte Ansichten aus wegportal24, aufgenommen in der
              Demo-Gemeinschaft. Das Fristen-Cockpit hält die Pflichten der
              Gemeinschaft im Blick – Jahresabrechnung, Versammlung,
              Wirtschaftsplan – und sagt offen, wenn etwas überfällig ist oder
              Hausgeld aussteht.
            </p>
            <p className="mt-3 leading-relaxed text-wp-ink/70">
              Auch die Buchhaltung versteckt nichts: Jede Buchung zeigt Konto,
              Kostenart und § 35a-Lohnanteil. Fehlt eine Zuordnung, steht dort
              „fehlt“ – und die Jahresabrechnung lässt sich erst festschreiben,
              wenn alles aufgeht.
            </p>
          </Reveal>
          <Reveal delay={120}>
            <figure className="overflow-hidden rounded-2xl border border-wp-ink/10 bg-white shadow-e2">
              <figcaption className="border-b border-wp-ink/10 bg-wp-accent-light/50 px-5 py-3 text-sm font-semibold text-wp-ink">
                Aus dem Portal: WEG-Finanzen · Was ansteht
              </figcaption>
              <Image
                src="/images/marketing/app-fristen.jpg"
                alt="Fristen-Cockpit im Portal: Jahresabrechnung überfällig, Versammlung einberufen, Wirtschaftsplan beschließen, offene Hausgeld-Rückstände"
                width={1600}
                height={565}
                className="w-full"
                sizes="(min-width: 1024px) 640px, 100vw"
              />
            </figure>
          </Reveal>
        </div>
        <Reveal delay={80}>
          <figure className="mt-8 overflow-hidden rounded-2xl border border-wp-ink/10 bg-white shadow-e2">
            <figcaption className="border-b border-wp-ink/10 bg-wp-accent-light/50 px-5 py-3 text-sm font-semibold text-wp-ink">
              Aus dem Portal: Buchhaltung · alle Buchungen der Gemeinschaft
            </figcaption>
            <Image
              src="/images/marketing/app-buchhaltung.jpg"
              alt="Buchungsliste im Portal mit Datum, Konto, Kostenart und Betrag je Buchung – fehlende Zuordnungen sind markiert"
              width={1600}
              height={948}
              className="w-full"
              sizes="(min-width: 1152px) 1104px, 100vw"
            />
          </figure>
        </Reveal>
      </section>

      {/* ── Element 8: Stimmen – drei Situationen, als solche benannt ─────── */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-20 sm:px-6">
        <Reveal>
          <h2 className="text-balance text-2xl font-semibold text-wp-ink sm:text-3xl">
            Für wen wegportal24 gebaut ist
          </h2>
        </Reveal>
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {ROLLEN.map(({ rolle, text }, i) => (
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

      {/* ── Ersparnis gegenüber einer externen Verwaltung ─────────────────── */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-20 sm:px-6">
        <Reveal>
          <h2 className="text-balance text-2xl font-semibold text-wp-ink sm:text-3xl">
            Was Ihre WEG gegenüber einer externen Verwaltung spart
          </h2>
          <p className="mt-3 max-w-2xl text-wp-ink/70">
            Eine externe WEG-Verwaltung kostet marktüblich 25 bis 40 € je
            Einheit und Monat – kleine Gemeinschaften zahlen je Einheit meist
            am oberen Rand, und Sondervergütungen für zusätzliche Versammlungen
            oder Mahnungen kommen häufig dazu. In der Selbstverwaltung
            übernimmt Ihre Gemeinschaft die Arbeit selbst – und behält die
            Differenz.
          </p>
        </Reveal>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Reveal>
            <div className="flex h-full flex-col rounded-2xl border border-wp-ink/10 bg-white p-6 shadow-e1">
              <p className="text-sm font-semibold text-wp-ink/60">
                Externe Verwaltung
              </p>
              <p className="mt-2 text-3xl font-semibold text-wp-ink">
                {euro(VERGLEICH_JAHR_VERWALTUNG)}
                <span className="text-base font-normal text-wp-ink/60"> im Jahr</span>
              </p>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-wp-ink/70">
                Beispiel: {VERGLEICH_EINHEITEN} Einheiten zu{" "}
                {euro(VERGLEICH_VERWALTUNG_JE_EINHEIT_EUR)} je Einheit und
                Monat – Sondervergütungen noch nicht eingerechnet.
              </p>
            </div>
          </Reveal>
          <Reveal delay={90}>
            <div className="flex h-full flex-col rounded-2xl border border-wp-ink/10 bg-white p-6 shadow-e1">
              <p className="text-sm font-semibold text-wp-ink/60">
                Selbstverwaltung mit wegportal24 Basic
              </p>
              <p className="mt-2 text-3xl font-semibold text-wp-ink">
                {euro(VERGLEICH_JAHR_PORTAL)}
                <span className="text-base font-normal text-wp-ink/60"> im Jahr</span>
              </p>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-wp-ink/70">
                Dieselben {VERGLEICH_EINHEITEN} Einheiten, Mengenrabatt bereits
                eingerechnet – alle Zugänge inklusive.
              </p>
            </div>
          </Reveal>
          <Reveal delay={180}>
            <div className="flex h-full flex-col rounded-2xl border border-wp-accent-ink/30 bg-wp-accent-light/50 p-6 shadow-e1">
              <p className="text-sm font-semibold text-wp-accent-ink">
                Bleibt in der Rücklage
              </p>
              <p className="mt-2 text-3xl font-semibold text-wp-ink">
                {euro(VERGLEICH_ERSPARNIS_JAHR)}
                <span className="text-base font-normal text-wp-ink/60"> im Jahr</span>
              </p>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-wp-ink/70">
                Geld, das nicht in Verwaltungsgebühren fließt, sondern in Dach,
                Heizung und Rücklage Ihrer Gemeinschaft.
              </p>
            </div>
          </Reveal>
        </div>
        <Reveal delay={120}>
          <p className="mt-3 text-xs text-wp-ink/50">
            Beispielrechnung – marktübliche Vergütungen unterscheiden sich je
            nach Region und Leistungsumfang. Details und Rechner auf der{" "}
            <Link href="/preise" className="underline underline-offset-2">
              Preisseite
            </Link>
            .
          </p>
        </Reveal>
        {/* Mustervertrag: echte Portal-Funktion — das PDF entsteht in
            `lib/documents/verwaltervertrag.ts` und steht selbstverwalteten
            WEGs unter /verwaltung/verwaltervertrag bereit. */}
        <Reveal delay={160}>
          <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-wp-ink/10 bg-white p-6 shadow-e1 sm:flex-row sm:items-start">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-wp-accent-light">
              <FileSignature className="h-5 w-5 text-wp-accent-ink" />
            </span>
            <div>
              <h3 className="text-lg font-semibold text-wp-ink">
                Mustervertrag für die Selbstverwaltung inklusive
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-wp-ink/70">
                Auch ein Miteigentümer wird durch Beschluss zum Verwalter
                bestellt – und ein Vertrag regelt Aufgaben, Laufzeit und
                Vergütung. Das Portal erstellt Ihnen dafür den Mustervertrag
                für die eigene Selbstverwaltung als PDF, vorausgefüllt mit den
                Daten Ihrer WEG – Ihre Gemeinschaft füllt ihn aus, passt ihn an
                und beschließt ihn in der Versammlung.
              </p>
              <p className="mt-2 text-xs text-wp-ink/50">
                Allgemeine Vorlage, keine Rechtsberatung.
              </p>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── Verwalter-Plus: der Draht zum zertifizierten Verwalter ────────────
          Das stärkste Unterscheidungsmerkmal des Portals gehört auf die
          Startseite, nicht nur auf die Preisseite: Self-Service-Software plus
          punktueller Zugriff auf einen Verwalter mit Zertifizierung nach
          § 26a WEG. Die Funktion dahinter ist das Ticket-System unter
          `(portal)/verwaltung/verwalter-tickets/` — keine Behauptung ohne
          Code. Preis aus der einen Preisquelle. */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-20 sm:px-6">
        <Reveal>
          <div className="rounded-2xl border border-wp-accent-ink/30 bg-wp-accent-light/50 p-6 shadow-e1 sm:p-10">
            <div className="grid items-start gap-8 lg:grid-cols-[1.3fr_1fr] lg:gap-12">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full border border-wp-accent-ink/30 bg-white px-3 py-1 text-xs font-semibold tracking-wide text-wp-accent-ink">
                  <MessagesSquare className="h-3.5 w-3.5" />
                  Verwalter-Plus
                </p>
                <h2 className="mt-4 text-balance text-2xl font-semibold text-wp-ink sm:text-3xl">
                  Selbst verwalten – mit einem zertifizierten Verwalter im
                  Rücken
                </h2>
                <p className="mt-3 max-w-2xl leading-relaxed text-wp-ink/75">
                  Streit um eine Abrechnungsposition? Unsicher, wie der
                  Beschluss zur Dachsanierung formuliert werden muss? Im
                  Verwalter-Plus-Tarif stellt Ihre Gemeinschaft solche Fragen
                  per Ticket direkt einem Verwalter mit Zertifizierung nach
                  § 26a WEG – die Antwort bleibt im Portal dokumentiert, für
                  die ganze Gemeinschaft nachlesbar.
                </p>
                <p className="mt-3 max-w-2xl leading-relaxed text-wp-ink/75">
                  Das Amt und alle Entscheidungen bleiben bei Ihrer
                  Gemeinschaft. Sie holen sich Rückendeckung genau dann, wenn
                  Sie sie brauchen – statt dauerhaft eine volle Verwaltung zu
                  bezahlen.
                </p>
              </div>
              <div className="flex h-full flex-col rounded-2xl border border-wp-ink/10 bg-white p-6 shadow-e1">
                <p className="text-sm font-semibold text-wp-ink/60">
                  Verwalter-Plus
                </p>
                <p className="mt-2 text-3xl font-semibold text-wp-ink">
                  {PLUS_JE_EINHEIT_EUR.toLocaleString("de-DE", {
                    minimumFractionDigits: 2,
                  })}{" "}
                  €
                  <span className="text-base font-normal text-wp-ink/60">
                    {" "}
                    je Einheit / Monat
                  </span>
                </p>
                <p className="mt-1 text-sm text-wp-ink/60">
                  Endpreis inkl. MwSt. – alle Zugänge inklusive
                </p>
                <ul className="mt-4 flex-1 space-y-2 text-sm text-wp-ink/80">
                  {[
                    "Fragen zu Abrechnung, Beschlüssen und Einzelfällen",
                    "Antworten von echten Verwaltungs-Profis",
                    "Dokumentiert im Portal, jederzeit kündbar",
                  ].map((punkt) => (
                    <li key={punkt} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-wp-accent-ink" />
                      {punkt}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/preise"
                  className={`${wpButtonClass} mt-5 w-full py-2.5`}
                >
                  Tarife vergleichen
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

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
      {/* Externer Beleg statt Behauptung: Die Fristen und Pflichten auf dieser
          Seite stehen im Wortlaut im Wohnungseigentumsgesetz. */}
      <p className="mt-8 text-center text-xs text-wp-ink/50">
        Alle genannten Fristen und Pflichten im Wortlaut:{" "}
        <a
          href="https://www.gesetze-im-internet.de/woeigg/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2"
        >
          Wohnungseigentumsgesetz bei gesetze-im-internet.de
        </a>
      </p>
      {/* Weitergeben: Der haeufigste Weg zu diesem Portal ist der Hinweis eines
          Miteigentuemers an die eigene Gemeinschaft. Drei Wege dafuer — als reine
          Links, ohne fremdes Skript und ohne Tracking. */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-wp-ink/60">
        <span>Kennen Sie eine Gemeinschaft ohne Verwaltung? Seite weitergeben:</span>
        <a
          href="https://wa.me/?text=WEG%20selbst%20verwalten%20ohne%20Hausverwaltung%3A%20https%3A%2F%2Fwww.wegportal24.de%2F"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 transition-colors hover:text-wp-accent-ink"
        >
          Über WhatsApp teilen
        </a>
        <a
          href="https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fwww.wegportal24.de%2F"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 transition-colors hover:text-wp-accent-ink"
        >
          Auf LinkedIn teilen
        </a>
        <a
          href="mailto:?subject=WEG%20selbst%20verwalten%20ohne%20Hausverwaltung&body=https%3A%2F%2Fwww.wegportal24.de%2F"
          className="underline underline-offset-2 transition-colors hover:text-wp-accent-ink"
        >
          Per E-Mail weitergeben
        </a>
        <a
          href="https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fwww.wegportal24.de%2F"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 transition-colors hover:text-wp-accent-ink"
        >
          Auf Facebook teilen
        </a>
        <a
          href="https://x.com/intent/post?url=https%3A%2F%2Fwww.wegportal24.de%2F&text=WEG%20selbst%20verwalten%20ohne%20Hausverwaltung"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 transition-colors hover:text-wp-accent-ink"
        >
          Auf X teilen
        </a>
      </div>
      </section>

      {/* ── Element 10: Abschluss-CTA ─────────────────────────────────────── */}
      <div id="schluss-cta">
      <CtaBand
        title="Bereit, Ihre WEG selbst in die Hand zu nehmen?"
        text="Richten Sie wegportal24 für Ihre Gemeinschaft ein und laden Sie Ihre Miteigentümer ein – kostenlos und unverbindlich."
      />

      {/* Element 11: Fußzeile mit Kontakt und Rechtlichem. Sie bleibt im
          Ausblende-Bereich der Sticky-Leiste — sonst täuchte die Leiste am
          Seitenende wieder auf, sobald nur noch die Fußzeile im Bild ist. */}
      <MarketingFooter />
      </div>
      {/* A7: dauerhaft erreichbarer Registrieren-Weg auf Mobil */}
      <MobileCtaBar href={registrieren} />
    </main>
  );
}
