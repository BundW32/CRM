// ── Marke der WEG-SaaS-Variante ──────────────────────────────────────────────
// Wegportal24.de tritt eigenständig auf. Name, Domain und Kontaktadresse stehen
// deshalb HIER an einer Stelle: Wer die Marke wechselt, ändert diese Datei und
// die `--color-wp-*`-Tokens in `globals.css` – sonst nichts.
//
// Grün und Orange sind aus der Verwaltungs-Variante übernommen, aber nicht mit
// ihr verbunden: Die Tokens tragen eigene Werte (siehe `globals.css`). Auf der
// Seite selbst wird kein anderes Unternehmen genannt; wer die Plattform
// betreibt, steht im Impressum, wo es hingehört.
//
// Die Knopf-Klassen sind eigene Konstanten und nicht `buttonClass` aus
// `@/components/ui`: Der dortige Knopf gilt im ganzen Portal – ihn umzufärben
// würde die Verwaltungs-Variante mitziehen.

export const BRAND_NAME = "Wegportal24";
export const BRAND_DOMAIN = "wegportal24.de";
// Postfach der Marke – muss noch eingerichtet werden (siehe README).
export const BRAND_EMAIL = "info@wegportal24.de";

// Haupt-Handlung (Registrieren): Akzentfläche, dunkle Tinte darauf.
export const wpButtonClass =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-wp-accent px-4 py-2 text-sm font-semibold text-wp-on-accent shadow-e1 transition-all hover:bg-wp-accent-dark hover:shadow-e2 active:scale-[0.98]";

// Neben-Handlung (Anmelden): Umriss in der Primärfarbe auf hellem Grund.
export const wpButtonSecondaryClass =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-wp-primary/30 bg-white px-4 py-2 text-sm font-semibold text-wp-primary transition-all hover:border-wp-primary/60 hover:bg-wp-primary-light active:scale-[0.98]";

// Neben-Handlung auf Foto-/Dunkelflächen: weißer Umriss.
export const wpButtonOnPhotoClass =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/40 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/20 active:scale-[0.98]";

// Wortmarke als Inline-SVG statt als Bilddatei: Sie besteht aus Schrift und
// zwei Flächen, skaliert damit verlustfrei und färbt sich über die
// Marken-Tokens mit – ein PNG müsste bei jeder Farbänderung neu gebaut werden.
//
// `tone="hell"` ist die Fassung für dunkle Flächen (Fußzeile, Foto-Heros).
export function WegportalLogo({
  className = "h-9 w-auto",
  tone = "dunkel",
}: {
  className?: string;
  tone?: "dunkel" | "hell";
}) {
  const wortText = tone === "hell" ? "#ffffff" : "var(--color-wp-ink)";
  const wortAkzent =
    tone === "hell" ? "var(--color-wp-accent-bright)" : "var(--color-wp-accent-ink)";

  return (
    <svg
      viewBox="0 0 232 48"
      className={className}
      role="img"
      aria-label={`${BRAND_NAME}.de – Portal für selbstverwaltete WEGs`}
    >
      {/* Bildmarke: Haus im Primärfeld. Dach und Wand stehen bewusst in
          verschiedenen Farben – ein Dach in derselben Farbe wie das Feld
          verschwindet und die Marke liest sich dann als Buchstabe. */}
      <rect x="0" y="4" width="40" height="40" rx="11" fill="var(--color-wp-primary)" />
      <path d="M20 11.5 32.5 24H7.5z" fill="var(--color-wp-accent-bright)" />
      <rect x="12" y="24" width="16" height="12.5" fill="#ffffff" />
      <rect x="17.5" y="28.5" width="5" height="8" rx="1.2" fill="var(--color-wp-primary)" />

      {/* Wortmarke: „weg" und „24" tragen den Akzent, „portal" die Grundfarbe */}
      <text
        x="50"
        y="32.5"
        fontFamily="var(--font-display)"
        fontSize="23"
        fontWeight="800"
        letterSpacing="-0.4"
        fill={wortAkzent}
      >
        weg
        <tspan fill={wortText}>portal</tspan>
        <tspan fill={wortAkzent}>24</tspan>
      </text>
    </svg>
  );
}
