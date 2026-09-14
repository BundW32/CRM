// Miteigentumsanteile mit Nachkommastellen.
//
// Teilungserklärungen nennen den Anteil einer Einheit nicht immer als ganze
// Zahl: „250,17/1.000" oder „25,017/1.000" kommen vor, wenn die Anteile aus
// den Flächen abgeleitet wurden. Bisher war das Feld ganzzahlig — wer so eine
// Erklärung hatte, musste auf 100.000stel umrechnen (25.017 von 100.000) und
// bekam die Zahl dann in jeder Abrechnung so angezeigt, wie sie nirgends steht.
// Ein Testnutzer hat genau das gemeldet.
//
// Dieses Modul ist die eine Stelle für Lesen, Runden, Vergleichen, Anzeigen und
// Gewichten. Gespeichert wird als Gleitkommazahl (Prisma `Float`), gerundet auf
// vier Nachkommastellen — mehr nennt keine Teilungserklärung. Gerechnet wird
// **nie** mit der Gleitkommazahl selbst: Die Verteilung bekommt ganzzahlige
// Gewichte in Zehntausendsteln (`meaGewicht`), wie die Fläche in cm², und
// Summen werden gerundet verglichen (`meaGleich`), weil 250,17 + 749,83 in
// IEEE-754 nicht exakt 1000 ergibt.

export const MEA_NACHKOMMASTELLEN = 4;
const FAKTOR = 10 ** MEA_NACHKOMMASTELLEN;

/** Auf die gespeicherte Genauigkeit runden. */
export function rundeMea(n: number): number {
  return Math.round(n * FAKTOR) / FAKTOR;
}

/**
 * Formulareingabe → Anteil. Leer → null. Erlaubt sind deutsches Komma und
 * Punkt, Tausenderpunkte werden nicht angenommen (bei „1.000" ist nicht
 * entscheidbar, ob Tausend oder Eins gemeint ist — der Nenner steht dann
 * ohnehin als 1000 da). Ungültig oder negativ → undefined, damit der Aufrufer
 * die Eingabe ablehnen kann statt still null zu speichern.
 */
export function leseMea(raw: unknown): number | null | undefined {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (!/^\d+(?:[.,]\d{1,4})?$/.test(s)) return undefined;
  const n = Number(s.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return undefined;
  return rundeMea(n);
}

/** Ganzzahliges Gewicht für die Verteilung (Zehntausendstel) — keine Fließkomma-Artefakte. */
export function meaGewicht(mea: number): number {
  return Math.round(mea * FAKTOR);
}

/** Summe mehrerer Anteile, auf die gespeicherte Genauigkeit gerundet. */
export function summeMea(werte: Iterable<number | null | undefined>): number {
  let s = 0;
  for (const w of werte) s += meaGewicht(w ?? 0);
  return s / FAKTOR;
}

/** Zwei Anteile bzw. Summen gelten als gleich, wenn sie auf 4 Stellen übereinstimmen. */
export function meaGleich(a: number | null | undefined, b: number | null | undefined): boolean {
  if (a == null || b == null) return a == b;
  return meaGewicht(a) === meaGewicht(b);
}

const format = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 0,
  maximumFractionDigits: MEA_NACHKOMMASTELLEN,
});

/** Anzeige: „205", „250,17", „1.000" — so viele Stellen wie nötig, nicht mehr. */
export function formatMea(mea: number | null | undefined): string {
  return mea == null ? "—" : format.format(mea);
}

/** Wert für ein Eingabefeld: ohne Tausenderpunkt, mit Komma („250,17", „1000"). */
export function meaEingabe(mea: number | null | undefined): string {
  return mea == null ? "" : String(rundeMea(mea)).replace(".", ",");
}
