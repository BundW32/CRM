// Liest ein erzeugtes PDF zurück und gibt jedes Textstück mit Position und
// Breite heraus. Damit prüfen die Tests das FERTIGE Dokument statt den Code,
// der es baut — Fehlplatzierungen wirft pdf-lib nicht, sie fallen sonst erst
// im Druck auf.
//
// Bewusst über pdf.js und nicht über den rohen Inhaltsstrom: bei eingebetteten
// Schriften stehen dort Glyph-Nummern statt lesbarer Zeichen, und die Breite
// ließe sich ohne die Schrifttabellen nicht ausrechnen.
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

export type DrawnText = {
  page: number;
  /** Punkt von links. */
  x: number;
  /** Punkt von unten. */
  y: number;
  width: number;
  text: string;
};

export async function drawnTexts(pdf: Uint8Array | Buffer): Promise<DrawnText[]> {
  const document = await pdfjs.getDocument({
    data: new Uint8Array(pdf),
    // Im Test gibt es keinen Worker; ohne das wartet pdf.js auf einen, den es
    // nie bekommt.
    useWorkerFetch: false,
  }).promise;

  const out: DrawnText[] = [];
  for (let n = 1; n <= document.numPages; n++) {
    const page = await document.getPage(n);
    const content = await page.getTextContent();
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      out.push({
        page: n,
        x: item.transform[4],
        y: item.transform[5],
        width: item.width,
        text: item.str,
      });
    }
  }
  await document.destroy();
  return out;
}

export type DrawnImage = {
  page: number;
  /** Punkt von links / von unten, dazu die gezeichnete Größe in Punkt. */
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Die gezeichneten **Bilder** mit Position und Größe.
 *
 * Die Satzspiegel-Prüfungen lasen bisher nur Text. Ein Logo, das in den
 * Absenderblock läuft, blieb damit unsichtbar — bis es gedruckt wird.
 *
 * Gelesen wird die Operatorliste: pdf.js führt die Transformationsmatrix
 * nicht selbst mit, deshalb wird sie hier über `save`/`restore`/`transform`
 * nachgehalten. Für den Briefkopf genügt das — dort steht das Logo ohne
 * Drehung, sodass a und d unmittelbar Breite und Höhe sind.
 */
export async function drawnImages(pdf: Uint8Array | Buffer): Promise<DrawnImage[]> {
  const document = await pdfjs.getDocument({
    data: new Uint8Array(pdf),
    useWorkerFetch: false,
  }).promise;

  const OPS = pdfjs.OPS;
  const out: DrawnImage[] = [];
  for (let n = 1; n <= document.numPages; n++) {
    const page = await document.getPage(n);
    const ops = await page.getOperatorList();
    let ctm: number[] = [1, 0, 0, 1, 0, 0];
    const stapel: number[][] = [];
    for (let i = 0; i < ops.fnArray.length; i++) {
      const fn = ops.fnArray[i];
      const args = ops.argsArray[i] as number[];
      if (fn === OPS.save) stapel.push([...ctm]);
      else if (fn === OPS.restore) ctm = stapel.pop() ?? [1, 0, 0, 1, 0, 0];
      else if (fn === OPS.transform) ctm = multipliziere(args, ctm);
      else if (fn === OPS.paintImageXObject) {
        out.push({ page: n, x: ctm[4], y: ctm[5], width: Math.abs(ctm[0]), height: Math.abs(ctm[3]) });
      }
    }
  }
  return out;
}

/** a × b in der Reihenfolge, in der PDF die Matrizen verkettet. */
function multipliziere(a: number[], b: number[]): number[] {
  return [
    a[0] * b[0] + a[1] * b[2],
    a[0] * b[1] + a[1] * b[3],
    a[2] * b[0] + a[3] * b[2],
    a[2] * b[1] + a[3] * b[3],
    a[4] * b[0] + a[5] * b[2] + b[4],
    a[4] * b[1] + a[5] * b[3] + b[5],
  ];
}
