// Anrechnung von Zahlungen auf offene Forderungen (§§ 366, 367 BGB).
//
// Bisher war der Rückstand einer Einheit „alle Sollstellungen minus alle
// Einnahmen dieser Einheit". Diese eine Subtraktion rechnet gleich vier Dinge
// falsch:
//
// - Die Zahlung einer **Sonderumlage** tilgte stillschweigend
//   Hausgeldrückstände. Der Eigentümer zahlte die Umlage und stand danach beim
//   Hausgeld scheinbar gut da — die Umlage aber offen.
// - Eine **Vorauszahlung** verschleierte einen Rückstand: Wer im Dezember das
//   ganze nächste Jahr überweist, hatte rechnerisch keinen Rückstand mehr,
//   obwohl der November unbezahlt blieb.
// - Eine **Sammelüberweisung** für zwei Einheiten ließ sich nicht aufteilen.
// - Die **Mahnung** nannte damit einen Betrag nach außen, den niemand prüfen
//   konnte — und der im Zweifel falsch war.
//
// Diese Datei bildet ab, was das BGB vorgibt: Zahlt jemand weniger als er
// schuldet und sagt nicht wofür, bestimmt das Gesetz die Reihenfolge.
//
// **§ 366 Abs. 2 BGB** (welche Forderung zuerst): fällige vor nicht fälligen;
// unter mehreren fälligen die dem Gläubiger *lästigere* — hier: die gemahnte;
// bei gleicher Lästigkeit die ältere.
//
// **§ 367 Abs. 1 BGB** (innerhalb einer Forderung): Kosten, dann Zinsen, dann
// Hauptforderung. Die Reihenfolge ist zwingend und lässt sich vom Schuldner
// nicht einseitig umkehren.
//
// Pure Funktionen — die Server-Action legt den Vorschlag dem Verwalter vor.

/** Eine offene Forderung mit ihren Bestandteilen (jeweils Restbetrag in Cent). */
export type OffenerPosten = {
  id: string;
  /** Fälligkeit — Grundlage für „fällig vor nicht fällig" und „ältere zuerst". */
  dueDate: Date;
  /** Offene Mahn- und Rechtsverfolgungskosten (§ 367: zuerst). */
  kostenCents?: number;
  /** Offene Verzugszinsen (§ 367: als zweites). */
  zinsenCents?: number;
  /** Offene Hauptforderung (§ 367: zuletzt). */
  hauptCents: number;
  /**
   * Wurde für diese Forderung bereits gemahnt? Nach § 366 Abs. 2 ist die
   * gemahnte Forderung die „lästigere" und wird vorrangig getilgt.
   */
  gemahnt?: boolean;
  /** Woher die Forderung stammt — Grundlage der Tilgungsbestimmung. */
  quelle: Tilgungszweck;
};

/**
 * Zweck einer Zahlung nach § 366 Abs. 1 BGB.
 *
 * Der Schuldner darf bei der Leistung bestimmen, welche Schuld getilgt werden
 * soll — und diese Bestimmung geht der gesetzlichen Reihenfolge **vor**. Steht
 * „Sonderumlage Dachsanierung" im Verwendungszweck, ist das eine solche
 * Bestimmung: Das Geld tilgt dann die Umlage, nicht das älteste Hausgeld.
 *
 * Lesen kann das nur ein Mensch — ein Verwendungszweck ist Fließtext, und eine
 * Fehldeutung verschiebt echtes Geld. Deshalb ist der Zweck eine Angabe des
 * Verwalters, keine Vermutung des Programms. `ALLE` heißt: keine Bestimmung
 * erkennbar, es gilt § 366 Abs. 2.
 */
export type Tilgungszweck = "ALLE" | "WIRTSCHAFTSPLAN" | "SONDERUMLAGE";

export type Zuordnung = {
  duePostingId: string;
  /** Gesamtbetrag, der auf diese Forderung angerechnet wird. */
  betragCents: number;
  /** Aufteilung nach § 367 — für die Erklärung an den Verwalter. */
  aufKostenCents: number;
  aufZinsenCents: number;
  aufHauptCents: number;
};

export type Vorschlag = {
  zuordnungen: Zuordnung[];
  /** Was von der Zahlung übrig bleibt (Überzahlung / Guthaben). */
  restCents: number;
};

/**
 * Reihenfolge nach § 366 Abs. 2 BGB.
 *
 * Exportiert, weil die Reihenfolge in der Oberfläche erklärt wird — und weil
 * eine Regel, die man nicht einzeln prüfen kann, früher oder später still
 * falsch wird.
 */
