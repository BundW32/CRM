// Gemeinsame Bausteine der öffentlichen Marketing-Seiten (Hauptdomain):
// Kopfzeile mit Navigation, Fußzeile, Abschnitts-Raster und CTA-Band.
// Die Seiten selbst liegen unter / , /funktionen/* und /so-funktionierts.
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";
import { buttonClass, buttonOutlineClass } from "@/components/ui";
import { BwLogoCompact } from "@/components/logo";
import { Reveal } from "./reveal";

const navItems = [
  { href: "/funktionen/finanzen", label: "Finanzen" },
  { href: "/funktionen/hausgeld", label: "Hausgeld" },
  { href: "/funktionen/versammlung", label: "Versammlung" },
  { href: "/funktionen/kommunikation", label: "Kommunikation" },
  { href: "/so-funktionierts", label: "So funktioniert’s" },
] as const;

export function MarketingHeader({ active }: { active?: string }) {
  return (
    <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 pt-6 sm:px-6">
      <Link
        href="/"
        className="rounded-2xl border border-white/10 bg-white/95 px-3 py-2 shadow-xl shadow-black/20"
        aria-label="Zur Startseite"
      >
        <BwLogoCompact className="h-9 w-auto" />
      </Link>
      <nav className="order-3 flex w-full flex-wrap items-center gap-x-4 gap-y-1 text-sm lg:order-none lg:w-auto">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={
              active === item.href
                ? "font-semibold text-brand-orange"
                : "text-gray-300 transition-colors hover:text-white"
            }
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="flex items-center gap-2 sm:gap-3">
        <Link href="/login" className={buttonOutlineClass}>
          Anmelden
        </Link>
        <Link href="/registrieren" className={`${buttonClass} hidden sm:inline-flex`}>
          Kostenlos starten
        </Link>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-white/10">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-gray-400 sm:px-6">
        <p>© {new Date().getFullYear()} B&amp;W Immobilien Management UG</p>
        <p className="flex flex-wrap gap-3">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="hover:underline">
              {item.label}
            </Link>
          ))}
          <Link href="/impressum" className="hover:underline">
            Impressum
          </Link>
          <Link href="/datenschutz" className="hover:underline">
            Datenschutz
          </Link>
          <Link href="/agb" className="hover:underline">
            AGB
          </Link>
        </p>
      </div>
    </footer>
  );
}

// Hero-Kopf einer Unterseite: Eyebrow, Titel, Intro und optional eine
// bewegte Illustration rechts daneben.
export function MarketingHero({
  eyebrow,
  title,
  intro,
  visual,
  showSecondaryCta = true,
}: {
  eyebrow: string;
  title: ReactNode;
  intro: string;
  visual?: ReactNode;
  // Ausblenden, wenn die Seite selbst /so-funktionierts ist
  showSecondaryCta?: boolean;
}) {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-4 pt-12 sm:px-6 sm:pt-16">
      <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="animate-page-in">
          <p className="mb-4 inline-flex rounded-full border border-brand-orange/40 bg-brand-orange/10 px-3 py-1 text-xs font-semibold text-brand-orange">
            {eyebrow}
          </p>
          <h1 className="text-3xl font-extrabold leading-tight text-white sm:text-4xl lg:text-5xl">
            {title}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-gray-300 sm:text-lg">
            {intro}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/registrieren" className={`${buttonClass} px-5 py-2.5`}>
              Kostenlos starten
              <ArrowRight className="h-4 w-4" />
            </Link>
            {showSecondaryCta ? (
              <Link href="/so-funktionierts" className={`${buttonOutlineClass} px-5 py-2.5`}>
                So funktioniert’s
              </Link>
            ) : null}
          </div>
        </div>
        {visual ? <div className="animate-page-in">{visual}</div> : null}
      </div>
    </section>
  );
}

// Erklär-Abschnitt: Text mit Checkliste auf der einen, bewegte Illustration
// auf der anderen Seite. `reverse` tauscht die Seiten (Zickzack-Layout).
export function FeatureSection({
  id,
  eyebrow,
  title,
  reverse = false,
  visual,
  children,
  points,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  reverse?: boolean;
  visual: ReactNode;
  children: ReactNode;
  points?: string[];
}) {
  return (
    <section id={id} className="mx-auto w-full max-w-6xl scroll-mt-8 px-4 pt-16 sm:px-6 sm:pt-20">
      <div
        className={`grid items-center gap-10 lg:grid-cols-2 ${
          reverse ? "lg:[&>*:first-child]:order-2" : ""
        }`}
      >
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-orange">
            {eyebrow}
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">{title}</h2>
          <div className="mt-4 space-y-4 leading-relaxed text-gray-300">{children}</div>
          {points ? (
            <ul className="mt-5 space-y-2.5">
              {points.map((point) => (
                <li key={point} className="flex items-start gap-2.5 text-sm text-gray-200">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-orange" />
                  {point}
                </li>
              ))}
            </ul>
          ) : null}
        </Reveal>
        <Reveal delay={120}>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8">{visual}</div>
        </Reveal>
      </div>
    </section>
  );
}

// Abschluss-Band mit Registrierungs-CTA – auf jeder Marketing-Seite gleich.
export function CtaBand({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
      <Reveal>
        <div className="rounded-2xl border border-brand-orange/30 bg-gradient-to-br from-brand-orange/15 to-transparent p-8 text-center sm:p-12">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">{title}</h2>
          <p className="mx-auto mt-3 max-w-xl text-gray-300">{text}</p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link href="/registrieren" className={`${buttonClass} px-6 py-3 text-base`}>
              Jetzt kostenlos starten
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <p className="mt-5 text-sm text-gray-400">
            Fragen vorab?{" "}
            <a
              href="mailto:info@bundwimmobilien.de"
              className="text-brand-orange hover:underline"
            >
              info@bundwimmobilien.de
            </a>
          </p>
        </div>
      </Reveal>
    </section>
  );
}
