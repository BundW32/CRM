// Öffentliche Startseite (nur Hauptdomain): erklärt das Problem des
// Verwaltermangels bei kleinen WEGs und stellt das Portal als Lösung zur
// Selbstverwaltung vor. Jede Funktion verlinkt auf ihre Unterseite mit
// ausführlicher Erklärung (/funktionen/*). Angemeldete Nutzer landen weiter
// direkt im Dashboard, Mandanten-Subdomains behalten ihren gebrandeten Login.
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Building2,
  CalendarCheck,
  CheckCircle2,
  FileCheck,
  FolderOpen,
  Gauge,
  HandCoins,
  Landmark,
  Megaphone,
  MessageSquareText,
  PiggyBank,
  Repeat,
  Scale,
  ShieldCheck,
  UserCheck,
  Vote,
  Wrench,
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

export const metadata: Metadata = {
  title: "WEG selbst verwalten – Portal für kleine Eigentümergemeinschaften",
  description:
    "Keine Hausverwaltung gefunden? Verwalten Sie Ihre kleine WEG einfach selbst: " +
    "Wirtschaftsplan, Jahresabrechnung, Hausgeld, Buchhaltung und Eigentümerversammlung " +
    "in einem Portal – kostenlos starten.",
};

// ── Inhalte der Seite als Daten, damit das Markup schlank bleibt ──────────

const problems = [
  {
    icon: Building2,
    title: "Verwalter winken ab",
    text:
      "Professionelle Hausverwaltungen nehmen kleine Gemeinschaften mit 2–10 " +
      "Einheiten kaum noch an: gleiche Pflichten wie bei großen Objekten, aber " +
      "zu wenig Honorar. Absagen oder Preise jenseits des Zumutbaren sind die Regel.",
  },
  {
    icon: Scale,
    title: "Die Pflichten bleiben trotzdem",
    text:
      "Wirtschaftsplan, Jahresabrechnung, Erhaltungsrücklage, Versammlung und " +
      "Beschlüsse – das Wohnungseigentumsgesetz verlangt sie unabhängig davon, " +
      "ob sich ein Verwalter findet oder nicht.",
  },
  {
    icon: FolderOpen,
    title: "Excel und Aktenordner reichen nicht",
    text:
      "Wer selbst verwaltet, kämpft schnell mit Tabellen, Papierbergen und der " +
      "Unsicherheit, ob Abrechnung und Beschlüsse wirklich formal sauber sind.",
  },
];

