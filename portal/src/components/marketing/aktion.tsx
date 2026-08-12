// Sichtbarer Teil der Willkommensaktion: die Leiste über der Kopfzeile und der
// Hinweis-Block für Hero, Preisseite und Registrierung.
//
// Der WORTLAUT steht nur hier. Fakten (Code, Monate, Enddatum, Platzzahl) kommen
// aus `lib/aktion.ts`, der Stand aus `lib/aktion-server.ts` — und alle Bausteine
// verschwinden gemeinsam, sobald `aktuellerAktionsStand()` `null` liefert
// (Zeitraum vorbei oder Plätze weg). Eine Aktion, die auf einer Seite noch
// steht und auf der nächsten nicht, ist schlimmer als keine.
//
// Zwei Regeln der Marken-Seiten, die hier zuschlagen:
// - Orange auf hellem Grund nur als `-ink`-Variante; auf dunklem Grund trägt
//   `-bright` (siehe Token-Block in `globals.css`).
// - Tap-Ziele mindestens 44 px — die Leiste ist ein Link und hält `min-h-11`.
import Link from "next/link";
import { ArrowRight, Gift } from "lucide-react";
import { aktionsLink, type AktionsStand } from "@/lib/aktion";
import { aktuellerAktionsStand } from "@/lib/aktion-server";
import { wpButtonClass } from "./brand";

// ── Wortlaut ────────────────────────────────────────────────────────────────
// „Voller Funktionsumfang" ist geprüft: Die Aktion verlängert die Testphase,
// und in ihr liefert `aktiverPlan()` den Tarif `pro` — der schließt den
// Ticket-Weg zum zertifizierten Verwalter ein, entspricht also Verwalter-Plus
// (`PLAN_FUNKTIONEN` in `lib/billing.ts`). „Ohne Bindung" ebenso: Für die
// Testphase werden keine Zahlungsdaten erhoben, sie verlängert sich nicht
// automatisch, und die AGB (Ziffer 8) kennen keine Mindestlaufzeit.
const TITEL = "Willkommensangebot";

// Die Seiten nennen die GRENZE („nur 50 Plätze"), nicht den Verbrauch — kein
// „noch 37 von 50 frei" (Entscheidung des Auftraggebers vom 11.08.2026). Der
// Zähler bleibt im Hintergrund: Er schließt die Aktion beim letzten Platz, aber
// ein laufender Stand verrät nach außen, wie viele sich angemeldet haben, und
// eine hohe Restzahl arbeitet gegen die Knappheit, mit der geworben wird.
// `stand.restplaetze` gehört deshalb NICHT in diese Datei.
function plaetzeText(stand: AktionsStand): string {
  return `nur ${stand.plaetze} Plätze`;
}

/**
 * Aktionsleiste über der Kopfzeile — auf jeder öffentlichen Marken-Seite, weil
 * sie in `MarketingHeader` hängt und keine Seite sie vergessen kann.
 *
 * Die ganze Leiste ist EIN Link, führt aber mit `aria-label` einen kurzen Namen:
 * Ohne ihn wäre der Ankertext die komplette Zeile — für eine Linkliste im
 * Screenreader unbrauchbar (dieselbe Falle wie bei den Nutzen-Karten der
 * Startseite).
 */
export async function AktionsBanner() {
  const stand = await aktuellerAktionsStand();
  if (!stand) return null;

  return (
    <div className="bg-wp-ink text-white">
      <Link
        href={aktionsLink()}
        aria-label={`${TITEL} einlösen: ${stand.gratisMonate} Monate gratis mit Code ${stand.code}`}
        className="group mx-auto flex min-h-11 w-full max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-center text-[13px] leading-snug sm:px-8 sm:text-sm"
      >
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <Gift className="h-4 w-4 shrink-0 text-wp-accent-bright" aria-hidden="true" />
          {TITEL}
        </span>
        <span className="text-white/85">
          {stand.gratisMonate} Monate gratis
          <span className="hidden sm:inline"> – voller Funktionsumfang, ohne Bindung</span>
        </span>
        <span className="rounded-md border border-white/30 bg-white/10 px-2 py-0.5 font-semibold tracking-wider">
          Code {stand.code}
        </span>
        <span className="hidden text-white/70 lg:inline">
          bis {stand.endeText} · {plaetzeText(stand)}
        </span>
        <span className="inline-flex items-center gap-1 font-semibold text-wp-accent-bright underline decoration-wp-accent-bright/40 underline-offset-4 transition-colors group-hover:decoration-wp-accent-bright">
          Einlösen
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </Link>
    </div>
  );
}

