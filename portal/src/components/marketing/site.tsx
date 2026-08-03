// Gemeinsame Bausteine der öffentlichen Marketing-Seiten von Wegportal24
// (Hauptdomain der SaaS-Variante): fixierte Kopfzeile mit Navigation,
// Fußzeile, Foto-Hero, Zahlenleiste und CTA-Band. Die Seiten laufen hell
// (Klasse `mk-light` auf dem <main>), die Fußzeile bleibt als dunkelgrüner
// Marken-Anker. Farben und Knöpfe kommen aus `./brand`.
import Link from "next/link";
import { ArrowRight, CheckCircle2, ChevronDown, LogIn, Mail } from "lucide-react";
import type { ReactNode } from "react";
import {
  BRAND_EMAIL,
  BRAND_NAME,
  WegportalLogo,
  wpButtonClass,
  wpButtonOnPhotoClass,
  wpButtonSecondaryClass,
} from "./brand";
import { KenBurnsBackdrop } from "./photo-hero";
import { Reveal } from "./reveal";

// Bisheriger Name des Foto-Knopfes – bleibt als Re-Export, damit die Seiten
// ihn unverändert importieren können.
export const buttonOnPhotoClass = wpButtonOnPhotoClass;

const navItems = [
  { href: "/funktionen/finanzen", label: "Finanzen" },
  { href: "/funktionen/hausgeld", label: "Hausgeld" },
  { href: "/funktionen/versammlung", label: "Versammlung" },
  { href: "/funktionen/kommunikation", label: "Kommunikation" },
  { href: "/so-funktionierts", label: "So funktioniert’s" },
] as const;

export function MarketingHeader({ active }: { active?: string }) {
  return (
    <>
      {/* Tastatur-Nutzer springen direkt zum Inhalt */}
      <a
        href="#inhalt"
        className="sr-only z-50 rounded-md bg-wp-accent px-3 py-2 text-sm font-semibold text-wp-on-accent focus:not-sr-only focus:absolute focus:left-4 focus:top-4"
      >
        Zum Inhalt springen
      </a>
      <header className="sticky top-0 z-40 border-b border-gray-200/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="shrink-0" aria-label={`${BRAND_NAME} – zur Startseite`}>
            <WegportalLogo className="h-8 w-auto sm:h-9" />
          </Link>
          <nav
            aria-label="Hauptnavigation"
            className="hidden items-center gap-6 text-sm lg:flex"
          >
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active === item.href ? "page" : undefined}
                className={
                  active === item.href
                    ? "-mb-px border-b-2 border-wp-accent-ink pb-0.5 font-semibold text-wp-primary"
                    : "text-gray-600 transition-colors hover:text-wp-primary"
                }
              >
                {item.label}
              </Link>
            ))}
          </nav>
          {/* Beide Zugänge stehen nebeneinander und bleiben auf dem Handy
              sichtbar. Vorher verschwand „Registrieren" unter 640 px – genau
              die Handlung, die die Seite auslösen soll. Auf schmalen Geräten
              trägt „Anmelden" nur das Symbol, damit beide Platz haben. */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className={`${wpButtonSecondaryClass} px-3 sm:px-4`}
              aria-label="Anmelden"
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Anmelden</span>
            </Link>
            <Link href="/registrieren" className={wpButtonClass}>
              Registrieren
            </Link>
          </div>
        </div>
        {/* Mobile Navigation: horizontal scrollbar statt Umbruch */}
        <nav
          aria-label="Hauptnavigation mobil"
          className="flex gap-5 overflow-x-auto border-t border-gray-100 px-4 py-2 text-sm whitespace-nowrap lg:hidden"
        >
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active === item.href ? "page" : undefined}
              className={
                active === item.href
                  ? "font-semibold text-wp-accent-ink"
                  : "text-gray-600"
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
    </>
  );
}

