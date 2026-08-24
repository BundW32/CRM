// Sichtbarer Teil der Willkommensaktion: die Leiste am oberen Rand und der
// Hinweis am Registrierungsformular.
//
// Der WORTLAUT steht nur hier. Fakten (Code, Monate, Enddatum, Platzzahl) kommen
// aus `lib/aktion.ts`, der Stand aus `lib/aktion-server.ts` — und beide
// Bausteine verschwinden gemeinsam, sobald `aktuellerAktionsStand()` `null`
// liefert (Zeitraum vorbei oder Plätze weg). Eine Aktion, die auf einer Seite
// noch steht und auf der nächsten nicht, ist schlimmer als keine.
//
// **Zwei Auftritte, mehr nicht** (Entscheidung des Auftraggebers vom
// 12.08.2026): die Leiste — auf jeder Marken-Seite, mitlaufend — und das
// Formular der Registrierung. In den Hero-Bereich gehört nichts hinein; der
// wird eigenständig weiterentwickelt, und ein Werbeblock darin würde bei jeder
// Änderung dort im Weg stehen.
//
// Zwei Regeln der Marken-Seiten, die hier zuschlagen:
// - Orange auf hellem Grund nur als `-ink`-Variante; auf dunklem Grund trägt
//   `-bright` (siehe Token-Block in `globals.css`).
// - Tap-Ziele mindestens 44 px — Code-Knopf und „Einlösen" halten `min-h-11`.
import Link from "next/link";
import { ArrowRight, Gift } from "lucide-react";
import { aktionsLink, type AktionsStand } from "@/lib/aktion";
import { aktuellerAktionsStand } from "@/lib/aktion-server";
import { AktionsCode } from "./aktion-code";

// ── Wortlaut ────────────────────────────────────────────────────────────────
// „Voller Funktionsumfang" ist geprüft: Die Aktion verlängert die Testphase,
// und in ihr liefert `aktiverPlan()` den Tarif `pro` — der schließt den
// Ticket-Weg zum zertifizierten Verwalter ein, entspricht also Verwalter-Plus
// (`PLAN_FUNKTIONEN` in `lib/billing.ts`). „Ohne Bindung" ebenso: Die Testphase
// verlängert sich nicht automatisch, und die AGB (Ziffer 8) kennen keine
// Mindestlaufzeit.
//
// **Zahlungsdaten werden hier bewusst NICHT erwähnt** (Entscheidung des
// Auftraggebers vom 12.08.2026). Am Sachverhalt ändert das nichts — die
// Registrierung fragt keine Zahlungsdaten ab, Stripe kommt erst bei einer
// aktiven Buchung ins Spiel —, es wird nur nicht mehr beworben. Wer die Aussage
// wieder aufnimmt, prüft vorher, ob sie noch stimmt: Sie hängt an der
// Registrierung (`registrieren/actions.ts`) und am Checkout
// (`lib/billing-checkout.ts`), nicht an dieser Datei.
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
 * Aktionsleiste am oberen Rand — auf jeder öffentlichen Marken-Seite, weil sie
 * in `MarketingHeader` hängt und keine Seite sie vergessen kann. Sie läuft
 * beim Scrollen mit: Der gemeinsame Klebe-Rahmen dafür steht in `site.tsx`,
 * damit Leiste und Kopfzeile als EIN Block oben bleiben (zwei getrennte
 * `sticky`-Elemente müssten ihre Höhen kennen — und die Leiste ist auf
 * schmalen Geräten schmaler beschriftet als auf breiten).
 *
 * Kein umschließender Link: Der Code ist ein Knopf (kopieren), und ein Knopf in
 * einem Link ist ungültiges Markup — der Browser entscheidet dann selbst, was
 * ein Tipp bedeutet. Deshalb tragen Code und „Einlösen" ihre Ziele selbst.
 */
export async function AktionsBanner() {
  const stand = await aktuellerAktionsStand();
  if (!stand) return null;

  return (
    <div className="animate-page-in bg-wp-ink text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-3 px-4 py-1.5 text-center text-[13px] leading-snug sm:px-8 sm:text-sm">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <Gift className="h-4 w-4 shrink-0 text-wp-accent-bright" aria-hidden="true" />
          <span className="hidden sm:inline">{TITEL}:</span>
          {stand.gratisMonate} Monate gratis
        </span>
        <span className="hidden text-white/85 md:inline">
          voller Funktionsumfang, ohne Bindung
        </span>
        <AktionsCode code={stand.code} tone="dunkel" />
        <span className="hidden text-white/70 lg:inline">
          bis {stand.endeText} · {plaetzeText(stand)}
        </span>
        <Link
          href={aktionsLink()}
          className="hidden min-h-11 items-center gap-1 font-semibold text-wp-accent-bright underline decoration-wp-accent-bright/40 underline-offset-4 transition-colors hover:decoration-wp-accent-bright sm:inline-flex"
        >
          Einlösen
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

/**
 * Der Hinweis am Registrierungsformular — der einzige Ort neben der Leiste, an
 * dem das Angebot ausführlich dasteht: Wer hier ankommt, muss den Code
 * eintragen und wissen, was er bringt.
 *
 * Die Seite läuft in `wp-brand`, deshalb die `brand-*`-Klassen des Portals
 * statt der `wp-*`-Tokens der Marken-Seiten.
 *
 * Ohne laufende Aktion: nichts. Der Aufrufer braucht keine eigene Weiche.
 */
export async function AktionsHinweis({ className = "" }: { className?: string }) {
  const stand = await aktuellerAktionsStand();
  if (!stand) return null;

  return (
    <div className={`rounded-xl border border-brand-orange/30 bg-brand-orange-light p-4 ${className}`}>
      <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-wp-accent-ink">
        <Gift className="h-4 w-4 shrink-0" aria-hidden="true" />
        {TITEL} – nur für kurze Zeit
      </p>
      <p className="mt-2 text-balance text-base leading-relaxed text-wp-ink">
        Die ersten <strong className="font-semibold">{stand.gratisMonate} Monate voller Funktionsumfang</strong>{" "}
        gratis – ohne Bindung.
      </p>
      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-wp-ink/70">
        <AktionsCode code={stand.code} tone="hell" />
        {/* Kein führender Trenner: Bricht die Zeile hinter dem Code um, stünde
            sonst ein „·" am Zeilenanfang. */}
        <span>
          gültig bis {stand.endeText} · nur für die ersten {stand.plaetze} Gemeinschaften
        </span>
      </p>
      <p className="mt-2 text-sm text-wp-ink/70">
        Der Code steht unten im Formular; damit läuft Ihre Testphase{" "}
        {stand.gratisMonate} Monate.
      </p>
    </div>
  );
}
