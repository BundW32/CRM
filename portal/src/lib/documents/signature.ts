// Serverseitiges Freistellen der Unterschrift für die PDF-Erstellung.
//
// Warum serverseitig?
//  - Es wirkt zuverlässig auf JEDE gespeicherte Unterschrift – egal ob sie als
//    JPG-Foto, PNG oder bereits (clientseitig) freigestelltes Bild vorliegt und
//    egal, wann sie hochgeladen wurde.
//  - So liegt im Dokument garantiert eine transparente, eng zugeschnittene
//    Unterschrift ohne Papier-Hintergrund vor.
//
// Vorgehen: heller Hintergrund -> transparent, dunkle Tinte -> deckend,
// anschließend eng auf den Schriftzug zuschneiden. Ausgabe: transparentes PNG.
import sharp from "sharp";

// Helligkeitsschwellen (0 = schwarz, 255 = weiß):
const BG_THRESHOLD = 215; // heller als dies -> Hintergrund (transparent)
const INK_THRESHOLD = 120; // dunkler als dies -> Tinte (deckend)
const MIN_ALPHA = 40; // schwächere Reste (Papierrauschen) verwerfen
const MAX_DIMENSION = 1600; // Verarbeitungsauflösung (längste Kante)

export type PreparedSignature = { png: Uint8Array };

// Gibt ein transparentes, eng zugeschnittenes PNG zurück – oder null, wenn das
// Bild nicht verarbeitet werden konnte bzw. keine Unterschrift erkennbar war.
// sharp erkennt das Eingabeformat (JPG/PNG/WebP/HEIC) selbst anhand der Bytes.
export async function prepareSignaturePng(
  bytes: Uint8Array
): Promise<PreparedSignature | null> {
  try {
    // EXIF-Drehung anwenden, ggf. verkleinern, dann als rohe RGBA-Pixel lesen.
    const pipeline = sharp(Buffer.from(bytes))
      .rotate()
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .ensureAlpha();

    const { data, info } = await pipeline
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { width: w, height: h, channels } = info;
    if (channels !== 4 || w === 0 || h === 0) return null;

    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        // Bereits transparente Pixel (z. B. vorab freigestellt) bleiben es.
        if (data[i + 3] < 10) {
          data[i + 3] = 0;
          continue;
        }
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        let alpha: number;
        if (lum >= BG_THRESHOLD) {
          alpha = 0;
        } else if (lum <= INK_THRESHOLD) {
          alpha = 255;
        } else {
          // weicher Übergang für saubere Kanten
          alpha = Math.round(((BG_THRESHOLD - lum) / (BG_THRESHOLD - INK_THRESHOLD)) * 255);
        }
        if (alpha < MIN_ALPHA) alpha = 0;
        data[i + 3] = alpha;
        if (alpha > 0) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    // Nichts erkannt -> nicht freistellen (Aufrufer fällt auf Originalbild zurück).
    if (maxX < minX || maxY < minY) return null;

    // Eng zuschneiden mit etwas Rand.
    const pad = Math.round(Math.max(w, h) * 0.02);
    const left = Math.max(0, minX - pad);
    const top = Math.max(0, minY - pad);
    const right = Math.min(w - 1, maxX + pad);
    const bottom = Math.min(h - 1, maxY + pad);
    const cropW = right - left + 1;
    const cropH = bottom - top + 1;

    const png = await sharp(data, { raw: { width: w, height: h, channels: 4 } })
      .extract({ left, top, width: cropW, height: cropH })
      .png()
      .toBuffer();

    return { png: new Uint8Array(png) };
  } catch {
    return null;
  }
}
