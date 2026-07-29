// Verzugszinsen und Mahnkosten (§§ 286, 288, 247 BGB).
//
// **Warum das gebraucht wird.** Zahlt ein Eigentümer sein Hausgeld nicht,
// tragen die übrigen die Lücke — die Gemeinschaft muss ihre Rechnungen trotzdem
// bezahlen. Der Verzugsschaden gehört deshalb der Gemeinschaft, nicht dem
// Schuldner. Bisher rechnete das Programm ihn nirgends aus: Die Aufteilung nach
// § 367 BGB war eingebaut, bekam aber für Kosten und Zinsen immer 0 geliefert.
//
// **Wann Verzug eintritt.** Hausgeld aus einem beschlossenen Wirtschaftsplan ist
// **kalendermäßig bestimmt** (§ 286 Abs. 2 Nr. 1 BGB) — die Fälligkeit ergibt
// sich aus dem Beschluss, nicht aus einer Mahnung. Verzug tritt also mit
// Ablauf des Fälligkeitstages ein, ohne dass gemahnt werden muss. Die Mahnung
// bleibt trotzdem wichtig: für den Nachweis und für § 366 Abs. 2 BGB.
//
// **Welcher Zinssatz.** § 288 Abs. 1 BGB: fünf Prozentpunkte über dem
// Basiszinssatz. Die erhöhten neun Punkte des Absatzes 2 gelten nur bei
// Entgeltforderungen ohne Beteiligung eines Verbrauchers — der Wohnungseigentümer
// ist regelmäßig Verbraucher. Wer hier neun Punkte ansetzte, forderte zu viel;
// eine Mahnung mit überhöhter Zinsforderung ist angreifbar.

/** Aufschlag auf den Basiszinssatz in Prozentpunkten (§ 288 Abs. 1 Satz 2 BGB). */
export const VERZUGSAUFSCHLAG_PUNKTE = 5;

/**
 * Ein Basiszinssatz mit seinem Geltungsbeginn.
 *
 * Der Satz ändert sich halbjährlich zum 1. Januar und 1. Juli (§ 247 Abs. 2
 * BGB) und wird von der Deutschen Bundesbank bekanntgegeben.
 *
 * **Bewusst Daten und keine Tabelle im Quelltext.** Ein einprogrammierter Wert
 * ist ab dem nächsten Halbjahr falsch, und niemand merkt es — das Programm
 * rechnete einfach weiter, mit veralteten Zahlen, in einer Mahnung, die nach
 * außen geht. Die Sätze werden deshalb gepflegt, nicht geraten.
 */
export type Basiszinssatz = {
  /** Gilt ab diesem Tag (einschließlich). */
  gueltigAb: Date;
  /** In Basispunkten, damit nichts gerundet wird: −0,88 % = −88. */
  basispunkte: number;
};

export type Zinsergebnis =
  | { berechenbar: true; zinsenCents: number; tage: number }
  | {
      berechenbar: false;
      /** Ab wann der Basiszinssatz fehlt — die Meldung nennt diesen Tag. */
      luecke: Date;
    };

/** Der am Stichtag geltende Satz, oder `null`, wenn keiner hinterlegt ist. */
export function satzAm(saetze: Basiszinssatz[], tag: Date): Basiszinssatz | null {
  let treffer: Basiszinssatz | null = null;
  for (const s of saetze) {
    if (s.gueltigAb <= tag && (!treffer || s.gueltigAb > treffer.gueltigAb)) treffer = s;
  }
  return treffer;
}

const TAG_MS = 24 * 60 * 60 * 1000;

function aufTag(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Tage im Jahr des Datums — Schaltjahre zählen 366 (§ 187 Abs. 1, § 188 BGB). */
function tageImJahr(d: Date): number {
  const jahr = d.getFullYear();
  return (jahr % 4 === 0 && jahr % 100 !== 0) || jahr % 400 === 0 ? 366 : 365;
}

/**
 * Verzugszinsen auf einen offenen Betrag.
 *
 * @param hauptCents  Die offene Hauptforderung. Zinsen werden **nur** darauf
 *                    berechnet — nicht auf Mahnkosten und nicht auf bereits
 *                    aufgelaufene Zinsen (§ 289 Satz 1 BGB verbietet
 *                    Zinseszinsen).
 * @param faellig     Tag der Fälligkeit. Verzug beginnt am **Folgetag**
 *                    (§ 187 Abs. 1 BGB: der Ereignistag zählt nicht mit).
 * @param bis         Stichtag der Berechnung (einschließlich).
 *
 * Gerechnet wird **taggenau** und je Zinsperiode getrennt, weil der
 * Basiszinssatz halbjährlich wechselt. Über ein ganzes Jahr mit einem
 * Durchschnittssatz zu rechnen wäre einfacher und falsch.
 */
export function verzugszinsen(opt: {
  hauptCents: number;
  faellig: Date;
  bis: Date;
  saetze: Basiszinssatz[];
}): Zinsergebnis {
  if (opt.hauptCents <= 0) return { berechenbar: true, zinsenCents: 0, tage: 0 };

  const start = new Date(aufTag(opt.faellig).getTime() + TAG_MS); // erster Verzugstag
  const ende = aufTag(opt.bis);
  if (ende < start) return { berechenbar: true, zinsenCents: 0, tage: 0 };

  // Auf ganze Cent wird **erst am Ende** gerundet. Wer je Halbjahr rundet,
  // sammelt bei langen Rückständen sichtbare Abweichungen an.
  let summe = 0;
  let tage = 0;
  for (let tag = start; tag <= ende; tag = new Date(tag.getTime() + TAG_MS)) {
    const satz = satzAm(opt.saetze, tag);
    // Kein Satz hinterlegt: **nicht** mit dem letzten bekannten weiterrechnen.
    // Ein stillschweigend fortgeschriebener Zinssatz landet sonst in einer
    // Mahnung, die nach außen geht, und niemand merkt, dass er veraltet ist.
    if (!satz) return { berechenbar: false, luecke: tag };
    const jahresProzent = satz.basispunkte / 100 + VERZUGSAUFSCHLAG_PUNKTE;
    summe += (opt.hauptCents * jahresProzent) / 100 / tageImJahr(tag);
    tage += 1;
  }
  return { berechenbar: true, zinsenCents: Math.round(summe), tage };
}

/**
 * Der Zinssatz, der in der Mahnung genannt wird — für die Anzeige.
 *
 * Eine Mahnung muss nachvollziehbar sein: Wer nur einen Endbetrag nennt, gibt
 * dem Schuldner nichts, was er prüfen kann. Genau das war der Grund, warum die
 * Zahlungsanrechnung überhaupt gebaut wurde.
 */
export function zinssatzProzent(satz: Basiszinssatz): number {
  return satz.basispunkte / 100 + VERZUGSAUFSCHLAG_PUNKTE;
}
