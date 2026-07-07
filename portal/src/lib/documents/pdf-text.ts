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
