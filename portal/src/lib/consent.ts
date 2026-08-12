// Einwilligung für das Google-Ads-Tag: die puren Teile, ohne Browser und ohne
// React, damit die Pfad-Freigabe und die gespeicherte Entscheidung
// unit-testbar bleiben. Alles, was `window` braucht, liegt in
// `components/cookie-consent.tsx`.
//
// WICHTIG: Diese Datei wird auch im CLIENT-Bündel geladen. Sie darf deshalb
// KEINE Server-Env lesen — `isWegSaas()` und `googleAdsTagId()` fielen dort
// still auf den Standard zurück (siehe AGENTS.md, „Zwei Türen, zwei Marken").
// Ob das Tag überhaupt eine ID hat, entscheidet `lib/google-ads.ts` auf dem
// Server; die ID kommt als Prop in die Komponente.

export const CONSENT_KEY = "wp-consent-ads";

/**
 * Ereignis, mit dem eine geänderte Entscheidung im EIGENEN Tab bekannt wird —
 * das eingebaute `storage`-Ereignis feuert nur in den anderen. Darüber öffnen
 * die Rechtsseiten auch das Banner erneut (Art. 7 Abs. 3 DSGVO).
 */
export const CONSENT_EVENT = "wp:cookie-einstellungen";

export type Entscheidung = "granted" | "denied";

/** Rohwert aus `localStorage` → geprüfte Entscheidung oder `null` (= noch keine). */
export function leseEntscheidung(roh: string | null | undefined): Entscheidung | null {
  return roh === "granted" || roh === "denied" ? roh : null;
}

// ── Wo das Tag laufen darf ──────────────────────────────────────────────────
// Eine **Allowlist**, keine Sperrliste: Google verlangt das Tag „auf allen
// Seiten Ihrer Website", der angemeldete Portalbereich ist aber keine
// Werbeseite, sondern der Ort, an dem fremde personenbezogene Daten liegen.
// gtag.js meldet bei jedem Seitenaufruf `page_location` UND `page_title` an
// Google — bei `/verwaltung/nutzer/…` wäre das der Name einer Person, für die
// B&W nur Auftragsverarbeiterin ist (Art. 28 DSGVO). Eine solche Übermittlung
// in die USA ohne Weisung der Gemeinschaft wäre nicht zu rechtfertigen.
//
// Deshalb: Was hier nicht steht, bekommt kein Tag. Eine neue öffentliche Seite
// wird dadurch anfangs nicht gemessen — das ist der richtige Ausfall.
const EXAKT = new Set([
  "/",
  "/funktionen",
  "/so-funktionierts",
  "/preise",
  "/registrieren",
  "/impressum",
  "/datenschutz",
  "/datenschutz-saas",
  "/agb",
  "/avv",
  "/widerruf",
  "/ki-transparenz",
]);

const PRAEFIXE = ["/funktionen/"];

export function istTrackingPfad(pfad: string): boolean {
  if (!pfad.startsWith("/")) return false;
  // Abschließenden Schrägstrich abschneiden ("/preise/" ist dieselbe Seite),
  // die Wurzel "/" aber unangetastet lassen.
  const p = pfad.length > 1 && pfad.endsWith("/") ? pfad.slice(0, -1) : pfad;
  if (EXAKT.has(p)) return true;
  return PRAEFIXE.some((v) => p.startsWith(v));
}
