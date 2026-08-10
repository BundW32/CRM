// Zerlegung von Quelltexten in Index-Häppchen (Chunks) für den Wissensindex.
//
// Semantisch statt nach Zeichenzahl (Konzept 3.3): Getrennt wird bevorzugt an
// Überschriften (TOP n, § n, Markdown-#) und Absatzgrenzen, Zielgröße 400–800
// Token mit 15 % Überlappung. Jeder Chunk behält die Überschrift seines
// Abschnitts als Metadatum — daraus wird später die Quellenangabe
// („Protokoll vom …, TOP 3").
//
// Die Token-Zahl wird über Zeichen geschätzt (≈ 4 Zeichen je Token für
// deutschen Text). Portalinterne Texte (Beschlüsse, Aushänge) sind meist kurz
// und ergeben genau einen Chunk; die Zerlegung trägt erst bei Protokollen und
// später bei Dokumenten (Phase 4).

export type TextChunk = {
  text: string;
  /** Überschrift des Abschnitts, aus dem der Chunk stammt (z. B. "TOP 3"). */
  abschnitt: string | null;
  reihenfolge: number;
};

// ≈ 600 Token Ziel, ≈ 800 Token Obergrenze (bei 4 Zeichen je Token).
const ZIEL_ZEICHEN = 2400;
const MAX_ZEICHEN = 3200;
const UEBERLAPPUNG_ANTEIL = 0.15;

// Überschriften, an denen bevorzugt getrennt wird. Bewusst eng: Lieber eine
// Überschrift verpassen (dann trennt die Absatzgrenze) als mitten im Fließtext
// falsche Abschnitte erfinden.
const UEBERSCHRIFT = /^(?:top\s*\d+|tagesordnungspunkt\s*\d+|§\s*\d+[a-z]?\b|#{1,6}\s+\S).*/i;

export function istUeberschrift(zeile: string): boolean {
  const z = zeile.trim();
  return z.length > 0 && z.length <= 120 && UEBERSCHRIFT.test(z);
}

type Absatz = { text: string; abschnitt: string | null };

/** Text in Absätze mit zugehöriger Abschnittsüberschrift auflösen. */
function absaetze(roh: string): Absatz[] {
  const out: Absatz[] = [];
  let abschnitt: string | null = null;
  for (const block of roh.replace(/\r\n/g, "\n").split(/\n{2,}/)) {
    const zeilen = block.split("\n").map((z) => z.trim()).filter(Boolean);
    let puffer: string[] = [];
    const spuele = () => {
      if (puffer.length > 0) {
        out.push({ text: puffer.join("\n"), abschnitt });
        puffer = [];
      }
    };
    for (const zeile of zeilen) {
      if (istUeberschrift(zeile)) {
        spuele();
        abschnitt = zeile.replace(/^#{1,6}\s+/, "");
        // Die Überschrift gehört mit in den Text — ohne sie fehlt dem
        // Embedding oft genau das Stichwort, nach dem gefragt wird.
        puffer.push(zeile);
      } else {
        puffer.push(zeile);
      }
    }
    spuele();
  }
  return out;
}

/** Überlangen Absatz an Satzgrenzen (ersatzweise hart) teilen. */
function teileAbsatz(text: string): string[] {
  if (text.length <= MAX_ZEICHEN) return [text];
  const saetze = text.match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g) ?? [text];
  const teile: string[] = [];
  let puffer = "";
  for (const satz of saetze) {
    if (puffer && puffer.length + satz.length > ZIEL_ZEICHEN) {
      teile.push(puffer.trim());
      puffer = "";
    }
    // Ein einzelner Satz über der Obergrenze wird hart geschnitten.
    let rest = satz;
    while (rest.length > MAX_ZEICHEN) {
      teile.push((puffer + rest.slice(0, ZIEL_ZEICHEN)).trim());
      puffer = "";
      rest = rest.slice(ZIEL_ZEICHEN);
    }
    puffer += rest;
  }
  if (puffer.trim()) teile.push(puffer.trim());
  return teile;
}

/** Die letzten ~15 % eines Chunks, an einer Wortgrenze beginnend. */
function ueberlappung(text: string): string {
  const laenge = Math.floor(text.length * UEBERLAPPUNG_ANTEIL);
  if (laenge < 40) return ""; // Bei Kurztexten stiftet Überlappung nur Dubletten.
  const tail = text.slice(-laenge);
  const wortgrenze = tail.indexOf(" ");
  return wortgrenze === -1 ? tail : tail.slice(wortgrenze + 1);
}

/**
 * Zerlegt einen Quelltext in Chunks. Kurze Texte (der Normalfall bei
 * Beschlüssen und Aushängen) ergeben genau einen Chunk mit dem Originaltext.
 */
export function zerlegeText(roh: string): TextChunk[] {
  const text = roh.trim();
  if (!text) return [];
  if (text.length <= MAX_ZEICHEN && !text.split("\n").some(istUeberschrift)) {
    return [{ text, abschnitt: null, reihenfolge: 0 }];
  }

  const chunks: TextChunk[] = [];
  let puffer = "";
  let pufferAbschnitt: string | null = null;
  let vorherigerText = "";

  const abschliessen = () => {
    if (!puffer.trim()) return;
    chunks.push({ text: puffer.trim(), abschnitt: pufferAbschnitt, reihenfolge: chunks.length });
    vorherigerText = puffer.trim();
    puffer = "";
  };

  for (const absatz of absaetze(text)) {
    for (const teil of teileAbsatz(absatz.text)) {
      const wechselt = puffer !== "" && absatz.abschnitt !== pufferAbschnitt;
      const zuGross = puffer !== "" && puffer.length + teil.length + 2 > ZIEL_ZEICHEN;
      if (wechselt || zuGross) {
        abschliessen();
        // Überlappung nur innerhalb desselben Abschnitts — über eine
        // Überschrift hinweg wäre sie inhaltlich falsch zugeordnet.
        if (!wechselt) {
          const anlauf = ueberlappung(vorherigerText);
          if (anlauf) puffer = `… ${anlauf}\n`;
        }
      }
      if (puffer === "" || pufferAbschnitt !== absatz.abschnitt) pufferAbschnitt = absatz.abschnitt;
      puffer += (puffer && !puffer.endsWith("\n") ? "\n\n" : "") + teil;
    }
  }
  abschliessen();
  return chunks;
}
