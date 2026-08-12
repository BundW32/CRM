// Google-Ads-Tag (gtag.js) — welche Tag-ID gilt, und ob überhaupt eine gilt.
//
// SERVER-ONLY: liest `APP_MODE` und `VERCEL_ENV`. Aus einer Client-Komponente
// aufgerufen fiele `isWegSaas()` still auf die B&W-Tür zurück (AGENTS.md).
// Aufrufer ist deshalb ausschließlich das Root-Layout, das die ID als Prop an
// `<CookieConsent>` weiterreicht.

import { isWegSaas } from "@/lib/app-mode";

/**
 * Konto „wegportal24" (Google Ads). Steht bewusst im Quelltext und nicht nur
 * in einer Env-Variablen: Die Tag-ID ist kein Geheimnis — sie steht in jeder
 * ausgelieferten Seite —, und eine Werbemessung, die erst nach dem Setzen
 * einer Vercel-Variablen anspringt, fällt beim nächsten Projekt-Neuaufbau
 * still aus, ohne dass es jemand merkt.
 */
export const GOOGLE_ADS_TAG_ID = "AW-18381571736";

/**
 * Die geltende Tag-ID — oder `null`, wenn hier nicht gemessen werden darf.
 *
 * Drei Sperren, alle drei mit Absicht:
 *  1. Nur die **wegportal24**-Tür. Auf portal.bundwimmobilien.de wird nicht
 *     geworben; dort bleibt es bei der Zusage „keine Analyse- oder
 *     Werbe-Cookies" in /datenschutz.
 *  2. Keine **Vorschau-Deployments**. Sie sind über eine öffentliche URL
 *     erreichbar und würden die Kampagnenzahlen mit Testaufrufen füllen —
 *     dieselbe Überlegung wie beim First-Party-Snippet.
 *  3. `GOOGLE_ADS_TAG_ID` kann die ID überschreiben (Kontowechsel ohne
 *     Codeänderung).
 */
export function googleAdsTagId(): string | null {
  if (!isWegSaas()) return null;
  if (process.env.VERCEL_ENV === "preview") return null;
  return process.env.GOOGLE_ADS_TAG_ID?.trim() || GOOGLE_ADS_TAG_ID;
}
