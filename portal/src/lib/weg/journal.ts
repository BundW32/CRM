// Journal (Grundbuch) und Kontoblatt — die beiden Auszüge, nach denen jeder
// fragt, der die Buchhaltung von außen ansieht: der Verwaltungsbeirat bei der
// Rechnungsprüfung, der Steuerberater, der Nachfolger nach einem
// Verwalterwechsel.
//
// **Journal** = alle Buchungen eines Zeitraums in zeitlicher Reihenfolge. Es
// beantwortet „was ist passiert".
//
// **Kontoblatt** = alle Buchungen **eines** Kontos mit fortlaufendem Saldo. Es
// beantwortet „stimmt der Kontostand", und genau das gleicht man gegen den
// Bankauszug ab.
//
// **Stornos bleiben drin und werden gekennzeichnet.** Das ist keine
// Nachlässigkeit, sondern der Kern der Sache: Eine Buchhaltung, aus der etwas
// spurlos verschwindet, ist als Nachweis wertlos. Im Saldo heben sich Original
// und Gegenbuchung von selbst auf, weil die Gegenbuchung die umgekehrte
// Richtung trägt — es muss also nichts herausgerechnet werden, nur beschriftet.
// (In der Kostenverteilung ist das anders; dort greift `NOT_REVERSED`.)

export type JournalBuchung = {
  id: string;
  bookingDate: Date;
  valueDate: Date | null;
  kind: "EINNAHME" | "AUSGABE" | "UMBUCHUNG";
  /** Nur bei UMBUCHUNG belegt: true = Geld verlässt dieses Konto. */
  transferOut: boolean | null;
  /** Immer positiv; die Richtung steckt in `kind`/`transferOut`. */
  amountCents: number;
  text: string;
  reference: string | null;
  counterparty: string | null;
  accountName: string;
  costTypeName: string | null;
  unitLabel: string | null;
  craftsmanName: string | null;
  hatBeleg: boolean;
  /** Diese Buchung wurde durch eine Gegenbuchung neutralisiert. */
  storniert: boolean;
  /** Diese Buchung **ist** die Gegenbuchung zu einer anderen. */
  istStorno: boolean;
};

/**
 * Vorzeichenrichtiger Betrag einer Buchung.
 *
 * Der bewusst einzige Ort, an dem diese Regel steht. Sie sah vorher an mehreren
 * Stellen gleich aus — und genau solche Kopien laufen auseinander, sobald eine
 * vierte Buchungsart dazukommt. Wer den Saldo eines Kontos bildet, ruft das hier.
 */
export function vorzeichenBetrag(b: {
  kind: string;
  transferOut: boolean | null;
  amountCents: number;
}): number {
  if (b.kind === "EINNAHME") return b.amountCents;
  if (b.kind === "AUSGABE") return -b.amountCents;
  // UMBUCHUNG: dieselbe Summe steht auf beiden beteiligten Konten, einmal
  // abgehend, einmal zugehend.
  return b.transferOut ? -b.amountCents : b.amountCents;
}

export type KontoblattZeile = {
  buchung: JournalBuchung;
  /** Vorzeichenrichtiger Betrag dieser Zeile. */
  betragCents: number;
  /** Kontostand **nach** dieser Buchung. */
  saldoCents: number;
};

export type Kontoblatt = {
  kontoName: string;
  anfangsbestandCents: number;
  zeilen: KontoblattZeile[];
  endbestandCents: number;
  /** Summe aller Zugänge im Zeitraum (Stornos eingerechnet). */
  zugangCents: number;
  /** Summe aller Abgänge im Zeitraum, als positive Zahl. */
  abgangCents: number;
};

/**
 * Ein Kontoblatt aus Anfangsbestand und den Buchungen des Zeitraums.
 *
 * `buchungen` muss bereits auf das Konto und den Zeitraum eingegrenzt sein; die
 * Reihenfolge stellt diese Funktion selbst her. Sortiert wird nach Buchungsdatum
 * und **bei Gleichstand nach `id`** — nicht nach Anlagezeitpunkt: Zwei Buchungen
 * am selben Tag müssen in jedem Aufruf dieselbe Reihenfolge haben, sonst
 * springen die Zwischensalden zwischen zwei Exporten desselben Zeitraums.
 */
export function baueKontoblatt(opt: {
  kontoName: string;
  anfangsbestandCents: number;
  buchungen: JournalBuchung[];
}): Kontoblatt {
  const sortiert = [...opt.buchungen].sort(
    (a, b) => a.bookingDate.getTime() - b.bookingDate.getTime() || a.id.localeCompare(b.id),
  );

  let saldo = opt.anfangsbestandCents;
  let zugangCents = 0;
  let abgangCents = 0;
  const zeilen: KontoblattZeile[] = sortiert.map((buchung) => {
    const betragCents = vorzeichenBetrag(buchung);
    if (betragCents >= 0) zugangCents += betragCents;
    else abgangCents += -betragCents;
    saldo += betragCents;
    return { buchung, betragCents, saldoCents: saldo };
  });

  return {
    kontoName: opt.kontoName,
    anfangsbestandCents: opt.anfangsbestandCents,
    zeilen,
    endbestandCents: saldo,
    zugangCents,
    abgangCents,
  };
}