/**
 * Der Angebots-Block. Drei Fassungen, ein Text:
 *
 *   `hero`     – auf dem dunklen Foto der Startseite (weiße Schrift).
 *   `hell`     – auf hellem Grund, etwa über den Tarifkarten der Preisseite.
 *   `formular` – neben dem Registrierungsformular; jene Seite läuft in
 *                `wp-brand`, deshalb die `brand-*`-Klassen des Portals.
 *
 * Ohne laufende Aktion: nichts. Der Aufrufer braucht keine eigene Weiche.
 */
export async function AktionsAngebot({
  variant,
  className = "",
}: {
  variant: "hero" | "hell" | "formular";
  className?: string;
}) {
  const stand = await aktuellerAktionsStand();
  if (!stand) return null;

  const rahmen =
    variant === "hero"
      ? "rounded-2xl border border-wp-accent/40 bg-wp-ink/60 p-4 backdrop-blur-sm sm:p-5"
      : variant === "hell"
        ? "rounded-2xl border border-wp-accent-ink/25 bg-wp-accent-light p-5 sm:p-6"
        : "rounded-xl border border-brand-orange/30 bg-brand-orange-light p-4";
  const kicker = variant === "hero" ? "text-wp-accent-bright" : "text-wp-accent-ink";
  const haupttext = variant === "hero" ? "text-white" : "text-wp-ink";
  const nebentext = variant === "hero" ? "text-white/75" : "text-wp-ink/70";
  const chip =
    variant === "hero"
      ? "border-white/35 bg-white/10 text-white"
      : "border-wp-accent-ink/30 bg-white text-wp-ink";

  return (
    <div className={`${rahmen} ${className}`}>
      <p className={`inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide ${kicker}`}>
        <Gift className="h-4 w-4 shrink-0" aria-hidden="true" />
        {TITEL} – nur für kurze Zeit
      </p>
      <p className={`mt-2 text-balance text-base leading-relaxed sm:text-lg ${haupttext}`}>
        Die ersten <strong className="font-semibold">{stand.gratisMonate} Monate voller Funktionsumfang</strong>{" "}
        gratis – ohne Bindung, ohne Zahlungsdaten.
      </p>
      <p className={`mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm ${nebentext}`}>
        <span>Mit Code</span>
        <span className={`rounded-md border px-2 py-0.5 font-semibold tracking-wider ${chip}`}>
          {stand.code}
        </span>
        {/* Kein führender Trenner: Bricht die Zeile hinter dem Code-Chip um,
            stünde sonst ein „·" am Zeilenanfang. */}
        <span>
          gültig bis {stand.endeText} · nur für die ersten {stand.plaetze} Gemeinschaften
        </span>
      </p>
      {/* Einen EIGENEN Knopf trägt nur die helle Fassung. Im Hero steht der
          Haupt-CTA schon darüber (und nimmt den Code mit), am Formular der
          Absende-Knopf darunter — ein dritter Knopf daneben lenkt vom einen
          Weg ab, den die Seite anbietet. */}
      {variant === "hell" ? (
        <>
          <Link href={aktionsLink()} className={`${wpButtonClass} mt-4 min-h-11 px-5 py-2.5`}>
            Angebot mit Code sichern
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <p className={`mt-2 text-xs ${nebentext}`}>
            Danach gelten die regulären Preise – es verlängert sich nichts von
            selbst, Sie entscheiden aktiv.
          </p>
        </>
      ) : (
        <p className={`mt-2 text-xs ${nebentext}`}>
          {variant === "hero"
            ? "Der Code ist im Knopf oben schon eingetragen – es verlängert sich nichts von selbst."
            : `Der Code steht unten im Formular; damit läuft Ihre Testphase ${stand.gratisMonate} Monate.`}
        </p>
      )}
    </div>
  );
}
