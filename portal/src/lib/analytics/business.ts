// Geschäftszahlen: MRR-Berechnung für das Analytics-Dashboard.
//
// Die eine Preisquelle bleibt `app/preise/preise-daten.ts` — hier wird nichts
// neu bepreist, sondern nur zusammengerechnet. Gerundet wird wie im Stripe-
// Checkout (lib/billing.ts): erst der Einheitenpreis nach Staffel auf Cent,
// dann mal Menge. Nur so stimmt der MRR mit dem überein, was Stripe wirklich
// abbucht — wer stattdessen die Summe rundet, liegt bei krummen Staffelpreisen
// (Verwalter-Plus: 12,51 €) daneben.
//
// ALLE Beträge sind BRUTTO inkl. 19 % USt: Die Preisseite nennt Bruttopreise
// (AGB Ziffer 6, Verbraucher-WEGs), und das Dashboard beschriftet sie so.

import { STELLPLATZ_CENTS, checkoutJeEinheitCents, type PlanId } from "@/lib/billing";

/**
 * Monats-Umsatz eines Abos in Cent (brutto).
 *
 * - basic/plus: Einheitenpreis nach Mengenstaffel × Einheiten + 1 € je
 *   Stellplatz (flach, ohne Staffel — Stellplätze zählen nie in die Staffel
 *   oder die 12er-Grenze, die gilt nur für Wohn-/Gewerbeeinheiten).
 * - free (Start): 0 — auch die Stellplätze kosten im Start-Tarif nichts.
 * - pro (B&W-Pauschale): 0, solange kein Preis hinterlegt ist
 *   (PLANS.pro.monthlyPriceCents === null). Der Ingest zählt solche Abos
 *   trotzdem als aktiv und vermerkt sie im Protokoll, statt sie stumm mit
 *   einem erfundenen Betrag zu füllen.
 *
 * Oberhalb der 12er-Grenze rechnet die Funktion weiter (20-%-Staffel): Die
 * Grenze sperrt den Self-Service-CHECKOUT — ein bestehendes Abo, das durch
 * nachgetragene Einheiten darüber liegt, erzeugt trotzdem echten Umsatz.
 */
export function mrrCentsFuer(
  plan: PlanId | string,
  einheiten: number,
  stellplaetze: number,
): number {
  if (plan !== "basic" && plan !== "plus") return 0;
  if (einheiten <= 0 && stellplaetze <= 0) return 0;
  const einheitenCents =
    einheiten > 0 ? checkoutJeEinheitCents(plan, einheiten) * einheiten : 0;
  return einheitenCents + Math.max(0, stellplaetze) * STELLPLATZ_CENTS;
}

/**
 * Churn-Quote eines Zeitraums: Kündigungen bezogen auf den Abo-Bestand zu
 * BEGINN des Zeitraums. null, wenn es zu Beginn keine Abos gab — eine Quote
 * ohne Grundmenge ist keine.
 */
export function churnQuote(gekuendigt: number, bestandZuBeginn: number): number | null {
  if (bestandZuBeginn <= 0) return null;
  return gekuendigt / bestandZuBeginn;
}

/** "4,2 %" — deutsche Prozentdarstellung mit einer Nachkommastelle. */
export function formatProzent(anteil: number): string {
  return `${new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(anteil * 100)} %`;
}
