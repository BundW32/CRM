// Automatischer Abruf des Basiszinssatzes von der Deutschen Bundesbank.
//
// **Warum von der Quelle und nicht aus einem Sprachmodell.** Der Basiszinssatz
// nach § 247 BGB ist keine Wissensfrage, sondern eine amtlich veröffentlichte
// Zahl. Ein Modell würde sie *raten*, und ein geratener Zinssatz in einer
// Mahnung ist schlimmer als gar keiner — er sieht richtig aus. Die Bundesbank
// veröffentlicht ihn als Zeitreihe; von dort geholt ist er nachprüfbar.
//
// **Die Leitentscheidung dieses Moduls: lieber nichts als etwas Falsches.**
// Jede Unsicherheit endet in „nicht übernommen", nie in einem geschriebenen
// Wert. Der manuelle Weg bleibt daneben bestehen und hat Vorrang.
//
// **Was ich am Format nicht verifizieren konnte.** Beim Bau war die
// Bundesbank-Adresse aus der Entwicklungsumgebung nicht erreichbar (die
// Sicherheitsrichtlinie sperrte sie), die Antwort ließ sich also nicht ansehen.
// Deshalb ist der Parser **absichtlich formattolerant**: Er sucht in *jeder*
// Zeile nach einem Datum-Wert-Paar und ignoriert alles andere — Kopfzeilen,
// Metadaten, Reihenfolge der Spalten. Was er findet, muss dann drei harte
// Prüfungen bestehen. Ein Parser, der das Format genau kennen muss, wäre beim
// ersten Umbau der Seite still kaputt; dieser liefert dann schlicht kein
// Ergebnis, und das ist der ungefährliche Fall.

/** Zeitreihe des Basiszinssatzes nach § 247 BGB bei der Deutschen Bundesbank. */
export const BUNDESBANK_CSV_URL =
  "https://api.statistiken.bundesbank.de/rest/download/BBSIS/D.I.ZST.ZI.EUR.S1311.B.A604.R01XX.R.A.A._Z._Z.A?format=csv&lang=de";

export type Zinssatz = {
  /** Erster Geltungstag — nach § 247 Abs. 2 BGB immer ein 1.1. oder 1.7. */
  validFrom: Date;
  /** Ganzzahlige Basispunkte: 3,62 % = 362. */
  basisPoints: number;
};

/**
 * Plausibilitätsgrenzen in Prozent.
 *
 * Historisch lag der Satz zwischen −0,88 % und knapp 4 %. Die Grenzen sind
 * bewusst weit, aber nicht offen: Sie fangen den verrutschten Faktor 100 und
 * offensichtlichen Unsinn ab, ohne einen künftigen Zinsanstieg auszuschließen.
 * Dieselbe Spanne wie bei der Eingabe von Hand.
 */
export const MIN_PROZENT = -25;
export const MAX_PROZENT = 25;

/**
 * Ist dieser Tag ein möglicher Geltungsbeginn?
 *
 * § 247 Abs. 2 BGB: Der Satz ändert sich zum **1. Januar und 1. Juli**. Ein
 * Wert mit dem Datum 15. März ist damit kein Basiszinssatz, sondern ein
 * Lesefehler — und genau daran erkennt der Parser, dass er die falsche Spalte
 * erwischt hat.
 */
export function istGeltungsbeginn(d: Date): boolean {
  const tag = d.getUTCDate();
  const monat = d.getUTCMonth();
  return tag === 1 && (monat === 0 || monat === 6);
}

/**
 * Liest Datum-Wert-Paare aus der CSV-Antwort.
 *
 * Bewusst tolerant: Trennzeichen `;` oder `,`, Dezimaltrenner `.` oder `,`,
 * Anführungszeichen egal, Kopf- und Metazeilen fallen von selbst heraus, weil
 * sie keine der Prüfungen bestehen. Doppelte Datumsangaben gewinnt der **letzte**
 * Eintrag — Zeitreihen werden fortgeschrieben, spätere Zeilen sind die
 * korrigierten.
 *
 * **Das Trennzeichen wird je Zeile entschieden, nicht geraten.** Beides
 * gleichzeitig als Trenner zu behandeln geht nicht: Bei `2024-01-01;3,62` wäre
 * „3" und „62" zwei Spalten, und herausgekommen wäre **3,00 %** statt 3,62 % —
 * ein falscher Zinssatz, der völlig plausibel aussieht und in einer Mahnung
 * landet. Enthält die Zeile ein `;`, ist das der Trenner und `,` das
 * Dezimalzeichen; sonst umgekehrt. Genau diesen Fehler hat der Test gefunden.
 */
