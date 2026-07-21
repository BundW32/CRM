import Link from "next/link";
import {
  Building2,
  Wrench,
  Users,
  FileText,
  MessageSquareText,
  BarChart3,
  ShieldCheck,
  Sparkles,
  Vote,
  ArrowRight,
} from "lucide-react";
import { BwLogo } from "@/components/logo";
import { Reveal } from "@/components/reveal";
import { MarketingHeroBackdrop } from "@/components/marketing-hero";
import { InViewCountUp } from "@/components/in-view-count-up";

const roles = [
  {
    icon: Users,
    title: "Mieter",
    text: "Schäden mit Foto melden, Status live verfolgen, Dokumente und Aushänge jederzeit griffbereit.",
  },
  {
    icon: Building2,
    title: "Eigentümer",
    text: "Vorgänge der eigenen Objekte im Blick, Vermietungsquote und Statistiken auf einen Blick.",
  },
  {
    icon: ShieldCheck,
    title: "Verwaltung",
    text: "Vorgänge steuern, Objekte & Nutzer verwalten, WEG-Finanzen und Beschlüsse zentral abbilden.",
  },
  {
    icon: Wrench,
    title: "Handwerker",
    text: "Nur die eigenen Aufträge sehen, Arbeit dokumentieren, Status direkt aus dem Feld melden.",
  },
];

const features = [
  {
    icon: FileText,
    title: "Dokumente & Aushänge",
    text: "Zielgruppengenau sichtbar, jederzeit abrufbar – Schluss mit verstreuten E-Mail-Anhängen.",
  },
  {
    icon: MessageSquareText,
    title: "Nachrichten & Benachrichtigungen",
    text: "Ein Vorgang, ein Verlauf. Automatische E-Mails bei Statuswechsel, Antwort oder Zuweisung.",
  },
  {
    icon: Vote,
    title: "WEG-Finanzen & Beschlüsse",
    text: "Wirtschaftspläne, Jahresabrechnungen, Sonderumlagen und Versammlungen strukturiert erfasst.",
  },
  {
    icon: BarChart3,
    title: "Statistiken in Echtzeit",
    text: "Bearbeitungszeiten, Vermietungsquote und Vorgänge nach Status – ohne manuelle Auswertung.",
  },
  {
    icon: Sparkles,
    title: "KI-Assistent",
    text: "Rollenbewusster Assistent hilft bei der Bedienung und beantwortet Fragen zum eigenen Objekt.",
  },
  {
    icon: ShieldCheck,
    title: "Sicher & DSGVO-konform",
    text: "Signierte Sessions, verschlüsselte Uploads, feingranulare Berechtigungen je Rolle.",
  },
];

const steps = [
  {
    n: "01",
    title: "Kostenlos registrieren",
    text: "Konto für Ihre Hausverwaltung oder selbstverwaltende WEG in wenigen Minuten anlegen.",
  },
  {
    n: "02",
    title: "Objekte & Nutzer anlegen",
    text: "Einheiten, Eigentümer, Mieter und Handwerker einrichten – Zugänge werden automatisch versendet.",
  },
  {
    n: "03",
    title: "Portal live nehmen",
    text: "Alle Beteiligten kommunizieren, melden und dokumentieren ab sofort an einem zentralen Ort.",
  },
];

const stats = [
  { value: 4, suffix: "", label: "Rollen in einem Portal" },
  { value: 100, suffix: "%", label: "DSGVO-konform" },
  { value: 24, suffix: "/7", label: "Zugriff für alle Beteiligten" },
];

