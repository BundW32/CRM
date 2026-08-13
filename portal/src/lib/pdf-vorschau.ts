// Grenzen der PDF-Vorschau (components/file-preview.tsx).
//
// Warum das hier steht und nicht in der Komponente: Es sind reine Rechnungen,
// und genau sie entscheiden, ob die Vorschau den Tab abschießt. Als Funktionen
// lassen sie sich prüfen (`pdf-vorschau.test.ts`); in der Komponente verteilt
// wären sie nur im Browser nachvollziehbar — und dort merkt man den Fehler
// erst, wenn der Tab weg ist.
//
// Der Anlass, gemessen am 13.08.2026 mit einem erzeugten Einzelwirtschaftsplan
// (eine A4-Seite je Einheit) im gebauten Portal:
//
//   150 Seiten, einmal durchgescrollt, Zoom 3×
//   → 150 belegte Leinwände, 2.249 Megapixel, ~8,6 GB Bitmap
//   → Renderer-Prozess weg (Tab tot), JS-Heap dabei 12 MB.
//
// Die 12 MB sind der Grund, warum das lange unentdeckt blieb: Leinwand-Bitmaps
// liegen NICHT im JS-Heap. Jede Speichermessung im Browser-Werkzeug sagt
// „alles ruhig", während der Prozess auf mehrere Gigabyte zuläuft.
//
// Drei Grenzen greifen deshalb ineinander:
//  1. das Fenster (wie viele Seiten überhaupt gleichzeitig belegt sind),
//  2. das Pixelbudget (wie fein sie gerendert werden dürfen),
//  3. die harte Grenze einer einzelnen Leinwand (Browser-Vorgabe).

/**
 * Seiten links und rechts der aktuellen, die zugleich als Bitmap vorgehalten
 * werden. Ergibt das Fenster von höchstens 2·RADIUS+1 Leinwänden — der Wert,
 * mit dem das Budget unten rechnet.
 */
export const FENSTER_RADIUS = 2;

/** Höchstzahl gleichzeitig belegter Leinwände. */
export const FENSTER_SEITEN = 2 * FENSTER_RADIUS + 1;

/**
 * Gesamtbudget an Bildpunkten für alle Leinwände zusammen. Auf dem Telefon
 * strenger: Dort ist nicht nur weniger Speicher da, das Betriebssystem
 * beendet den Tab auch früher und ohne Rückfrage.
 *
 * 80 Megapixel sind ~305 MB Bitmap (4 Byte je Punkt) — viel, aber eine
 * Größenordnung unter dem, was den Prozess kostet.
 */
export const BUDGET_MOBIL = 24_000_000;
export const BUDGET_TABLET = 48_000_000;
export const BUDGET_DESKTOP = 80_000_000;

/**
 * Harte Grenzen einer EINZELNEN Leinwand. Kein Budget, sondern eine
 * Browser-Vorgabe: iOS Safari liefert oberhalb davon eine leere Leinwand
 * zurück, ohne Fehler — die Seite bliebe weiß, und niemand sähe warum.
 */
export const MAX_LEINWAND_FLAECHE = 16_000_000;
export const MAX_LEINWAND_KANTE = 4096;

/** Feinheit, unter die auch das Budget nicht drücken darf — sonst matscht die Schrift. */
export const MIN_AUFLOESUNG = 0.75;
/** Feiner als doppelt bringt auf keinem Gerät sichtbar etwas, kostet aber das Vierfache. */
export const MAX_AUFLOESUNG = 2;

/** Ab hier wird nicht mehr ungefragt gerendert, sondern gefragt. */
export const RUECKFRAGE_SEITEN = 20;
export const RUECKFRAGE_BYTES = 15 * 1024 * 1024;

export function pixelBudget(fensterBreite: number): number {
  if (fensterBreite < 640) return BUDGET_MOBIL;
  if (fensterBreite < 1024) return BUDGET_TABLET;
  return BUDGET_DESKTOP;
}

/**
 * Die Auflösung, mit der eine Seite gerendert werden darf: das Kleinste aus
 * Gerätewunsch, Pixelbudget und Leinwandgrenze.
 *
 * Der Zoom steckt bereits in `cssBreite`/`cssHoehe` — genau deshalb bremst
 * dieselbe Rechnung sowohl große Dokumente als auch starkes Vergrößern. Vorher
 * ging beides ungebremst ins Produkt: 3× Zoom ist die neunfache Fläche.
 */