const footerColumns: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Funktionen",
    links: [
      { href: "/funktionen/finanzen", label: "Finanzen & Jahresabrechnung" },
      { href: "/funktionen/hausgeld", label: "Hausgeld & Mahnwesen" },
      { href: "/funktionen/versammlung", label: "Versammlung & Beschlüsse" },
      { href: "/funktionen/kommunikation", label: "Kommunikation & Alltag" },
    ],
  },
  {
    title: "Einstieg",
    links: [
      { href: "/so-funktionierts", label: "So funktioniert’s" },
      { href: "/registrieren", label: "Kostenlos registrieren" },
      { href: "/login", label: "Anmelden" },
    ],
  },
  {
    title: "Rechtliches",
    links: [
      { href: "/impressum", label: "Impressum" },
      { href: "/datenschutz", label: "Datenschutz" },
      { href: "/agb", label: "AGB" },
      { href: "/avv", label: "Auftragsverarbeitung (AVV)" },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="mt-4 bg-wp-ink">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.3fr_1fr_1fr_1fr]">
        {/* Markenblock */}
        <div>
          <WegportalLogo className="h-9 w-auto" tone="hell" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/70">
            Das Portal für selbstverwaltete Wohnungseigentümergemeinschaften –
            von der ersten Buchung über Versammlung und Beschluss bis zur
            revisionssicheren Jahresabrechnung.
          </p>
          <a
            href={`mailto:${BRAND_EMAIL}`}
            className="mt-4 inline-flex items-center gap-2 text-sm text-white/80 transition-colors hover:text-wp-accent-bright"
          >
            <Mail className="h-4 w-4" />
            {BRAND_EMAIL}
          </a>
        </div>
        {/* Linkspalten */}
        {footerColumns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/50">
              {col.title}
            </p>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/80 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      {/* Untere Leiste */}
      <div className="border-t border-white/10">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-white/60 sm:px-6">
          <p>
            © {new Date().getFullYear()} {BRAND_NAME}.de. Alle Rechte vorbehalten.
          </p>
          <p>Wirtschaftsplan · Jahresabrechnung · Hausgeld – nach §§ 19, 26a, 28 WEG</p>
        </div>
      </div>
    </footer>
  );
}