export function MarketingLanding() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-x-clip text-gray-100">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-shell/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <BwLogo className="h-9 w-auto sm:h-10" />
          <nav className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/login"
              className="hidden rounded-lg px-3 py-2 text-sm font-medium text-gray-300 transition hover:text-white sm:inline-flex"
            >
              Anmelden
            </Link>
            <Link
              href="/registrieren"
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-orange px-4 py-2 text-sm font-semibold text-brand-green-dark shadow-e1 transition-all hover:bg-brand-orange-dark hover:shadow-e2 active:scale-[0.98]"
            >
              Kostenlos starten
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="relative isolate flex min-h-[88vh] flex-col items-center justify-center px-4 pt-10 pb-24 text-center sm:px-6">
        <MarketingHeroBackdrop />
        <div className="relative z-10 mx-auto max-w-3xl animate-page-in">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium tracking-wide text-brand-orange uppercase">
            <Sparkles className="h-3.5 w-3.5" />
            Kundenportal für die Immobilienverwaltung
          </span>
          <h1 className="text-balance text-4xl leading-[1.08] font-extrabold tracking-tight text-white sm:text-6xl">
            Ihre Immobilienverwaltung,
            <br />
            <span className="bg-gradient-to-r from-brand-orange to-orange-300 bg-clip-text text-transparent">
              digital an einem Ort
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-balance text-base leading-relaxed text-gray-300 sm:text-lg">
            Mieter, Eigentümer, Verwaltung und Handwerker arbeiten in einem Portal:
            Vorgänge, Dokumente, WEG-Finanzen und Kommunikation – transparent und
            in Echtzeit.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/registrieren"
              className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-orange px-6 py-3.5 text-sm font-semibold text-brand-green-dark shadow-e2 transition-all hover:bg-brand-orange-dark hover:shadow-e3 active:scale-[0.98] sm:w-auto"
            >
              Kostenlos registrieren
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white transition-all hover:border-white/30 hover:bg-white/10 sm:w-auto"
            >
              Anmelden
            </Link>
          </div>
        </div>

        {/* Scroll-Indikator */}
        <div className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2 animate-bounce">
          <div className="h-9 w-5 rounded-full border border-white/25 p-1">
            <div className="h-1.5 w-full rounded-full bg-brand-orange" />
          </div>
        </div>
      </section>

      {/* ── Stats ──────────────────────────────────────────────── */}
      <section className="relative z-10 border-y border-white/5 bg-shell-2/60 px-4 py-12 sm:px-6">
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 text-center sm:grid-cols-3">
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 100}>
              <p className="font-display text-4xl font-extrabold text-white sm:text-5xl">
                <InViewCountUp value={s.value} />
                {s.suffix}
              </p>
              <p className="mt-2 text-sm text-gray-400">{s.label}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Rollen ─────────────────────────────────────────────── */}
      <section className="relative z-10 px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              Für jede Rolle die passende Ansicht
            </h2>
            <p className="mt-4 text-gray-400">
              Jeder Beteiligte sieht nur, was ihn betrifft – klar strukturiert und
              ohne Suchen.
            </p>
          </Reveal>
          <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {roles.map((r, i) => (
              <Reveal key={r.title} delay={i * 90}>
                <div className="group h-full rounded-2xl border border-white/10 bg-shell-2 p-6 shadow-e1 transition-all duration-300 hover:-translate-y-1.5 hover:border-brand-orange/40 hover:shadow-e3">
                  <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-orange/15 text-brand-orange transition-transform duration-300 group-hover:scale-110">
                    <r.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-semibold text-white">{r.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-400">{r.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────── */}
      <section className="relative z-10 border-t border-white/5 bg-shell-2/40 px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              Alles, was Ihr Portal braucht
            </h2>
            <p className="mt-4 text-gray-400">
              Von der Schadensmeldung bis zur Jahresabrechnung – ohne Medienbrüche.
            </p>
          </Reveal>
          <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 90}>
                <div className="h-full rounded-2xl border border-white/10 bg-shell p-6 transition-colors duration-300 hover:border-white/20">
                  <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-green/60 text-brand-orange">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-sm font-semibold text-white">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-400">{f.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── So funktioniert's ──────────────────────────────────── */}
      <section className="relative z-10 px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">In drei Schritten startklar</h2>
          </Reveal>
          <div className="relative mt-16">
            <div
              className="absolute top-6 left-6 hidden h-[calc(100%-3rem)] w-px bg-gradient-to-b from-brand-orange/50 via-white/15 to-transparent sm:block"
              aria-hidden="true"
            />
            <ol className="space-y-10">
              {steps.map((s, i) => (
                <Reveal key={s.n} delay={i * 120}>
                  <li className="relative flex gap-5 pl-0 sm:pl-0">
                    <span className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-brand-orange/40 bg-shell-2 font-display text-sm font-bold text-brand-orange">
                      {s.n}
                    </span>
                    <div className="pt-1.5">
                      <h3 className="text-lg font-semibold text-white">{s.title}</h3>
                      <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-gray-400">{s.text}</p>
                    </div>
                  </li>
                </Reveal>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────── */}
      <section className="relative z-10 px-4 pb-24 sm:px-6">
        <Reveal className="mx-auto max-w-4xl">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-brand-green via-brand-green to-brand-green-dark px-6 py-14 text-center shadow-e3 sm:px-16">
            <div
              className="pointer-events-none absolute -top-16 -right-16 h-72 w-72 rounded-full bg-brand-orange/25 blur-[90px]"
              aria-hidden="true"
            />
            <h2 className="relative text-3xl font-bold text-white sm:text-4xl">
              Bereit für ein digitales Portal?
            </h2>
            <p className="relative mx-auto mt-4 max-w-xl text-gray-200">
              Für Hausverwaltungen und selbstverwaltende WEGs – kostenlos anlegen,
              in Minuten startklar.
            </p>
            <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/registrieren"
                className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-orange px-6 py-3.5 text-sm font-semibold text-brand-green-dark shadow-e2 transition-all hover:bg-brand-orange-dark active:scale-[0.98] sm:w-auto"
              >
                Jetzt kostenlos starten
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-white/10 sm:w-auto"
              >
                Ich habe bereits ein Konto
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-white/5 px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-gray-500 sm:flex-row">
          <p>&copy; {new Date().getFullYear()} B&amp;W Immobilien Management UG</p>
          <div className="flex items-center gap-5">
            <Link href="/impressum" className="hover:text-gray-300">Impressum</Link>
            <Link href="/datenschutz" className="hover:text-gray-300">Datenschutz</Link>
            <Link href="/agb" className="hover:text-gray-300">AGB</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