export function sortiereNachTilgungsreihenfolge(
  posten: OffenerPosten[],
  stichtag: Date,
): OffenerPosten[] {
  return [...posten].sort((a, b) => {
    const aFaellig = a.dueDate <= stichtag;
    const bFaellig = b.dueDate <= stichtag;
    if (aFaellig !== bFaellig) return aFaellig ? -1 : 1;
    // „Lästiger" ist, was bereits gemahnt wurde: Dort drohen Verzugsfolgen.
    const aLaestig = a.gemahnt === true;
    const bLaestig = b.gemahnt === true;
    if (aLaestig !== bLaestig) return aLaestig ? -1 : 1;
    // Bei gleicher Lästigkeit die ältere Forderung zuerst.
    const zeit = a.dueDate.getTime() - b.dueDate.getTime();
    if (zeit !== 0) return zeit;
    // Letzter Anker: die ID. Ohne ihn hinge die Reihenfolge bei gleichem Datum
    // an der Eingabereihenfolge — der Vorschlag wäre nicht reproduzierbar.
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/**
 * Schlägt vor, wie eine Zahlung auf die offenen Forderungen anzurechnen ist.
 *
 * Ausdrücklich ein **Vorschlag**: Der Verwalter bestätigt ihn oder ordnet von
 * Hand zu. Das Gesetz lässt dem Schuldner das Recht, bei der Zahlung eine
 * Tilgungsbestimmung zu treffen (§ 366 Abs. 1 BGB) — steht sie im
 * Verwendungszweck, geht sie dieser Reihenfolge vor. Das kann nur ein Mensch
 * lesen, deshalb wird hier nichts still gebucht.
 *
 * Ein Rest bleibt bewusst stehen, statt auf die nächste Forderung vorgetragen
 * zu werden, die noch nicht fällig ist: Eine Vorauszahlung ist ein Guthaben,
 * keine Tilgung — und sie darf einen Rückstand nicht verdecken.
 */
export function schlageZuordnungVor(
  zahlungCents: number,
  posten: OffenerPosten[],
  stichtag: Date = new Date(),
  zweck: Tilgungszweck = "ALLE",
): Vorschlag {
  if (!Number.isInteger(zahlungCents) || zahlungCents < 0) {
    throw new Error("Der Zahlbetrag muss eine nicht negative Ganzzahl (Cent) sein.");
  }
  let rest = zahlungCents;
  const zuordnungen: Zuordnung[] = [];

  // § 366 Abs. 1 geht Abs. 2 vor: Hat der Zahlende bestimmt, worauf er zahlt,
  // wird nur das getilgt — auch wenn eine ältere Forderung offen ist.
  const inFrage = zweck === "ALLE" ? posten : posten.filter((p) => p.quelle === zweck);

  for (const p of sortiereNachTilgungsreihenfolge(inFrage, stichtag)) {
    if (rest <= 0) break;
    // Nicht fällige Forderungen bleiben unangetastet — siehe oben.
    if (p.dueDate > stichtag) continue;

    // § 367 Abs. 1: Kosten, Zinsen, Hauptforderung — in dieser Reihenfolge.
    const nimm = (offen: number) => {
      const betrag = Math.min(Math.max(offen, 0), rest);
      rest -= betrag;
      return betrag;
    };
    const aufKostenCents = nimm(p.kostenCents ?? 0);
    const aufZinsenCents = nimm(p.zinsenCents ?? 0);
    const aufHauptCents = nimm(p.hauptCents);
    const betragCents = aufKostenCents + aufZinsenCents + aufHauptCents;
    if (betragCents > 0) {
      zuordnungen.push({ duePostingId: p.id, betragCents, aufKostenCents, aufZinsenCents, aufHauptCents });
    }
  }

  return { zuordnungen, restCents: rest };
}

// ── Offene Posten mit Altersstruktur (OPOS) ─────────────────────────────────
//
// Die Altersstruktur beantwortet die Frage, die eine bloße Summe offenlässt:
// Sind 1.200 € Rückstand ein Monat bei mehreren Eigentümern oder ein Jahr bei
// einem? Nur das Zweite rechtfertigt die nächste Mahnstufe — und im Ernstfall
// den Entzug des Wohnungseigentums (§ 17 WEG).

export const OPOS_BUCKETS = ["b0_30", "b31_60", "b61_90", "b90plus"] as const;
export type OposBucket = (typeof OPOS_BUCKETS)[number];

export const OPOS_BUCKET_LABELS: Record<OposBucket, string> = {
  b0_30: "0–30 Tage",
  b31_60: "31–60 Tage",
  b61_90: "61–90 Tage",
  b90plus: "über 90 Tage",
};

/** In welchen Alterskorb fällt eine Forderung, die am `dueDate` fällig war? */
export function oposBucketFor(dueDate: Date, stichtag: Date): OposBucket {
  const tage = Math.floor((stichtag.getTime() - dueDate.getTime()) / 86_400_000);
  if (tage <= 30) return "b0_30";
  if (tage <= 60) return "b31_60";
  if (tage <= 90) return "b61_90";
  return "b90plus";
}

export type OposZeile = {
  gesamtCents: number;
  /** Offener Betrag je Alterskorb. */
  buckets: Record<OposBucket, number>;
  /** Fälligkeit der ältesten offenen Forderung — die eigentliche Warnlampe. */
  aeltesteFaelligkeit: Date | null;
};

export function leereOposZeile(): OposZeile {
  return {
    gesamtCents: 0,
    buckets: { b0_30: 0, b31_60: 0, b61_90: 0, b90plus: 0 },
    aeltesteFaelligkeit: null,
  };
}

/**
 * Fasst offene Forderungen zu einer Altersstruktur zusammen.
 *
 * Nur **fällige** Forderungen zählen: Was noch nicht fällig ist, ist kein
 * Rückstand, sondern ein Termin.
 */
export function baueOpos(
  posten: { dueDate: Date; offenCents: number }[],
  stichtag: Date = new Date(),
): OposZeile {
  const zeile = leereOposZeile();
  for (const p of posten) {
    if (p.offenCents <= 0 || p.dueDate > stichtag) continue;
    zeile.gesamtCents += p.offenCents;
    zeile.buckets[oposBucketFor(p.dueDate, stichtag)] += p.offenCents;
    if (!zeile.aeltesteFaelligkeit || p.dueDate < zeile.aeltesteFaelligkeit) {
      zeile.aeltesteFaelligkeit = p.dueDate;
    }
  }
  return zeile;
}