export function renderAufloesung({
  cssBreite,
  cssHoehe,
  geraeteRatio,
  budget,
  seitenImFenster = FENSTER_SEITEN,
}: {
  cssBreite: number;
  cssHoehe: number;
  geraeteRatio: number;
  budget: number;
  seitenImFenster?: number;
}): number {
  const flaeche = cssBreite * cssHoehe;
  if (!(flaeche > 0)) return 1;

  const proSeite = budget / Math.max(1, seitenImFenster);
  const ausBudget = Math.sqrt(proSeite / flaeche);
  const gewuenscht = Math.min(Math.max(geraeteRatio, MIN_AUFLOESUNG), MAX_AUFLOESUNG);

  // Lesbarkeit hat Vorrang vor dem Budget: lieber eine Seite weniger scharf
  // als eine, auf der man nichts entziffert.
  const weich = Math.max(MIN_AUFLOESUNG, Math.min(gewuenscht, ausBudget));

  // Die Leinwandgrenze ist dagegen nicht verhandelbar.
  const hart = Math.min(
    Math.sqrt(MAX_LEINWAND_FLAECHE / flaeche),
    MAX_LEINWAND_KANTE / Math.max(cssBreite, cssHoehe),
  );
  return Math.min(weich, hart);
}

/** Liegt `seite` im Fenster um `mitte`? Alles außerhalb gibt seine Leinwand frei. */
export function imFenster(seite: number, mitte: number, radius = FENSTER_RADIUS): boolean {
  return Math.abs(seite - mitte) <= radius;
}

/**
 * Welche Seite liegt auf der Höhe `hoehe` des Dokuments? Binäre Suche über die
 * oberen Kanten der Platzhalter, `obenVon(i)` muss also aufsteigend sein.
 *
 * Warum nicht per IntersectionObserver: Der erste Anlauf bestimmte die
 * Fenstermitte aus einem Beobachter mit Schwelle 0,5. Bei 3× Zoom ist eine
 * Seite höher als der Ausschnitt, ihr Anteil erreicht diese Schwelle nie — die
 * Mitte blieb bei Seite 56 stehen, während man längst auf Seite 76 stand. Die
 * dort sichtbare Seite lag damit außerhalb des Fensters und blieb weiß.
 * Die Scrollposition kennt die Antwort dagegen genau.
 */
export function seiteBeiHoehe(
  anzahl: number,
  obenVon: (index: number) => number,
  hoehe: number,
): number {
  if (anzahl <= 0) return 1;
  let tief = 0;
  let hoch = anzahl - 1;
  let treffer = 0;
  while (tief <= hoch) {
    const mitte = (tief + hoch) >> 1;
    if (obenVon(mitte) <= hoehe) {
      treffer = mitte;
      tief = mitte + 1;
    } else {
      hoch = mitte - 1;
    }
  }
  return treffer + 1;
}

/**
 * Soll vor dem Rendern gefragt werden? Ein Einzelwirtschaftsplan „alle
 * Einheiten" hat eine Seite je Einheit; auf dem Telefon ist das Herunterladen
 * dann oft das Bessere, und ungefragt loszurendern ist die schlechteste der
 * beiden Antworten.
 */
export function rueckfrageNoetig({ seiten, bytes }: { seiten: number; bytes: number }): boolean {
  return seiten > RUECKFRAGE_SEITEN || bytes > RUECKFRAGE_BYTES;
}

/**
 * Reiht Renderaufträge auf `grenze` gleichzeitige ein.
 *
 * Ohne das startet jede Zoomänderung alle sichtbaren Seiten auf einmal — sie
 * teilen sich denselben Worker, werden dadurch nicht schneller fertig, halten
 * aber alle zugleich ihre Zwischenpuffer. Zwei gleichzeitig hält den Worker
 * beschäftigt, ohne dass sich die Spitze aufaddiert.
 */
export function renderSchlange(grenze: number) {
  let laufend = 0;
  const wartend: (() => void)[] = [];

  const freigeben = () => {
    laufend--;
    const naechster = wartend.shift();
    if (naechster) {
      laufend++;
      naechster();
    }
  };

  return function anstellen<T>(aufgabe: () => Promise<T>): Promise<T> {
    // Der Platz wird SYNCHRON belegt. Zählt man erst im `then`, sind alle
    // Aufrufe eines Durchgangs längst durch, bevor der Zähler steigt — die
    // Schlange ließe dann jede Zahl gleichzeitig durch und wäre wirkungslos.
    let platz: Promise<void>;
    if (laufend < grenze) {
      laufend++;
      platz = Promise.resolve();
    } else {
      platz = new Promise<void>((weiter) => {
        wartend.push(weiter);
      });
    }

    return platz.then(() =>
      aufgabe().then(
        (wert) => {
          freigeben();
          return wert;
        },
        (fehler) => {
          freigeben();
          throw fehler;
        },
      ),
    );
  };
}
