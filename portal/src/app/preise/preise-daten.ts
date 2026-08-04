// Die Preise von wegportal24 — EINE Quelle für Tarifkarten, Rechner und die
// FAQ der Startseite. Wer einen Preis oder die Staffel ändert, ändert ihn
// hier und nirgendwo sonst.
//
// Modell, festgelegt vom Auftraggeber am 04.08.2026:
//   - BEIDE Tarife rechnen je Einheit und Monat. Es gibt keine Preisspaltung
//     nach Nutzern: Alle Zugänge (Eigentümer, Beirat, Mieter, Handwerker)
//     sind immer inklusive.
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

/** Oberhalb dieser Einheitenzahl gibt es keinen Self-Service-Tarif. */
export const MAX_EINHEITEN = 12;

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
