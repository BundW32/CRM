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
  HandCoins,
  Landmark,
  Megaphone,
  PiggyBank,
  Scale,
  ShieldCheck,
  Users,
  Vote,
  Wrench,
} from "lucide-react";
import { buttonClass, buttonSecondaryClass } from "@/components/ui";
import {
  CtaBand,
  MarketingFooter,
  MarketingHeader,
  StatsBand,
} from "@/components/marketing/site";
import { PhotoHero } from "@/components/marketing/photo-hero";
import { Reveal } from "@/components/marketing/reveal";
import { ScrollyBuild } from "@/components/marketing/scrolly-build";
import { getUser } from "@/lib/session";
import { getTenantOrg } from "@/lib/tenant";

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
      "Rückstandsliste je Einheit (Soll/Ist/Saldo), Zahlungseingänge bequem " +
      "zuordnen und Mahnungen als fertige DIN-A4-Briefe erzeugen.",
  },
  {
    icon: Landmark,
    title: "Buchhaltung mit Bankimport",
    href: "/funktionen/finanzen#buchhaltung",
    text:
      "Buchungen mit Beleg-Upload, CSV-Import vom Bankkonto (z. B. Sparkasse, " +
      "Volksbank) mit Duplikaterkennung – ganz ohne API-Schlüssel.",
  },
  {
    icon: PiggyBank,
    title: "Erhaltungsrücklage strikt getrennt",
    href: "/funktionen/finanzen#ruecklage",
    text:
      "Girokonto und Rücklage getrennt geführt, Umbuchungen sauber " +
      "dokumentiert – wie es ordnungsmäßiger Verwaltung entspricht.",
  },
  {
    icon: Vote,
    title: "Versammlung & Beschlüsse",
    href: "/funktionen/versammlung",
    text:
      "Versammlungen vorbereiten, Anwesenheit erfassen, nach " +
      "Miteigentumsanteilen abstimmen und Beschlüsse dauerhaft dokumentieren.",
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
    title: "Dokumente & Aushänge",
    href: "/funktionen/kommunikation#dokumente",
    text:
      "Protokolle, Abrechnungen und Verträge zentral ablegen, Aushänge digital " +
      "veröffentlichen – jeder sieht genau das, was ihn betrifft.",
  },
  {
    icon: Users,
    title: "Eigener Zugang für alle",
    href: "/funktionen/kommunikation#rollen",
    text:
      "Rollen für Eigentümer, Verwaltung, Beirat, Mieter und Handwerker – " +
      "jeder mit eigenem Login, auch bequem am Handy.",
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
  if (user) redirect("/dashboard");

  // Auf Mandanten-Subdomains bleibt der gebrandete Login der Einstieg –
  // die B&W-Startseite gehört nur auf die Hauptdomain.
  if (await getTenantOrg()) redirect("/login");

  return (
    <main className="mk-light flex-1">
      <MarketingHeader />

      {/* ── Hero: Problem und Versprechen ── */}
      <section id="inhalt" className="mx-auto w-full max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20">
        <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="animate-page-in">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand-orange/50 bg-brand-orange-light px-3 py-1 text-xs font-semibold tracking-wide text-brand-orange-ink">
              <ShieldCheck className="h-3.5 w-3.5" />
              Für Eigentümer in kleinen Wohnungseigentümergemeinschaften
            </p>
            <h1 className="text-balance text-4xl font-extrabold leading-tight text-brand-green-dark sm:text-5xl">
              Keine Hausverwaltung gefunden?{" "}
              <span className="underline decoration-brand-orange decoration-4 underline-offset-8">
                Verwalten Sie Ihre WEG selbst.
              </span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-gray-600 sm:text-lg">
              Immer mehr kleine Eigentümergemeinschaften bekommen schlicht keinen
              Verwalter mehr – die Pflichten aus dem WEG-Gesetz bleiben trotzdem.
              Dieses Portal gibt Ihnen alles an die Hand, um Ihre Gemeinschaft
              einfach, gemeinsam und rechtssicher selbst zu verwalten.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/registrieren" className={`${buttonClass} px-6 py-3 text-base`}>
                Portal kostenlos einrichten
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/login" className={`${buttonSecondaryClass} px-6 py-3 text-base`}>
                Ich habe schon einen Zugang
              </Link>
            </div>
            <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-gray-600">
              {["Kostenlos starten", "Keine Zahlungsdaten nötig", "In wenigen Minuten einsatzbereit"].map(
                (item) => (
                  <li key={item} className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-brand-orange-ink" />
                    {item}
                  </li>
                ),
              )}
            </ul>
          </div>
          <div className="hidden animate-page-in lg:block">
            <PhotoHero
              src="/images/marketing/hero-building.jpg"
              alt="Mehrfamilienhaus einer Wohnungseigentümergemeinschaft"
              preload
              badge={{ icon: <Building2 className="h-4 w-4 text-brand-orange-ink" />, text: "6 Einheiten · MEA 1000/1000 ✓" }}
            />
          </div>
        </div>
      </section>

      {/* ── Scrollytelling: Selbstverwaltung Stockwerk für Stockwerk aufbauen ── */}
      <ScrollyBuild />

      {/* ── Das Problem ── */}
      <section className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <Reveal>
          <h2 className="text-balance text-2xl font-bold text-brand-green-dark sm:text-3xl">
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
                <Icon className="h-8 w-8 text-brand-orange-ink" />
                <h3 className="mt-4 text-lg font-semibold text-gray-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Die Lösung ── */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-16 sm:px-6">
        <Reveal>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-e2 sm:p-10">
            <h2 className="text-2xl font-bold text-brand-green sm:text-3xl">
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
                  className="group flex items-start gap-3 rounded-xl border border-transparent p-3 transition-colors hover:border-brand-orange/30 hover:bg-brand-orange-light/40"
                >
                  <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-orange-light">
                    <Icon className="h-5 w-5 text-brand-orange-ink" />
                  </span>
                  <span>
                    <span className="font-semibold text-gray-900">{title}</span>
                    <span className="mt-1 block text-sm leading-relaxed text-gray-600">
                      {text}
                    </span>
                    <span className="mt-1.5 inline-flex items-center gap-1 text-sm font-medium text-brand-orange-ink">
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
              <Scale className="mt-1 h-8 w-8 shrink-0 text-brand-orange-ink" />
              <div>
                <h2 className="text-xl font-bold text-brand-green-dark sm:text-2xl">
                  Dürfen wir das überhaupt selbst?
                </h2>
                <p className="mt-3 max-w-3xl leading-relaxed text-gray-700">
                  Ja. Keine WEG ist verpflichtet, eine externe Hausverwaltung zu
                  beauftragen. Übernimmt ein Miteigentümer das Verwalteramt, braucht
                  er in Gemeinschaften mit weniger als neun Sondereigentumsrechten
                  keine Zertifizierung (§ 19 Abs. 2 Nr. 6 WEG) – solange nicht ein
                  Drittel der Eigentümer einen zertifizierten Verwalter verlangt.
                  Genau für diese Gemeinschaften ist dieses Portal gemacht.{" "}
                  <Link href="/so-funktionierts" className="font-medium text-brand-orange-ink hover:underline">
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
          <h2 className="text-balance text-2xl font-bold text-brand-green-dark sm:text-3xl">
            In drei Schritten startklar
          </h2>
        </Reveal>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {steps.map(({ title, text }, i) => (
            <Reveal key={title} delay={i * 120}>
              <div className="h-full rounded-2xl border border-gray-200 bg-white p-6 shadow-e1">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-orange font-display text-base font-bold text-brand-green-dark">
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
              className="inline-flex items-center gap-1.5 font-medium text-brand-orange-ink hover:underline"
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