// Jede Funktion verlinkt auf die Unterseite mit der ausführlichen Erklärung.
// Die Liste bildet den heutigen Stand ab – wer hier etwas einträgt, prüft
// vorher, dass es die Funktion im Portal auch gibt. Eine Startseite, die mehr
// verspricht als das Produkt hält, kostet mehr Vertrauen als sie gewinnt.
const features = [
  {
    icon: CalendarCheck,
    title: "Wirtschaftsplan (§ 28 WEG)",
    href: "/funktionen/finanzen#wirtschaftsplan",
    text:
      "Assistent mit Vorjahres-Istwerten, Einzelwirtschaftspläne je Einheit und " +
      "Beschlussvorlage. Der Beschluss erzeugt automatisch die monatlichen " +
      "Hausgeld-Sollstellungen – centgenau.",
  },
  {
    icon: FileCheck,
    title: "Jahresabrechnung & Vermögensbericht",
    href: "/funktionen/finanzen#jahresabrechnung",
    text:
      "Gesamt- und Einzelabrechnungen mit harter Kontenprüfung, § 35a-Ausweis " +
      "und tagesgenauer Aufteilung bei Eigentümerwechsel – revisionssicher " +
      "festgeschrieben.",
  },
  {
    icon: HandCoins,
    title: "Hausgeld & Mahnwesen",
    href: "/funktionen/hausgeld",
    text:
      "Rückstandsliste je Einheit (Soll/Ist/Saldo), Zahlungseingänge zuordnen, " +
      "Mahnungen als fertige DIN-A4-Briefe – mit Verzugszinsen auf Basis des " +
      "Basiszinssatzes (§ 247 BGB).",
  },
  {
    icon: Repeat,
    title: "SEPA-Lastschrift",
    href: "/funktionen/hausgeld#lastschrift",
    text:
      "Mandate verwalten und Hausgeld per Lastschrift einziehen: Die Datei im " +
      "Format pain.008 laden Sie einfach im Online-Banking hoch – kein " +
      "API-Zugang, keine Kontofreigabe.",
  },
  {
    icon: Landmark,
    title: "Buchhaltung mit Bankimport",
    href: "/funktionen/finanzen#buchhaltung",
    text:
      "Buchungen mit Beleg-Upload, CSV-Import vom Bankkonto (z. B. Sparkasse, " +
      "Volksbank) mit Duplikaterkennung, Journal und Kontoblatt als CSV.",
  },
  {
    icon: PiggyBank,
    title: "Rücklage, Erhaltungsplan & Sonderumlage",
    href: "/funktionen/finanzen#ruecklage",
    text:
      "Girokonto und Erhaltungsrücklage strikt getrennt, geplante Maßnahmen mit " +
      "Finanzierungsbedarf – und Sonderumlagen, die nach Beschluss wie ein " +
      "Wirtschaftsplan auf die Einheiten verteilt werden.",
  },
  {
    icon: Vote,
    title: "Versammlung & Beschlusssammlung",
    href: "/funktionen/versammlung",
    text:
      "Einladung mit Fristenrechner, Anwesenheit und Vertretung erfassen, nach " +
      "Miteigentumsanteilen abstimmen – und alles landet in der " +
      "Beschluss-Sammlung nach § 24 Abs. 7 WEG.",
  },
  {
    icon: UserCheck,
    title: "Verwaltungsbeirat & Anträge",
    href: "/funktionen/versammlung#beirat",
    text:
      "Der Beirat prüft Wirtschaftsplan und Jahresabrechnung direkt im Portal " +
      "und vermerkt sein Ergebnis (§ 29 Abs. 2 WEG). Eigentümer stellen Anträge " +
      "zur Tagesordnung, ohne Sammel-E-Mails.",
  },
  {
    icon: Gauge,
    title: "Zähler, Verbrauch & CO₂-Kosten",
    href: "/funktionen/kommunikation#verbrauch",
    text:
      "Zählerstände erfassen, Verbrauch je Einheit anzeigen, Heizkosten " +
      "verteilen und die CO₂-Kosten zwischen Vermieter und Mieter aufteilen " +
      "(CO2KostAufG).",
  },
  {
    icon: MessageSquareText,
    title: "Assistent & Fachbegriffe",
    href: "/funktionen/kommunikation#assistent",
    text:
      "Fragen zur eigenen WEG in normalem Deutsch stellen – geantwortet wird " +
      "nur aus den Daten, die Sie sehen dürfen. Fachbegriffe erklären sich per " +
      "Klick an Ort und Stelle.",
  },
  {
    icon: Wrench,
    title: "Schäden & Handwerker",
    href: "/funktionen/kommunikation#schaeden",
    text:
      "Schäden mit Fotos melden, Vorgänge verfolgen und Handwerker direkt " +
      "beauftragen – inklusive Foto-Dokumentation der Ausführung.",
  },
  {
    icon: Megaphone,
    title: "Dokumente, Aushänge & Zugänge",
    href: "/funktionen/kommunikation#dokumente",
    text:
      "Protokolle, Abrechnungen und Verträge zentral ablegen, Aushänge digital " +
      "veröffentlichen – jede Rolle sieht genau das, was sie betrifft.",
  },
];

