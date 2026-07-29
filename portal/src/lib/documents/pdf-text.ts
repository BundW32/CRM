import type { PDFFont } from "pdf-lib";

// Normalisiert beliebigen (auch nutzergenerierten) Text für die Ausgabe.
//
// Zwei Gründe, und beide sind keine Kosmetik:
//  • font.widthOfTextAtSize() stürzt auf einem Wagenrücklauf (0x0D) ab —
//    drawText toleriert ihn, die Breitenmessung nicht. Textfelder im Browser
//    liefern aber genau CRLF.
//  • Steuerzeichen und geschützte Leerzeichen brechen die Umbruchrechnung,
//    ohne dass man es dem Ergebnis ansieht.
//
// Nicht mehr nötig ist das Ersetzen nicht-lateinischer Zeichen durch „?": Die
// Dokumente betten Source Sans 3 ein statt der WinAnsi-Standardschrift. „Ayşe
// Şahin" stand damit früher als „Ay?e ?ahin" im Anschriftfeld.
export function normalizeText(input: string | null | undefined): string {
  return (input ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, " ")
    // Geschützte und schmale Leerzeichen → normales Leerzeichen.
    .replace(/[\u00a0\u202f\u2007\u2009]/g, " ")
    // Übrige Steuerzeichen entfernen (Zeilenumbruch bleibt).
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "");
}

// Kürzt einen EINZEILIGEN Text auf maxWidth – nach gemessener Breite, nicht
// nach Zeichenzahl. Vorher stand dafür an mehreren Stellen `.slice(0, 90)`, was
// je nach Text mal mitten im Wort abschnitt und mal über den Rand hinauslief
// (die Rücksendeangabe im Anschriftfeld ragte so über ihre 85 mm hinaus).
// Nur für Angaben verwenden, deren Verlust unschädlich ist – Anschriften und
// Firmennamen gehören umgebrochen (wrapText), nicht gekürzt.
export function fitText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string {
  const s = normalizeText(text);
  if (font.widthOfTextAtSize(s, size) <= maxWidth) return s;
  const ellipsis = "...";
  const room = maxWidth - font.widthOfTextAtSize(ellipsis, size);
  if (room <= 0) return "";
  // Binäre Suche nach der längsten passenden Zeichenfolge.
  let lo = 0;
  let hi = s.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (font.widthOfTextAtSize(s.slice(0, mid), size) <= room) lo = mid;
    else hi = mid - 1;
  }
  return s.slice(0, lo).trimEnd() + ellipsis;
}

// Bricht Text auf maxWidth (in Punkt) um. Berücksichtigt bereits vorhandene
// Zeilenumbrüche (\n) und bricht einzelne Wörter, die breiter als maxWidth sind,
// hart um (zeichenweise), damit nichts über den Seitenrand hinausläuft.
export function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const out: string[] = [];
  for (const segment of normalizeText(text).split("\n")) {
    if (segment === "") {
      out.push("");
      continue;
    }
    let current = "";
    for (const word of segment.split(" ")) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
        continue;
      }
      // Angefangene Zeile abschließen …
      if (current) {
        out.push(current);
        current = "";
      }
      // … und ein Wort, das allein zu breit ist, zeichenweise hart brechen.
      if (font.widthOfTextAtSize(word, size) <= maxWidth) {
        current = word;
      } else {
        let chunk = "";
        for (const ch of word) {
          if (font.widthOfTextAtSize(chunk + ch, size) <= maxWidth) {
            chunk += ch;
          } else {
            if (chunk) out.push(chunk);
            chunk = ch;
          }
        }
        current = chunk;
      }
    }
    if (current) out.push(current);
  }
  return out;
}
