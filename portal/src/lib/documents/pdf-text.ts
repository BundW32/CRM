import type { PDFFont } from "pdf-lib";

// Macht beliebigen (auch nutzergenerierten) Text für pdf-lib mit Standard-Font
// (WinAnsi/CP1252) sicher: gängige Typografie wird auf ASCII abgebildet, alles
// außerhalb des kodierbaren Bereichs (Emoji, Pfeile, nicht-lateinische Schrift)
// wird durch „?" ersetzt – sonst wirft pdf-lib eine Exception und der Export
// stürzt ab. WICHTIG: Steuerzeichen werden entfernt bzw. normalisiert (CR/CRLF →
// LF, Tab → Leerzeichen), weil font.widthOfTextAtSize() sonst auf 0x0D crasht
// (drawText toleriert es, die Breitenmessung in wrapText nicht).
export function encodeWinAnsi(input: string | null | undefined): string {
  const s = input ?? "";
  return (
    s
      // Zeilenenden vereinheitlichen (CRLF/CR → LF), Tabs → Leerzeichen.
      .replace(/\r\n?/g, "\n")
      .replace(/\t/g, " ")
      // Geschützte/schmale Leerzeichen → normales Leerzeichen (NBSP, narrow NBSP,
      // figure space, thin space).
      .replace(/[    ]/g, " ")
      .replace(/[‘’‚‹›´ʼ]/g, "'")
      .replace(/[“”„«»]/g, '"')
      .replace(/[–—−]/g, "-")
      .replace(/…/g, "...")
      .replace(/[•·●▪]/g, "-")
      .replace(/[→➡➜➔]/g, "->")
      .replace(/←/g, "<-")
      .replace(/[✓✔✅]/g, "x")
      // Alles, was WinAnsi/CP1252 nicht sicher kodieren kann, ersetzen.
      // Erlaubt: Zeilenumbruch, druckbares ASCII, Latin-1-Supplement, Euro und
      // die druckbaren CP1252-Sonderzeichen aus 0x80–0x9F, die Helvetica
      // kodieren kann (Š š Ž ž Œ œ Ÿ ƒ ˆ ˜ † ‡ ‰).
      .replace(
        /[^\n\x20-\x7E¡-ÿ€ŠšŽžŒœŸƒˆ˜†‡‰]/gu,
        "?",
      )
  );
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
  const s = text ?? "";
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
// Erwartet WinAnsi-sicheren Text (siehe encodeWinAnsi) – font.widthOfTextAtSize
// wirft sonst auf nicht kodierbaren Zeichen.
export function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const out: string[] = [];
  for (const segment of text.split("\n")) {
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
