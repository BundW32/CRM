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
// Postfach für Fragen und Anregungen – Ziel des Kontakt-Funnels (/kontakt).
export const SERVICE_EMAIL = "service@wegportal24.de";

// Haupt-Handlung (Registrieren): Akzentfläche, dunkle Tinte darauf.
export const wpButtonClass =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-wp-accent px-4 py-2 text-sm font-semibold text-wp-on-accent shadow-e1 transition-all hover:bg-wp-accent-dark hover:shadow-e2 active:scale-[0.98]";

// Neben-Handlung (Anmelden): Umriss in der Primärfarbe auf hellem Grund.
export const wpButtonSecondaryClass =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-wp-primary/30 bg-white px-4 py-2 text-sm font-semibold text-wp-primary transition-all hover:border-wp-primary/60 hover:bg-wp-primary-light active:scale-[0.98]";

// Neben-Handlung auf Foto-/Dunkelflächen: weißer Umriss.
export const wpButtonOnPhotoClass =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/40 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/20 active:scale-[0.98]";
