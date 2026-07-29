// Fotos für die Einbettung in ein PDF aufbereiten.
//
// Die Aufnahmen kommen direkt vom Handy: 3.000 px breit, 3–6 MB, oft gedreht.
// Unverändert eingebettet trüge ein Übergabeprotokoll mit fünfzehn Fotos rund
// 60 MB — an keiner E-Mail vorbei. Im Dokument sind sie höchstens 80 mm breit;
// bei 200 dpi genügen dafür rund 640 px.
import sharp from "sharp";

/** Längste Kante in Pixeln. 900 px reichen für 80 mm bei ~280 dpi. */
const MAX_KANTE = 900;
const QUALITAET = 72;

export type VorbereitetesFoto = { jpeg: Uint8Array; breite: number; hoehe: number };

/**
 * Verkleinert ein Foto und gibt JPEG-Daten samt Abmessungen zurück.
 *
 * `rotate()` ohne Argument wertet die EXIF-Orientierung aus — ohne das liegen
 * hochkant aufgenommene Bilder im PDF auf der Seite, weil PDF keine
 * EXIF-Drehung kennt.
 *
 * Gibt `null` zurück, wenn sich die Datei nicht lesen lässt. Ein kaputtes Foto
 * darf das Protokoll nicht verhindern.
 */
export async function fotoVorbereiten(bytes: Uint8Array): Promise<VorbereitetesFoto | null> {
  try {
    const { data, info } = await sharp(bytes)
      .rotate()
      .resize({ width: MAX_KANTE, height: MAX_KANTE, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: QUALITAET, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    return { jpeg: new Uint8Array(data), breite: info.width, hoehe: info.height };
  } catch {
    return null;
  }
}
