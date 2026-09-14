// Bildschirmfoto zur Hilfe-Anfrage: serverseitige Prüfung der Daten-URL.
//
// Das Widget nimmt den sichtbaren Ausschnitt der Seite im Browser auf
// (html-to-image) und schickt ihn als `data:image/jpeg;base64,…` mit. Hier
// wird daraus ein Mail-Anhang — oder nichts, wenn das Format nicht passt oder
// die Datei zu groß ist. Die Meldung geht dann trotzdem raus, nur ohne Bild:
// Ein zu großes Foto darf keine Problemmeldung verschlucken.

import type { MailAttachment } from "@/lib/mailer";

// Obergrenze der Base64-Nutzlast (~3 MB Bild). Das Widget verkleinert
// oberhalb von 1,5 MB selbst; die Grenze hier ist die Sicherung dagegen,
// dass jemand am Widget vorbei beliebig große Anhänge auslöst.
export const FOTO_MAX_BASE64 = 4_000_000;

const KOPF = /^data:image\/(jpeg|png);base64,/;

export function parseBildschirmfoto(wert: unknown): MailAttachment | null {
  if (typeof wert !== "string" || wert.length === 0) return null;
  const m = KOPF.exec(wert);
  if (!m) return null;
  const base64 = wert.slice(m[0].length);
  if (base64.length === 0 || base64.length > FOTO_MAX_BASE64) return null;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return null;
  const typ = m[1] === "png" ? "png" : "jpeg";
  return {
    filename: typ === "png" ? "bildschirmfoto.png" : "bildschirmfoto.jpg",
    content: Buffer.from(base64, "base64"),
    contentType: `image/${typ}`,
  };
}
