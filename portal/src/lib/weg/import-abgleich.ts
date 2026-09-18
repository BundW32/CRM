// Abgleich eines Bankimports gegen Buchungen, die schon von Hand erfasst sind.
//
// Der Fall aus dem Produkttest (09/2026): Eine Handwerkerrechnung wird über
// „Als bezahlt buchen" erfasst — Beleg dran, Kostenart gesetzt, Verbindlichkeit
// beglichen. Wochen später kommt der Kontoauszug herein, und dieselbe
// Überweisung steht ein zweites Mal im Buch: Der Duplikatschutz kennt nur den
// `dedupeHash`, und den hat eine manuelle Buchung nicht. Die Kontenabstimmung
// meldet die Abweichung erst zum Jahresende.
//
// Dieses Modul findet zu einer importierten Zeile die manuelle Buchung, die
// dieselbe Zahlung sein könnte: gleiches Konto (Aufrufer filtert), gleiche
// Richtung, gleicher Betrag, Buchungstag im Toleranzfenster. Der Verwalter
// entscheidet in der Vorschau, ob zusammengeführt wird — die Vorgabe ist ja,
// weil der Fall häufig ist und die manuelle Buchung mehr weiß (Beleg,
// Kostenart, Lohnanteil, Verbindlichkeit) als der Bankumsatz.
//
// Pure Funktion, keine DB. Jede manuelle Buchung wird höchstens einer Zeile
// zugeordnet und umgekehrt; bei mehreren Kandidaten gewinnt der nächste Tag.
import type { ParsedBooking } from "./bank-import";

/** Eine manuelle Buchung, so weit der Abgleich sie braucht. */
export type ManuelleBuchung = {
  id: string;
  bookingDate: Date;
  kind: "EINNAHME" | "AUSGABE";
  amountCents: number;
  text: string;
  counterparty?: string | null;
  costTypeName?: string | null;
  hatBeleg: boolean;
  /** Titel der Verbindlichkeit, die diese Buchung bezahlt hat (falls verknüpft). */
  verbindlichkeitTitel?: string | null;
};

export type Zwilling = {
  /** `dedupeHash` der importierten Zeile. */
  hash: string;
  buchung: ManuelleBuchung;
  /** Abstand der Buchungstage in Tagen (0 = gleicher Tag). */
  tageAbstand: number;
};

/** Wie viele Tage der Buchungstag der Handbuchung vom Bankumsatz abweichen darf. */
export const ZWILLING_TOLERANZ_TAGE = 5;

const TAG_MS = 86_400_000;

function tageZwischen(a: Date, b: Date): number {
  return Math.abs(Math.round((a.getTime() - b.getTime()) / TAG_MS));
}

/**
 * Findet zu importierten Zeilen die manuellen Buchungen, die dieselbe Zahlung
 * sein könnten. Ergebnis: je Zeilen-Hash höchstens ein Zwilling.
 */
export function findeManuelleZwillinge(
  zeilen: ParsedBooking[],
  manuelle: ManuelleBuchung[],
  toleranzTage = ZWILLING_TOLERANZ_TAGE,
): Map<string, Zwilling> {
  // Alle Kandidatenpaare sammeln und nach Nähe sortieren; dann gierig
  // zuordnen, sodass jede Seite nur einmal vorkommt. So bekommt bei zwei
  // gleichen Beträgen jede Zeile die zeitlich passendste Buchung.
  const paare: Zwilling[] = [];
  for (const zeile of zeilen) {
    for (const b of manuelle) {
      if (b.kind !== zeile.kind || b.amountCents !== zeile.amountCents) continue;
      const abstand = tageZwischen(zeile.bookingDate, b.bookingDate);
      if (abstand > toleranzTage) continue;
      paare.push({ hash: zeile.dedupeHash, buchung: b, tageAbstand: abstand });
    }
  }
  paare.sort((x, y) => x.tageAbstand - y.tageAbstand);

  const ergebnis = new Map<string, Zwilling>();
  const vergeben = new Set<string>();
  for (const p of paare) {
    if (ergebnis.has(p.hash) || vergeben.has(p.buchung.id)) continue;
    ergebnis.set(p.hash, p);
    vergeben.add(p.buchung.id);
  }
  return ergebnis;
}
