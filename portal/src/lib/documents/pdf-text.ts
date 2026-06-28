// Macht beliebigen (auch nutzergenerierten) Text für pdf-lib mit Standard-Font
// (WinAnsi/CP1252) sicher: gängige Typografie wird auf ASCII abgebildet, alles
// außerhalb des kodierbaren Bereichs (Emoji, Pfeile, nicht-lateinische Schrift)
// wird durch „?" ersetzt – sonst wirft pdf-lib eine Exception und der Export
// stürzt ab.
export function encodeWinAnsi(input: string | null | undefined): string {
  const s = input ?? "";
  return (
    s
      .replace(/ /g, " ") // geschütztes Leerzeichen
      .replace(/[‘’‚‹›´ʼ]/g, "'")
      .replace(/[“”„«»]/g, '"')
      .replace(/[–—−]/g, "-")
      .replace(/…/g, "...")
      .replace(/[•·●▪]/g, "-")
      .replace(/[→➡➜➔]/g, "->")
      .replace(/←/g, "<-")
      .replace(/[✓✔✅]/g, "x")
      // Alles, was WinAnsi/CP1252 nicht sicher kodieren kann, ersetzen.
      // Erlaubt: Tab/Zeilenumbruch, druckbares ASCII, Latin-1-Supplement, Euro.
      .replace(/[^\t\n\r\x20-\x7E¡-ÿ€]/gu, "?")
  );
}
