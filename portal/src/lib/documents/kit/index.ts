// Gemeinsames Fundament aller erzeugten PDFs.
//
// Wer ein neues Dokument baut, nimmt `Doc` und — bei Briefen — `drawLetterHead`.
// Eigene A4-Konstanten, eigene `fmtDate`- oder `euro`-Kopien und eigene
// `ensure`-Schleifen gehören nicht mehr in die Generatoren; genau daraus war der
// Zoo aus drei Rändern, elf Schriftgrößen und drei vergessenen
// Umbruchprüfungen entstanden.
export { Doc, type DocMeta, type TableCell, type TableColumn, type TextOptions } from "./doc";
export {
  drawLetterHead,
  type LetterHead,
  type LetterIssuer,
  type LetterRecipient,
} from "./letter";
export { embedFonts, type DocumentFonts } from "./fonts";
export {
  CONTENT_WIDTH,
  DIN,
  MEASURE,
  PAGE,
  brandColor,
  color,
  leading,
  mm,
  size,
} from "./theme";
