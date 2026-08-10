// Alarm-Mail bei unbehandelten Serverfehlern (Audit B-4).
//
// Bisher liefen Serverfehler ausschließlich in die Vercel-Logs — mit kurzer
// Aufbewahrung und ohne dass sie jemand liest. Ein Fehler im Checkout oder in
// der Registrierung blieb damit unsichtbar, bis ein Kunde eine Mail schrieb;
// die meisten schreiben keine. Der Hook in `src/instrumentation.ts` ruft
// deshalb bei jedem unbehandelten Fehler `meldeServerFehler` auf, und hier
// wird daraus höchstens eine Handvoll Mails — nicht ein Postfach-Sturm.
//
// Die Mail nennt Route, Kontext und Fehlermeldung; die vollständige Spur
// (Stacktrace, Request) steht weiterhin in den Vercel-Logs. Diese Alarmierung
// ersetzt kein Error-Tracking mit Aggregation (Sentry, siehe
// docs/CHECKLISTE-Werbestart.md) — sie stellt sicher, dass der Betreiber vom
// ERSTEN Fehler erfährt, auch bevor so ein Konto eingerichtet ist.

import { betreiberAlarmAdresse } from "@/lib/billing-notify";
import { sendMail } from "@/lib/mailer";

// Drossel im Prozessgedächtnis. Bewusst NICHT in der Datenbank: Der häufigste
// Ernstfall ist gerade ein Datenbankausfall — eine Drossel, die dann selbst
// scheitert, würde entweder gar nicht melden oder ungebremst. Der Preis:
// Jede Serverless-Instanz drosselt für sich, es können also einige Mails mehr
// ankommen als die Grenzen nahelegen. Für einen Alarmweg ist das die richtige
// Seite des Kompromisses.
const JE_FEHLER_MS = 60 * 60 * 1000; // gleicher Fehler: höchstens 1 Mail/Stunde
const FENSTER_MS = 60 * 60 * 1000; // insgesamt: höchstens 5 Mails/Stunde
const FENSTER_MAX = 5;

const zuletztGemeldet = new Map<string, number>();
let fensterStart = 0;
let fensterAnzahl = 0;

/**
 * Entscheidet, ob dieser Fehler jetzt eine Mail wert ist, und zählt ihn.
 * Exportiert für den Test — der Versand selbst hängt an SMTP und gehört
 * nicht in eine Prüfung.
 */
export function sollMelden(schluessel: string, now: number = Date.now()): boolean {
  if (now - fensterStart > FENSTER_MS) {
    fensterStart = now;
    fensterAnzahl = 0;
    // Alte Schlüssel mit ausräumen — die Map wächst sonst mit jedem je
    // gesehenen Fehler, und Serverless-Instanzen leben teils Stunden.
    for (const [k, t] of zuletztGemeldet) {
      if (now - t > JE_FEHLER_MS) zuletztGemeldet.delete(k);
    }
  }
  if (fensterAnzahl >= FENSTER_MAX) return false;
  const letzter = zuletztGemeldet.get(schluessel);
  if (letzter !== undefined && now - letzter < JE_FEHLER_MS) return false;
  zuletztGemeldet.set(schluessel, now);
  fensterAnzahl += 1;
  return true;
}

/** Nur für Tests: Drossel auf den Anfangszustand zurücksetzen. */
export function _drosselZuruecksetzen(): void {
  zuletztGemeldet.clear();
  fensterStart = 0;
  fensterAnzahl = 0;
}

type FehlerRequest = { path: string; method: string };
type FehlerKontext = { routerKind: string; routePath: string; routeType: string };

export async function meldeServerFehler(
  err: unknown,
  request: FehlerRequest,
  context: FehlerKontext,
): Promise<void> {
  const to = betreiberAlarmAdresse();
  if (!to) return;

  const message = err instanceof Error ? err.message : String(err);
  const digest =
    typeof err === "object" && err !== null && "digest" in err
      ? String((err as { digest: unknown }).digest)
      : undefined;

  // Steuerfluss-„Fehler" von Next (redirect/notFound) sind keine Fehler.
  // Laut Doku erreichen sie den Hook nicht — der Wächter bleibt trotzdem
  // stehen, eine falsche Alarm-Mail kostet mehr Vertrauen als diese Zeile.
  if (digest?.startsWith("NEXT_")) return;

  // Gleicher Fehler = gleiche Stelle + gleiche Meldung. Der Digest allein
  // genügt nicht: Er fehlt außerhalb des RSC-Renderings (z. B. Route-Handler).
  const schluessel = `${context.routePath}|${digest ?? message}`;
  if (!sollMelden(schluessel)) return;

  const text = [
    `Unbehandelter Serverfehler auf ${request.method} ${request.path}`,
    ``,
    `Route:   ${context.routePath} (${context.routeType}, ${context.routerKind})`,
    `Fehler:  ${message}`,
    digest ? `Digest:  ${digest}` : null,
    ``,
    `Stacktrace und Request-Details stehen in den Vercel-Logs.`,
    `Gleiche Fehler werden für eine Stunde nicht erneut gemeldet.`,
  ]
    .filter((zeile) => zeile !== null)
    .join("\n");

  try {
    await sendMail(to, `[Fehler-Alarm] ${context.routePath}: ${message.slice(0, 120)}`, text);
  } catch {
    // Der Alarmweg darf nie selbst zum Fehler werden.
  }
}
