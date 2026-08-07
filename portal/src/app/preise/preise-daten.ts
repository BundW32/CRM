// Die Preise von wegportal24 — EINE Quelle für Tarifkarten, Rechner und die
// FAQ der Startseite. Wer einen Preis oder die Staffel ändert, ändert ihn
// hier und nirgendwo sonst.
//
// Modell, festgelegt vom Auftraggeber am 04.08.2026:
//   - BEIDE Tarife rechnen je Einheit und Monat. Es gibt keine Preisspaltung
//     nach Nutzern: Alle Zugänge (Eigentümer, Beirat, Mieter) sind immer
//     inklusive.
//   - Basic          10,00 € je Einheit
//   - Verwalter-Plus 13,90 € je Einheit, mit Ticket-System zu einem
//     zertifizierten Verwalter (§ 26a WEG)
//   - Mengenstaffel: je mehr Einheiten, desto günstiger wird die einzelne
//     Einheit.
//   - Grenze: 12 Einheiten. Größere Gemeinschaften sind kein
//     Selbstverwaltungs-Fall mehr — sie werden auf den direkten Kontakt zur
//     Verwaltung hinter dem Portal verwiesen (ohne Namensnennung auf der
//     Seite; die Betreiberin steht im Impressum).
//   - Der Einstieg bleibt kostenlos und ohne Zahlungsdaten.
//
// Die Rabattsätze der Staffel (10 % ab 5, 20 % ab 9) sind ein Vorschlag in
// bescheidener Höhe — der Auftraggeber hat die Degression angeordnet, aber
// keine Sätze genannt. Ändern heißt: nur diese Tabelle anfassen.

export const BASIC_JE_EINHEIT_EUR = 10;
export const PLUS_JE_EINHEIT_EUR = 13.9;

// Beide Beträge sind BRUTTOPREISE: Kundin ist die selbstverwaltende WEG als
// Verbraucherin, und die AGB (Stand 05.08.2026, Ziffer 6) weisen die Preise
// als Gesamtpreise einschließlich Umsatzsteuer aus. Die Seiten sagen das
// ausdrücklich dazu — Wettbewerber werben mit Nettopreisen, der Endbetrag
// ist das ehrliche Vergleichsmaß.

/**
 * Vergleichswert für die Ersparnis-Rechnung: marktübliche Grundvergütung
 * externer WEG-Verwaltungen (je nach Region meist 25–40 € je Einheit und
 * Monat, kleine Gemeinschaften eher am oberen Rand) — bewusst als Mittelwert
 * angesetzt und im Text stets als Beispielrechnung gekennzeichnet.
 */
export const VERGLEICH_VERWALTUNG_JE_EINHEIT_EUR = 30;

/**
 * Stellplätze und Garagen (Einheiten vom Typ STELLPLATZ): pauschal 1 € je
 * Stellplatz und Monat in BEIDEN Bezahltarifen, im Start-Tarif kostenlos.
 * Bewusst OHNE Mengenstaffel — der flache Preis liegt bereits unter dem
 * Wettbewerb (dort je nach Paket 1,00–2,80 €). Stellplätze zählen NICHT als
 * Einheiten: weder für die Rabattstaffel noch für die 12er-Grenze — die
 * bezieht sich auf die Wohn- und Gewerbeeinheiten der Gemeinschaft.
 */
export const STELLPLATZ_JE_MONAT_EUR = 1;

/**
 * Monatspreis der Gemeinschaft INKLUSIVE Stellplätze, in Euro — die eine
 * Rechnung für Preisrechner, Checkout und Abo-Anzeige. Die Staffel wirkt nur
 * auf die Einheiten, nie auf die Stellplätze.
 */
export function monatspreisGesamt(
  basisJeEinheit: number,
  einheiten: number,
  stellplaetze: number,
): number {
  return monatspreis(basisJeEinheit, einheiten) + stellplaetze * STELLPLATZ_JE_MONAT_EUR;
}

/** Oberhalb dieser Einheitenzahl gibt es keinen Self-Service-Tarif. */
export const MAX_EINHEITEN = 12;

/** Kleinste WEG: unter zwei Einheiten gibt es keine Gemeinschaft. */
export const MIN_EINHEITEN = 2;

/** Voreinstellung des Reglers — die Größe der Demo-Gemeinschaft. */
export const START_EINHEITEN = 6;

/** Mengenstaffel, absteigend sortiert; der erste passende Eintrag gilt. */
export const RABATT_STAFFEL = [
  { abEinheiten: 9, rabatt: 0.2 },
  { abEinheiten: 5, rabatt: 0.1 },
] as const;

export function rabattFuer(einheiten: number): number {
  for (const stufe of RABATT_STAFFEL) {
    if (einheiten >= stufe.abEinheiten) return stufe.rabatt;
  }
  return 0;
}

/** Effektiver Preis je Einheit nach Staffel, in Euro. */
export function jeEinheitNachStaffel(basisJeEinheit: number, einheiten: number): number {
  return basisJeEinheit * (1 - rabattFuer(einheiten));
}

/** Monatspreis der Gemeinschaft, in Euro. */
export function monatspreis(basisJeEinheit: number, einheiten: number): number {
  return einheiten * jeEinheitNachStaffel(basisJeEinheit, einheiten);
}
