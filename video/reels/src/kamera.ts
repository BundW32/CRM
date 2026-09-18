/** Was eine Einstellung mit dem Bild macht. */
export type Kamerafahrt = {
  zoomVon?: number;
  zoomBis?: number;
  versatzY?: number;
};

/** Weiter als das geht der Punch-in nie — darüber wird aus dem Porträt ein Close-up. */
export const MAX_ZOOM = 1.14;

/**
 * Legt die Punch-ins über die Segmente.
 *
 * Der Punch-in ist ein **Akzent, kein Dauerzustand**. Im ersten echten Reel
 * lief der Zoom über die ganze Länge immer weiter zu, bis das Bild viel zu nah
 * war — das passiert, sobald jedes Segment weiter zufährt als das vorige.
 *
 * Deshalb hier zwei feste Regeln:
 *   * Jedes Segment fängt wieder bei 1,0 an. Es gibt keine Fahrt, die sich
 *     über mehrere Einstellungen aufsummiert.
 *   * Nur jedes `jedes`-te Segment bekommt überhaupt eine Fahrt. Dazwischen
 *     steht das Bild still — sonst wirkt nichts mehr wie ein Akzent.
 *
 * Wer eine einzelne Stelle stärker betonen will, überschreibt sie danach von
 * Hand; das ist eine Entscheidung im Schnittplan und keine Automatik.
 */
export const kameraFahrten = (
  anzahlSegmente: number,
  { jedes = 3, staerke = 0.07, abSegment = 1 }: { jedes?: number; staerke?: number; abSegment?: number } = {},
): Kamerafahrt[] =>
  Array.from({ length: anzahlSegmente }, (_, i) => {
    const betont = i >= abSegment && (i - abSegment) % jedes === 0;
    if (!betont) return { zoomVon: 1, zoomBis: 1 };
    return { zoomVon: 1, zoomBis: Math.min(MAX_ZOOM, 1 + staerke) };
  });
