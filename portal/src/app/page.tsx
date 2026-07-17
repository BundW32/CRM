// Öffentliche Startseite (nur Hauptdomain): erklärt das Problem des
// Verwaltermangels bei kleinen WEGs und stellt das Portal als Lösung zur
// Selbstverwaltung vor. Angemeldete Nutzer landen weiter direkt im Dashboard,
// Mandanten-Subdomains behalten ihren gebrandeten Login als Einstieg.
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
import { buttonClass, buttonOutlineClass } from "@/components/ui";
import { BwLogoCompact } from "@/components/logo";
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

const features = [
  {
    icon: CalendarCheck,
    title: "Wirtschaftsplan (§ 28 WEG)",
    text:
      "Assistent mit Vorjahres-Istwerten, Einzelwirtschaftspläne je Einheit nach " +
      "Umlageschlüsseln und fertige Beschlussvorlage. Der Beschluss erzeugt " +
      "automatisch die monatlichen Hausgeld-Sollstellungen – centgenau.",
  },
  {
    icon: FileCheck,
    title: "Jahresabrechnung & Vermögensbericht",
    text:
      "Gesamt- und Einzelabrechnungen mit harter Kontenprüfung, Abrechnungsspitze, " +
      "§ 35a-Ausweis je Einheit und tagesgenauer Aufteilung bei Eigentümerwechsel. " +
      "Fertigstellen friert das Ergebnis revisionssicher ein.",
  },
  {
    icon: HandCoins,
    title: "Hausgeld & Mahnwesen",
    text:
      "Rückstandsliste je Einheit (Soll/Ist/Saldo), Zahlungseingänge bequem " +
      "zuordnen und bei Rückständen Zahlungserinnerung und Mahnungen als fertige " +
      "DIN-A4-Briefe erzeugen.",
  },
  {
    icon: Landmark,
    title: "Buchhaltung mit Bankimport",
    text:
      "Buchungen mit Beleg-Upload, CSV-Import vom Bankkonto (z. B. Sparkasse, " +
      "Volksbank) mit Duplikaterkennung – ganz ohne API-Schlüssel oder " +
      "Zusatzkosten.",
  },
  {
    icon: PiggyBank,
    title: "Erhaltungsrücklage strikt getrennt",
    text:
      "Girokonto und Rücklage werden getrennt geführt, Umbuchungen sauber " +
      "dokumentiert – so, wie es ordnungsmäßiger Verwaltung entspricht.",
  },
  {
    icon: Vote,
    title: "Versammlung & Beschlüsse",
    text:
      "Eigentümerversammlungen vorbereiten, Anwesenheit erfassen, nach " +
      "Miteigentumsanteilen abstimmen und Beschlüsse dauerhaft in der " +
      "Beschluss-Sammlung dokumentieren.",
  },
  {
    icon: Wrench,
    title: "Schäden & Handwerker",
    text:
      "Schäden mit Fotos melden, Vorgänge verfolgen und Handwerker direkt " +
      "beauftragen – die dokumentieren die Ausführung ebenfalls mit Fotos.",
  },
  {
    icon: Megaphone,
    title: "Dokumente & Aushänge",
    text:
      "Protokolle, Abrechnungen und Verträge zentral ablegen, Aushänge digital " +
      "veröffentlichen – jeder Eigentümer sieht genau das, was ihn betrifft.",
  },
  {
    icon: Users,
    title: "Eigener Zugang für alle",
    text:
      "Rollen für Eigentümer, Verwaltung, Beirat, Mieter und Handwerker. Jeder " +
      "meldet sich mit eigenem Zugang an – auch bequem am Handy.",
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
    <main className="flex-1">
      {/* ── Kopfzeile ── */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 pt-6 sm:px-6">
        <div className="rounded-2xl border border-white/10 bg-white/95 px-3 py-2 shadow-xl shadow-black/20">
          <BwLogoCompact className="h-9 w-auto" />
        </div>
        <nav className="flex items-center gap-2 sm:gap-3">
          <Link href="/login" className={buttonOutlineClass}>
            Anmelden
          </Link>
          <Link href="/registrieren" className={`${buttonClass} hidden sm:inline-flex`}>
            Kostenlos starten
          </Link>
        </nav>
      </header>

      {/* ── Hero: Problem und Versprechen ── */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20">
        <div className="max-w-3xl animate-page-in">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-orange/40 bg-brand-orange/10 px-3 py-1 text-xs font-semibold text-brand-orange">
            <ShieldCheck className="h-3.5 w-3.5" />
            Für Eigentümer in kleinen Wohnungseigentümergemeinschaften
          </p>
          <h1 className="text-4xl font-extrabold leading-tight text-white sm:text-5xl">
            Keine Hausverwaltung gefunden?{" "}
            <span className="text-brand-orange">Verwalten Sie Ihre WEG selbst.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-gray-300 sm:text-lg">
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
            <Link href="/login" className={`${buttonOutlineClass} px-6 py-3 text-base`}>
              Ich habe schon einen Zugang
            </Link>
          </div>
          <p className="mt-4 text-sm text-gray-400">
            Kostenlos starten · keine Zahlungsdaten nötig · in wenigen Minuten einsatzbereit
          </p>
        </div>
      </section>

      {/* ── Das Problem ── */}
      <section className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <h2 className="text-2xl font-bold text-white sm:text-3xl">
          Das Problem: Kleine WEGs finden keinen Verwalter
        </h2>
        <p className="mt-3 max-w-2xl text-gray-300">
          Der Verwaltermangel trifft vor allem kleine Häuser. Wer eine
          Eigentumswohnung in einer Gemeinschaft mit wenigen Einheiten besitzt,
          kennt das:
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {problems.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="rounded-2xl border border-white/10 bg-white/5 p-6"
            >
              <Icon className="h-8 w-8 text-brand-orange" />
              <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-300">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Die Lösung ── */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-16 sm:px-6">
        <div className="rounded-2xl border border-white/10 bg-white p-6 shadow-2xl shadow-black/30 sm:p-10">
          <h2 className="text-2xl font-bold text-brand-green sm:text-3xl">
            Die Lösung: Selbstverwaltung mit System
          </h2>
          <p className="mt-3 max-w-3xl text-gray-600">
            Alles, was Ihre WEG braucht, in einem Portal – gebaut für Eigentümer,
            nicht für Verwaltungsprofis. Von der ersten Buchung bis zur fertigen
            Jahresabrechnung führen Assistenten durch jeden Schritt.
          </p>
          <div className="mt-8 grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-orange-light">
                  <Icon className="h-5 w-5 text-brand-orange-ink" />
                </span>
                <div>
                  <h3 className="font-semibold text-gray-900">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-gray-600">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Rechtlicher Rahmen ── */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-16 sm:px-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <Scale className="mt-1 h-8 w-8 shrink-0 text-brand-orange" />
            <div>
              <h2 className="text-xl font-bold text-white sm:text-2xl">
                Dürfen wir das überhaupt selbst?
              </h2>
              <p className="mt-3 max-w-3xl leading-relaxed text-gray-300">
                Ja. Keine WEG ist verpflichtet, eine externe Hausverwaltung zu
                beauftragen. Übernimmt ein Miteigentümer das Verwalteramt, braucht
                er in Gemeinschaften mit weniger als neun Sondereigentumsrechten
                keine Zertifizierung (§ 19 Abs. 2 Nr. 6 WEG) – solange nicht ein
                Drittel der Eigentümer einen zertifizierten Verwalter verlangt.
                Genau für diese Gemeinschaften ist dieses Portal gemacht.
              </p>
              <p className="mt-3 text-xs text-gray-400">
                Hinweis: allgemeine Information, keine Rechtsberatung.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── So funktioniert's ── */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-16 sm:px-6">
        <h2 className="text-2xl font-bold text-white sm:text-3xl">
          In drei Schritten startklar
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {steps.map(({ title, text }, i) => (
            <div
              key={title}
              className="rounded-2xl border border-white/10 bg-white/5 p-6"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-orange font-display text-base font-bold text-brand-green-dark">
                {i + 1}
              </span>
              <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-300">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Abschluss-CTA ── */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <div className="rounded-2xl border border-brand-orange/30 bg-gradient-to-br from-brand-orange/15 to-transparent p-8 text-center sm:p-12">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Bereit, Ihre WEG selbst in die Hand zu nehmen?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-gray-300">
            Richten Sie das Portal für Ihre Gemeinschaft ein und laden Sie Ihre
            Miteigentümer ein – kostenlos und unverbindlich.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link href="/registrieren" className={`${buttonClass} px-6 py-3 text-base`}>
              Jetzt kostenlos starten
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <p className="mt-5 inline-flex items-center gap-1.5 text-sm text-gray-400">
            <CheckCircle2 className="h-4 w-4 text-brand-orange" />
            Fragen vorab? Schreiben Sie an{" "}
            <a href="mailto:info@bundwimmobilien.de" className="text-brand-orange hover:underline">
              info@bundwimmobilien.de
            </a>
          </p>
        </div>
      </section>

      {/* ── Fußzeile ── */}
      <footer className="border-t border-white/10">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-gray-400 sm:px-6">
          <p>© {new Date().getFullYear()} B&amp;W Immobilien Management UG</p>
          <p className="flex gap-3">
            <Link href="/impressum" className="hover:underline">
              Impressum
            </Link>
            <Link href="/datenschutz" className="hover:underline">
              Datenschutz
            </Link>
            <Link href="/agb" className="hover:underline">
              AGB
            </Link>
            <Link href="/login" className="hover:underline">
              Anmelden
            </Link>
          </p>
        </div>
      </footer>
    </main>
  );
}
