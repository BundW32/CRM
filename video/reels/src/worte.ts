import type { TikTokPage, TikTokToken } from "@remotion/captions";

export type Wort = {
  text: string;
  vonMs: number;
  bisMs: number;
};

/**
 * Fügt die Token einer Untertitel-Seite zu ganzen Wörtern zusammen.
 *
 * Whisper liefert Wortteile: „Wohnungseigentümergemeinschaften" kommt als
 * `Wohnung se igent ü mer geme ins chaft en` an. Für die Hervorhebung des
 * gerade gesprochenen Wortes muss daraus wieder ein Wort werden, sonst blinkt
 * bei Komposita neunmal ein Fragment auf.
 *
 * Regel: Ein neues Wort beginnt, wenn der Token mit einem Leerzeichen anfängt.
 * Satzzeichen hängen sich an das Wort davor.
 */
export const worteAusTokens = (tokens: TikTokToken[]): Wort[] => {
  const worte: Wort[] = [];

  for (const token of tokens) {
    const neuesWort = token.text.startsWith(" ") || worte.length === 0;
    const nurSatzzeichen = /^[.,!?;:…»«"'\-–—]+$/.test(token.text.trim());

    if (neuesWort && !nurSatzzeichen) {
      worte.push({ text: token.text.trim(), vonMs: token.fromMs, bisMs: token.toMs });
      continue;
    }

    const letztes = worte[worte.length - 1];
    letztes.text += token.text.trim();
    letztes.bisMs = Math.max(letztes.bisMs, token.toMs);
  }

  return worte;
};

/**
 * Satzzeichen weg — außer dem Fragezeichen, wenn die Frage die Aussage trägt.
 * Untertitel mit Kommas und Punkten wirken wie ein Dokument, nicht wie ein Reel.
 */
export const satzzeichenWeg = (text: string) => text.replace(/[.,;:!…»«"']/g, "");

export const worteAusSeite = (seite: TikTokPage): Wort[] =>
  worteAusTokens(seite.tokens).map((w) => ({ ...w, text: satzzeichenWeg(w.text) }));