export function parseBundesbankCsv(text: string): Zinssatz[] {
  const gefunden = new Map<number, number>(); // Zeitstempel → Basispunkte

  for (const zeile of text.split(/\r?\n/)) {
    const trenner = zeile.includes(";") ? ";" : ",";
    const spalten = zeile.split(trenner);
    // Ein Datum im Format YYYY-MM-DD irgendwo in der Zeile.
    let datum: Date | null = null;
    let wert: number | null = null;

    for (const rohSpalte of spalten) {
      const s = rohSpalte.trim().replace(/^"|"$/g, "").trim();
      if (!s) continue;

      const treffer = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
      if (treffer && !datum) {
        datum = new Date(
          Date.UTC(Number(treffer[1]), Number(treffer[2]) - 1, Number(treffer[3])),
        );
        continue;
      }
      // Zahl mit Dezimalkomma oder -punkt. Erst nach dem Datum suchen, damit
      // „2016" aus einer Kopfzeile nicht als Wert gelesen wird.
      if (datum && wert === null && /^-?\d+([.,]\d+)?$/.test(s)) {
        // Ist `;` der Spaltentrenner, ist `,` das Dezimalzeichen. Ist `,` der
        // Trenner, kann in der Spalte nur noch `.` als Dezimalzeichen stehen.
        wert = Number(trenner === ";" ? s.replace(",", ".") : s);
      }
    }

    if (!datum || wert === null) continue;
    if (Number.isNaN(datum.getTime())) continue;
    if (!istGeltungsbeginn(datum)) continue;
    if (wert < MIN_PROZENT || wert > MAX_PROZENT) continue;

    gefunden.set(datum.getTime(), Math.round(wert * 100));
  }

  return [...gefunden.entries()]
    .map(([ts, basisPoints]) => ({ validFrom: new Date(ts), basisPoints }))
    .sort((a, b) => a.validFrom.getTime() - b.validFrom.getTime());
}

export type AbrufErgebnis =
  | { ok: true; saetze: Zinssatz[] }
  | { ok: false; grund: string };

/**
 * Holt die Zeitreihe und liest sie aus. Schreibt nichts.
 *
 * Jeder Fehlerfall — Netz, Statuscode, unlesbare Antwort, kein plausibler Wert —
 * endet in `{ ok: false }` mit einem Grund, den die Oberfläche anzeigen kann.
 * Eine Ausnahme fliegt nicht: Der Abruf ist ein Komfortmerkmal und darf nie
 * etwas blockieren.
 */
export async function holeZinssaetze(
  fetchImpl: typeof fetch = fetch,
): Promise<AbrufErgebnis> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15_000);
    const res = await fetchImpl(BUNDESBANK_CSV_URL, {
      signal: ctrl.signal,
      headers: { Accept: "text/csv,*/*" },
    }).finally(() => clearTimeout(timer));

    if (!res.ok) {
      return { ok: false, grund: `Die Bundesbank antwortete mit Status ${res.status}.` };
    }
    const text = await res.text();
    const saetze = parseBundesbankCsv(text);
    if (saetze.length === 0) {
      // Der wichtigste Fehlerfall: Antwort da, aber nichts Verwertbares darin.
      // Das heißt in der Regel, dass sich das Format geändert hat.
      return {
        ok: false,
        grund:
          "Die Antwort der Bundesbank enthielt keinen erkennbaren Basiszinssatz. " +
          "Vermutlich hat sich das Format geändert — bitte den Satz von Hand eintragen.",
      };
    }
    return { ok: true, saetze };
  } catch {
    return { ok: false, grund: "Die Bundesbank war nicht erreichbar." };
  }
}
