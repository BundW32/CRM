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
