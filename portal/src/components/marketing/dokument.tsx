// Bausteine der öffentlichen Seiten. Sie bilden ein DOKUMENT nach, kein
// Kachelraster: Haarlinien statt Kartenrahmen, eine Marginalspalte für die
// Paragraphen, Tabellenziffern für alles, was untereinander steht.
//
// Der Grund steht in `.claude/skills/marken-seiten/SKILL.md`: Die vorige
// Fassung war aus genau den Bausteinen gebaut, an denen man eine generierte
// Seite erkennt — Foto-Hero mit Verlauf, Symbolkacheln im Dreierraster, eine
// Leiste mit riesigen Zahlen. Der Gegenstand dieser Seite ist aber die
// Wohnungseigentümergemeinschaft, und deren Material ist Papier: die
// Teilungserklärung, der Wirtschaftsplan, die Einzelabrechnung, die
// Beschluss-Sammlung.
import type { ReactNode } from "react";
import { Reveal } from "./reveal";

// Satzbreiten. Fließtext bleibt lesbar schmal, Register und Tabellen dürfen
// breiter laufen — eine Seite mit nur einer Breite liest sich wie ein Formular.
export const spalteText = "max-w-[62ch]";
export const blatt = "mx-auto w-full max-w-5xl px-5 sm:px-8";
export const blattWeit = "mx-auto w-full max-w-6xl px-5 sm:px-8";

// Meta-Zeile auf einer Haarlinie: ersetzt die Pille mit Symbol, die über jeder
// zweiten Landing-Page steht.
export function Meta({ children }: { children: ReactNode }) {
  return (
    <p className="border-t border-wp-ink/20 pt-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-wp-ink/55">
      {children}
    </p>
  );
}

// Abschnitts-Auftakt: laufende Nummer, Titel, optionaler Vorspann. Die Nummer
// ist keine Zierde — die Seite ist als Dokument gegliedert und wird auch so
// zitiert („Abschnitt 3").
export function Abschnitt({
  nr,
  titel,
  vorspann,
  children,
  weit = false,
}: {
  nr: string;
  titel: string;
  vorspann?: ReactNode;
  children: ReactNode;
  weit?: boolean;
}) {
  return (
    <section className={`${weit ? blattWeit : blatt} scroll-mt-24 pt-20 sm:pt-28`}>
      <Reveal>
        <div className="flex items-baseline gap-4 border-b border-wp-ink/20 pb-3">
          <span className="font-mk text-sm font-semibold tabular-nums text-wp-accent-ink">
            {nr}
          </span>
          <h2 className="text-balance text-2xl font-semibold leading-tight tracking-tight text-wp-ink sm:text-[2rem]">
            {titel}
          </h2>
        </div>
        {vorspann ? (
          <div className={`${spalteText} mt-6 text-[17px] leading-[1.65] text-wp-ink/80`}>
            {vorspann}
          </div>
        ) : null}
      </Reveal>
      {children}
    </section>
  );
}

// Marginalie: Paragraph oder Quelle steht NEBEN dem Text, nicht in einem
// Kasten mit Waage-Symbol darin. Auf schmalen Geräten rutscht sie darüber.
export function MitMarginalie({
  marginalie,
  children,
}: {
  marginalie: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-x-8 gap-y-2 lg:grid-cols-[10rem_minmax(0,1fr)]">
      <p className="pt-1 text-[13px] leading-snug text-wp-ink/50 lg:text-right">{marginalie}</p>
      <div className={spalteText}>{children}</div>
    </div>
  );
}

// Ein Eintrag des Kalenderjahres. Der Zeitpunkt steht in der Marginalspalte,
// der Paragraph darunter — so liest man von links nach rechts „wann, wonach,
// was".
export function JahresEintrag({
  wann,
  paragraf,
  titel,
  children,
  hinweis,
}: {
  wann: string;
  paragraf?: string;
  titel: string;
  children: ReactNode;
  hinweis?: string;
}) {
  return (
    <Reveal className="group">
      <div className="grid gap-x-8 gap-y-1.5 border-t border-wp-ink/12 py-6 lg:grid-cols-[10rem_minmax(0,1fr)]">
        <div className="lg:text-right">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-wp-ink/70">
            {wann}
          </p>
          {paragraf ? (
            <p className="text-[13px] leading-snug text-wp-ink/45">{paragraf}</p>
          ) : null}
        </div>
        <div className={spalteText}>
          <h3 className="text-lg font-semibold leading-snug text-wp-ink">{titel}</h3>
          <div className="mt-1.5 leading-relaxed text-wp-ink/75">{children}</div>
          {hinweis ? (
            <p className="mt-2 text-sm text-wp-accent-ink">{hinweis}</p>
          ) : null}
        </div>
      </div>
    </Reveal>
  );
}

// Registerzeile — Vorbild ist die Beschluss-Sammlung: fortlaufend nummeriert,
// eine Zeile je Eintrag, Fundstelle rechts. Kein Symbolplättchen, keine Karte.
export function RegisterZeile({
  nr,
  titel,
  fundstelle,
  href,
  children,
}: {
  nr: number;
  titel: string;
  fundstelle?: string;
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      className="group grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3 border-t border-wp-ink/12 py-3.5 transition-colors hover:bg-wp-accent-light/45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wp-accent-ink"
    >
      <span className="pt-0.5 text-sm font-semibold tabular-nums text-wp-ink/40 group-hover:text-wp-accent-ink">
        {String(nr).padStart(2, "0")}
      </span>
      <span>
        <span className="flex flex-wrap items-baseline gap-x-2.5">
          <span className="font-semibold text-wp-ink underline decoration-wp-ink/20 underline-offset-4 group-hover:decoration-wp-accent-ink">
            {titel}
          </span>
          {fundstelle ? (
            <span className="text-[13px] text-wp-ink/45">{fundstelle}</span>
          ) : null}
        </span>
        <span className="mt-1 block text-[15px] leading-relaxed text-wp-ink/70">
          {children}
        </span>
      </span>
    </a>
  );
}