const steps = [
  {
    title: "Kostenlos registrieren",
    text:
      "Konto als selbstverwaltende WEG anlegen – in wenigen Minuten, ohne " +
      "Zahlungsdaten.",
  },
  {
    title: "WEG einrichten",
    text:
      "Einheiten mit Miteigentumsanteilen, Konten und Kostenarten anlegen. Der " +
      "Standardkatalog und die Assistenten führen Schritt für Schritt durch.",
  },
  {
    title: "Eigentümer einladen",
    text:
      "Alle Miteigentümer erhalten einen eigenen Zugang und sehen Dokumente, " +
      "Abrechnungen und Beschlüsse jederzeit selbst ein.",
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
      <MarketingHeader />

      {/* ── Full-Bleed-Hero: das Haus füllt die Bühne, der Text liegt darauf ── */}
      <section id="inhalt" className="relative flex min-h-[86vh] items-center overflow-hidden">
        <KenBurnsBackdrop
          src="/images/marketing/hero-building.jpg"
          alt="Mehrfamilienhaus einer Wohnungseigentümergemeinschaft"
          preload
        />
        <div className="absolute inset-0 bg-gradient-to-r from-wp-ink/95 via-wp-ink/70 to-wp-ink/20" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-wp-ink/60 to-transparent" />

        <div className="relative mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
          <div className="max-w-2xl animate-page-in">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-white backdrop-blur-sm">
              <ShieldCheck className="h-3.5 w-3.5" />
              Für Eigentümer in kleinen Wohnungseigentümergemeinschaften
            </p>
            <h1 className="text-balance text-4xl font-extrabold leading-tight text-white sm:text-6xl">
              Keine Hausverwaltung gefunden?{" "}
              <span className="underline decoration-wp-accent-bright decoration-4 underline-offset-8">
                Verwalten Sie Ihre WEG selbst.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg">
              Immer mehr kleine Eigentümergemeinschaften bekommen schlicht keinen
              Verwalter mehr – die Pflichten aus dem WEG-Gesetz bleiben trotzdem.
              Dieses Portal gibt Ihnen alles an die Hand, um Ihre Gemeinschaft
              einfach, gemeinsam und rechtssicher selbst zu verwalten.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/registrieren" className={`${wpButtonClass} px-6 py-3 text-base`}>
                Portal kostenlos einrichten
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/login" className={`${buttonOnPhotoClass} px-6 py-3 text-base`}>
                Ich habe schon einen Zugang
              </Link>
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-white/75">
              {["Kostenlos starten", "Keine Zahlungsdaten nötig", "In wenigen Minuten einsatzbereit"].map(
                (item) => (
                  <li key={item} className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-wp-accent-bright" />
                    {item}
                  </li>
                ),
              )}
            </ul>
          </div>
        </div>

        {/* Schwebende Kennzahl-Karte als Brücke zum Produkt */}
        <div
          className="absolute bottom-10 right-6 hidden items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-gray-800 shadow-e3 md:flex lg:right-12"
          style={{ animation: "mkPopIn 0.5s cubic-bezier(0.34,1.56,0.64,1) both", animationDelay: "600ms" }}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-wp-accent-light">
            <Building2 className="h-4 w-4 text-wp-accent-ink" />
          </span>
          6 Einheiten · MEA 1000/1000 ✓
        </div>
      </section>

      {/* ── Scrollytelling: Selbstverwaltung Stockwerk für Stockwerk aufbauen ── */}
      <ScrollyBuild />

      {/* ── Das Problem ── */}
      <section className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <Reveal>
          <h2 className="text-balance text-2xl font-bold text-wp-ink sm:text-3xl">
            Das Problem: Kleine WEGs finden keinen Verwalter
          </h2>
          <p className="mt-3 max-w-2xl text-gray-600">
            Der Verwaltermangel trifft vor allem kleine Häuser. Wer eine
            Eigentumswohnung in einer Gemeinschaft mit wenigen Einheiten besitzt,
            kennt das:
          </p>
        </Reveal>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {problems.map(({ icon: Icon, title, text }, i) => (
            <Reveal key={title} delay={i * 120}>
              <div className="h-full rounded-2xl border border-gray-200 bg-white p-6 shadow-e1">
                <Icon className="h-8 w-8 text-wp-accent-ink" />
                <h3 className="mt-4 text-lg font-semibold text-gray-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Foto-Band: atmosphärischer Zwischenschnitt ── */}
      <PhotoBand
        src="/images/marketing/versammlung.jpg"
        alt="Eigentümer sitzen gemeinsam am Tisch einer Versammlung"
        claim="Gemeinsam entscheiden. Gemeinsam verwalten."
        sub="Ihre Gemeinschaft kennt ihr Haus besser als jeder externe Verwalter – das Portal gibt ihr das Handwerkszeug dazu."
      />

      {/* ── Die Lösung ── */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-16 sm:px-6">
        <Reveal>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-e2 sm:p-10">
            <h2 className="text-2xl font-bold text-wp-primary sm:text-3xl">
              Die Lösung: Selbstverwaltung mit System
            </h2>
            <p className="mt-3 max-w-3xl text-gray-600">
              Alles, was Ihre WEG braucht, in einem Portal – gebaut für Eigentümer,
              nicht für Verwaltungsprofis. Jede Funktion hat eine eigene Seite mit
              ausführlicher Erklärung – klicken Sie sich durch.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ icon: Icon, title, text, href }) => (
                <Link
                  key={title}
                  href={href}
                  className="group flex items-start gap-3 rounded-xl border border-transparent p-3 transition-colors hover:border-wp-accent-ink/30 hover:bg-wp-accent-light/40"
                >
                  <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-wp-accent-light">
                    <Icon className="h-5 w-5 text-wp-accent-ink" />
                  </span>
                  <span>
                    <span className="font-semibold text-gray-900">{title}</span>
                    <span className="mt-1 block text-sm leading-relaxed text-gray-600">
                      {text}
                    </span>
                    <span className="mt-1.5 inline-flex items-center gap-1 text-sm font-medium text-wp-accent-ink">
                      Mehr erfahren
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── Auf einen Blick: nüchterne Produkt-Fakten ── */}
      <div className="mt-20">
        <StatsBand />
      </div>

      {/* ── Rechtlicher Rahmen ── */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-16 sm:px-6">
        <Reveal>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-e1 sm:p-8">
            <div className="flex items-start gap-4">
              <Scale className="mt-1 h-8 w-8 shrink-0 text-wp-accent-ink" />
              <div>
                <h2 className="text-xl font-bold text-wp-ink sm:text-2xl">
                  Dürfen wir das überhaupt selbst?
                </h2>
                <p className="mt-3 max-w-3xl leading-relaxed text-gray-700">
                  Ja. Keine WEG ist verpflichtet, eine externe Hausverwaltung zu
                  beauftragen. Übernimmt ein Miteigentümer das Verwalteramt, braucht
                  er in Gemeinschaften mit weniger als neun Sondereigentumsrechten
                  keine Zertifizierung (§ 19 Abs. 2 Nr. 6 WEG) – solange nicht ein
                  Drittel der Eigentümer einen zertifizierten Verwalter verlangt.
                  Genau für diese Gemeinschaften ist dieses Portal gemacht.{" "}
                  <Link href="/so-funktionierts" className="font-medium text-wp-accent-ink hover:underline">
                    Mehr zum rechtlichen Rahmen →
                  </Link>
                </p>
                <p className="mt-3 text-xs text-gray-500">
                  Hinweis: allgemeine Information, keine Rechtsberatung.
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── So funktioniert's ── */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-16 sm:px-6">
        <Reveal>
          <h2 className="text-balance text-2xl font-bold text-wp-ink sm:text-3xl">
            In drei Schritten startklar
          </h2>
        </Reveal>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {steps.map(({ title, text }, i) => (
            <Reveal key={title} delay={i * 120}>
              <div className="h-full rounded-2xl border border-gray-200 bg-white p-6 shadow-e1">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-wp-accent font-display text-base font-bold text-wp-on-accent">
                  {i + 1}
                </span>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{text}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={200}>
          <p className="mt-6 text-gray-600">
            <Link
              href="/so-funktionierts"
              className="inline-flex items-center gap-1.5 font-medium text-wp-accent-ink hover:underline"
            >
              Alle fünf Einrichtungsschritte im Detail ansehen
              <ArrowRight className="h-4 w-4" />
            </Link>
          </p>
        </Reveal>
      </section>

      <CtaBand
        title="Bereit, Ihre WEG selbst in die Hand zu nehmen?"
        text="Richten Sie das Portal für Ihre Gemeinschaft ein und laden Sie Ihre Miteigentümer ein – kostenlos und unverbindlich."
      />
      <MarketingFooter />
    </main>
  );
}
