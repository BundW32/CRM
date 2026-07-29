// Schrifteinbettung für alle erzeugten Dokumente.
//
// Bisher liefen alle Generatoren auf StandardFonts.Helvetica. Das ist
// WinAnsi/CP1252 und kann nur einen Bruchteil der lateinischen Schrift
// darstellen: eine Ersetzungsfunktion musste alles andere durch „?" ersetzen, sonst
// wirft pdf-lib beim Zeichnen. In Rechtsdokumenten steht damit „Ay?e ?ahin"
// im Anschriftfeld — unzustellbar und peinlich.
//
// Source Sans 3 (SIL OFL 1.1, Lizenz neben den Dateien) deckt Latin Extended
// ab. Regular und Semibold genügen; Semibold liest sich in Tabellen ruhiger
// als ein volles Bold.
import fs from "node:fs";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import type { PDFDocument, PDFFont } from "pdf-lib";

const FONT_DIR = path.join(process.cwd(), "public", "fonts");
const FILES = {
  regular: "SourceSans3-Regular.ttf",
  semibold: "SourceSans3-Semibold.ttf",
} as const;

// Einmal je Prozess von der Platte lesen — nicht je Dokument.
const cache = new Map<string, Buffer>();
function read(file: string): Buffer {
  const cached = cache.get(file);
  if (cached) return cached;
  const bytes = fs.readFileSync(path.join(FONT_DIR, file));
  cache.set(file, bytes);
  return bytes;
}

export type DocumentFonts = { regular: PDFFont; bold: PDFFont };

export async function embedFonts(pdf: PDFDocument): Promise<DocumentFonts> {
  pdf.registerFontkit(fontkit);
  // subset: nur die tatsächlich benutzten Glyphen landen im PDF. Ohne das
  // trüge jedes Dokument gut 400 KB Schrift mit sich.
  const [regular, bold] = await Promise.all([
    pdf.embedFont(read(FILES.regular), { subset: true }),
    pdf.embedFont(read(FILES.semibold), { subset: true }),
  ]);
  return { regular, bold };
}