// Full-Bleed-Hero im Kampagnen-Stil: das Foto füllt die ganze Sektion,
// der Text liegt AUF dem Bild über einem dunkelgrünen Verlauf. Rechts unten
// schwebt eine weiße Kennzahl-Karte als Brücke zum Produkt, unten deutet
// ein Pfeil zum Weiterscrollen.
export function MarketingHero({
  eyebrow,
  title,
  intro,
  image,
  badge,
  showSecondaryCta = true,
}: {
  eyebrow: string;
  title: ReactNode;
  intro: string;
  image: { src: string; alt: string };
  // Icon bereits als gerendertes Element übergeben (Server → Client Grenze)
  badge?: { icon: ReactNode; text: string };
  // Ausblenden, wenn die Seite selbst /so-funktionierts ist
  showSecondaryCta?: boolean;
}) {
  return (
    <section id="inhalt" className="relative flex min-h-[78vh] items-center overflow-hidden">
      <KenBurnsBackdrop src={image.src} alt={image.alt} preload />
      {/* Lesbarkeits-Verlauf: links dicht, rechts gibt er das Foto frei */}
      <div className="absolute inset-0 bg-gradient-to-r from-wp-ink/95 via-wp-ink/70 to-wp-ink/20" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-wp-ink/60 to-transparent" />

      <div className="relative mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <div className="max-w-2xl animate-page-in">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-white backdrop-blur-sm">
            {eyebrow}
          </p>
          <h1 className="text-balance text-4xl font-extrabold leading-tight text-white sm:text-5xl">
            {title}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg">
            {intro}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/registrieren" className={`${wpButtonClass} px-5 py-2.5`}>
              Kostenlos starten
              <ArrowRight className="h-4 w-4" />
            </Link>
            {showSecondaryCta ? (
              <Link href="/so-funktionierts" className={`${buttonOnPhotoClass} px-5 py-2.5`}>
                So funktioniert’s
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      {badge ? (
        <div
          className="absolute bottom-10 right-6 hidden items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-gray-800 shadow-e3 md:flex lg:right-12"
          style={{ animation: "mkPopIn 0.5s var(--ease-mk-out) both", animationDelay: "500ms" }}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-wp-accent-light">
            {badge.icon}
          </span>
          {badge.text}
        </div>
      ) : null}

      {/* Scroll-Hinweis */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70">
        <ChevronDown
          className="h-6 w-6"
          style={{ animation: "mkNudge 2.2s ease-in-out infinite" }}
        />
      </div>
    </section>
  );
}

// Full-Width-Foto-Band mit überlagertem Claim – als atmosphärischer
// Zwischenschnitt zwischen zwei Inhaltssektionen (Kampagnen-Stil).
export function PhotoBand({
  src,
  alt,
  claim,
  sub,
}: {
  src: string;
  alt: string;
  claim: string;
  sub?: string;
}) {
  return (
    <section className="relative mt-20 flex min-h-[46vh] items-center justify-center overflow-hidden">
      <KenBurnsBackdrop src={src} alt={alt} />
      <div className="absolute inset-0 bg-wp-ink/60" />
      <Reveal className="relative">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
          <h2 className="text-balance text-3xl font-extrabold leading-tight text-white sm:text-4xl">
            {claim}
          </h2>
          {sub ? (
            <p className="mx-auto mt-4 max-w-xl text-balance text-white/80">{sub}</p>
          ) : null}
        </div>
      </Reveal>
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
    <section id={id} className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 pt-20 sm:px-6 sm:pt-24">
      <div
        className={`grid items-center gap-10 lg:grid-cols-2 lg:gap-14 ${
          reverse ? "lg:[&>*:first-child]:order-2" : ""
        }`}
      >
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-wp-accent-ink">
            {eyebrow}
          </p>
          <h2 className="mt-3 text-balance text-2xl font-bold text-wp-ink sm:text-3xl">
            {title}
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-gray-600">{children}</div>
          {points ? (
            <ul className="mt-6 space-y-2.5 border-l-2 border-wp-accent-ink/30 pl-5">
              {points.map((point) => (
                <li key={point} className="flex items-start gap-2.5 text-sm text-gray-700">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-wp-accent-ink" />
                  {point}
                </li>
              ))}
            </ul>
          ) : null}
        </Reveal>
        <Reveal delay={120}>
          <div className="relative">
            {/* weiches Licht hinter der Illustration */}
            <div className="pointer-events-none absolute -inset-5 rounded-[2rem] bg-wp-accent/10 blur-2xl" />
            <div
              className="relative rounded-2xl border border-wp-accent-light bg-gradient-to-b from-wp-accent-light/60 to-white p-6 shadow-e2 sm:p-8"
              style={{ animation: "mkFloat 8s ease-in-out infinite" }}
            >
              {visual}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// Zahlenleiste „Auf einen Blick" – nüchterne Produkt-Fakten im Stil großer
// Unternehmensseiten. Bewusst nur belegbare Werte, keine Marketing-Zahlen.
const stats = [
  { value: "0 €", label: "Start ohne Zahlungsdaten – Registrierung in wenigen Minuten" },
  { value: "12", label: "monatliche Sollstellungen je Einheit, automatisch aus dem Beschluss" },
  { value: "< 9", label: "Einheiten: keine Zertifizierungspflicht für den Eigentümer-Verwalter" },
  { value: "4", label: "Rollen mit eigenem Zugang: Eigentümer, Beirat, Mieter, Handwerker" },
];

export function StatsBand() {
  return (
    // Dunkelgrün statt Grün: Die Zahlen stehen in Orange darauf und erreichen
    // so 7,0:1 statt 5,7:1 – die Zahlen sind der Grund für dieses Band.
    <section className="relative overflow-hidden bg-wp-ink">
      {/* dezente Lichtakzente wie im CTA-Band */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-wp-accent/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-wp-primary/50 blur-3xl" />
      <div className="relative mx-auto grid w-full max-w-6xl gap-8 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <Reveal key={stat.value} delay={i * 90}>
            <div>
              <p className="font-display text-5xl font-extrabold tracking-tight text-wp-accent-bright">
                {stat.value}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-white/80">{stat.label}</p>
            </div>
          </Reveal>
        ))}
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
    <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
      <Reveal>
        <div className="relative overflow-hidden rounded-2xl bg-wp-primary p-8 text-center shadow-e3 sm:p-14">
          {/* Dezenter Akzent statt lauter Verläufe */}
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-wp-accent/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-wp-primary/50 blur-3xl" />
          <div className="relative">
            <h2 className="text-balance text-2xl font-bold text-white sm:text-3xl">{title}</h2>
            <p className="mx-auto mt-3 max-w-xl text-balance text-white/80">{text}</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/registrieren" className={`${wpButtonClass} px-6 py-3 text-base`}>
                Jetzt kostenlos starten
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <p className="mt-6 text-sm text-white/60">
              Fragen vorab?{" "}
              <a
                href={`mailto:${BRAND_EMAIL}`}
                className="font-medium text-wp-accent-bright hover:underline"
              >
                {BRAND_EMAIL}
              </a>
            </p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