/** Journal: zeitliche Reihenfolge über alle Konten, gleiche Sortierregel. */
export function sortiereJournal(buchungen: JournalBuchung[]): JournalBuchung[] {
  return [...buchungen].sort(
    (a, b) => a.bookingDate.getTime() - b.bookingDate.getTime() || a.id.localeCompare(b.id),
  );
}

// ── CSV-Zeilen ──────────────────────────────────────────────────────────────
// Die Aufbereitung fürs CSV steht hier und nicht in der Route: Sie ist die
// eigentliche Aussage des Exports und gehört damit unter Test. Die Route macht
// nur noch Zugriffsprüfung, Datenbankabfrage und Antwort.

const datum = (d: Date | null): string =>
  d
    ? `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`
    : "";

/**
 * Cent als deutsche Dezimalzahl — **ohne** Euro-Zeichen und ohne
 * Tausenderpunkt.
 *
 * Klingt nach einer Verschlechterung gegenüber der Oberfläche, ist aber der
 * Punkt: Excel-DE erkennt „1234,56" als Zahl und kann damit rechnen. „1.234,56 €"
 * landet als Text in der Zelle, und dann summiert der Steuerberater eine Spalte,
 * die sich nicht summieren lässt.
 */
export function csvBetrag(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

const kennzeichen = (b: JournalBuchung): string =>
  b.istStorno ? "Storno" : b.storniert ? "storniert" : "";

export const JOURNAL_KOPF = [
  "Nr.",
  "Buchungsdatum",
  "Wertstellung",
  "Konto",
  "Art",
  "Text",
  "Verwendungszweck",
  "Zahlungspartner",
  "Kostenart",
  "Einheit",
  "Handwerker",
  "Einnahme",
  "Ausgabe",
  "Beleg",
  "Hinweis",
] as const;

export function journalZeilen(buchungen: JournalBuchung[]): unknown[][] {
  return sortiereJournal(buchungen).map((b, i) => {
    const betrag = vorzeichenBetrag(b);
    return [
      i + 1,
      datum(b.bookingDate),
      datum(b.valueDate),
      b.accountName,
      b.kind === "UMBUCHUNG" ? (b.transferOut ? "Umbuchung ab" : "Umbuchung zu") : b.kind,
      b.text,
      b.reference ?? "",
      b.counterparty ?? "",
      b.costTypeName ?? "",
      b.unitLabel ?? "",
      b.craftsmanName ?? "",
      // Zwei Spalten statt einer vorzeichenbehafteten: So steht in jeder Spalte
      // nur eine Richtung, und man kann beide getrennt summieren — genau das
      // macht die Gegenprobe gegen den Kontoauszug.
      betrag > 0 ? csvBetrag(betrag) : "",
      betrag < 0 ? csvBetrag(-betrag) : "",
      b.hatBeleg ? "ja" : "",
      kennzeichen(b),
    ];
  });
}

export const KONTOBLATT_KOPF = [
  "Nr.",
  "Buchungsdatum",
  "Wertstellung",
  "Text",
  "Verwendungszweck",
  "Zahlungspartner",
  "Kostenart",
  "Zugang",
  "Abgang",
  "Saldo",
  "Beleg",
  "Hinweis",
] as const;

/**
 * Kontoblatt als CSV-Zeilen, mit Anfangsbestand als erster und Endbestand als
 * letzter Zeile.
 *
 * Die beiden Randzeilen sind nicht Zierde: Ohne Anfangsbestand lässt sich der
 * Saldo nicht nachvollziehen, und ohne Endbestand muss man die Datei bis unten
 * lesen, um die eine Zahl zu finden, wegen der man sie geöffnet hat.
 */
export function kontoblattZeilen(blatt: Kontoblatt): unknown[][] {
  const leer = (n: number) => Array.from({ length: n }, () => "");
  return [
    ["", "", "", "Anfangsbestand", ...leer(5), csvBetrag(blatt.anfangsbestandCents), "", ""],
    ...blatt.zeilen.map((z, i) => [
      i + 1,
      datum(z.buchung.bookingDate),
      datum(z.buchung.valueDate),
      z.buchung.text,
      z.buchung.reference ?? "",
      z.buchung.counterparty ?? "",
      z.buchung.costTypeName ?? "",
      z.betragCents > 0 ? csvBetrag(z.betragCents) : "",
      z.betragCents < 0 ? csvBetrag(-z.betragCents) : "",
      csvBetrag(z.saldoCents),
      z.buchung.hatBeleg ? "ja" : "",
      kennzeichen(z.buchung),
    ]),
    [
      "",
      "",
      "",
      "Summe Zeitraum",
      ...leer(3),
      csvBetrag(blatt.zugangCents),
      csvBetrag(blatt.abgangCents),
      "",
      "",
      "",
    ],
    ["", "", "", "Endbestand", ...leer(5), csvBetrag(blatt.endbestandCents), "", ""],
  ];
}
