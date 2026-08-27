// Liest die Gestaltungswerte dort aus, wo sie im Produkt gelten: aus dem
// `@theme`-Block von `portal/src/app/globals.css`. Nichts wird hier abgetippt.
//
// Der Grund ist derselbe, aus dem im Portal die elf Kopien einer Bewegungskurve
// zu EINEM Token zusammengezogen wurden: Zwei Listen derselben Farben laufen
// früher oder später auseinander, und dann sagt das Design-System etwas
// anderes als die laufende Seite. Also gibt es nur die eine Liste, und diese
// Datei liest sie.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const hier = dirname(fileURLToPath(import.meta.url));
export const WURZEL = join(hier, "..", "..");
export const GLOBALS_CSS = join(WURZEL, "portal", "src", "app", "globals.css");

/** Alle `--name: wert;`-Paare aus dem ersten `@theme { … }`-Block. */
export function tokenLesen(pfad = GLOBALS_CSS) {
  const css = readFileSync(pfad, "utf8");
  const start = css.indexOf("@theme {");
  if (start === -1) throw new Error("Kein @theme-Block in " + pfad);

  // Bis zur schließenden Klammer der gleichen Ebene zählen – der Block enthält
  // selbst keine verschachtelten Klammern, aber Kommentare mit „}" wären eine
  // Falle, deshalb werden Kommentare vorher entfernt.
  const ab = css.slice(start + "@theme {".length);
  const ohneKommentare = ab.replace(/\/\*[\s\S]*?\*\//g, "");
  const ende = ohneKommentare.indexOf("}");
  if (ende === -1) throw new Error("@theme-Block ist nicht geschlossen");

  const block = ohneKommentare.slice(0, ende);
  const tokens = new Map();
  for (const zeile of block.split(";")) {
    const treffer = zeile.match(/(--[\w-]+)\s*:\s*([\s\S]+)/);
    if (!treffer) continue;
    tokens.set(treffer[1].trim(), treffer[2].trim().replace(/\s+/g, " "));
  }
  if (tokens.size === 0) throw new Error("@theme-Block enthält keine Tokens");
  return tokens;
}

/** Wert eines Tokens; wirft, wenn es ihn nicht (mehr) gibt. */
export function wert(tokens, name) {
  const v = tokens.get(name);
  if (v === undefined) {
    throw new Error(
      `Token ${name} steht nicht mehr in globals.css. ` +
        `Entweder wurde es umbenannt – dann hier nachziehen – oder es ist ` +
        `entfallen, dann gehört die Karte angepasst.`,
    );
  }
  return v;
}

// ── Kontrast ───────────────────────────────────────────────────────────────
// Gerechnet, nicht geschätzt: WCAG 2.1, relative Leuchtdichte.

function kanal(v) {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function hexZuRgb(hex) {
  const h = hex.trim().replace("#", "");
  const voll = h.length === 3 ? h.split("").map((z) => z + z).join("") : h;
  if (!/^[0-9a-fA-F]{6}$/.test(voll)) throw new Error("Kein Hex-Wert: " + hex);
  return [0, 2, 4].map((i) => parseInt(voll.slice(i, i + 2), 16));
}

export function leuchtdichte(hex) {
  const [r, g, b] = hexZuRgb(hex).map(kanal);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Kontrastverhältnis zweier Hex-Farben, auf eine Nachkommastelle. */
export function kontrast(a, b) {
  const la = leuchtdichte(a);
  const lb = leuchtdichte(b);
  const hell = Math.max(la, lb);
  const dunkel = Math.min(la, lb);
  return Math.round(((hell + 0.05) / (dunkel + 0.05)) * 10) / 10;
}

/** Bestehensstufe nach WCAG 2.1 für Fließtext (AA = 4,5:1, AAA = 7:1). */
export function stufe(verhaeltnis, gross = false) {
  const aa = gross ? 3 : 4.5;
  const aaa = gross ? 4.5 : 7;
  if (verhaeltnis >= aaa) return "AAA";
  if (verhaeltnis >= aa) return "AA";
  return "durchgefallen";
}

/** Deutsche Schreibweise: 13,4:1 statt 13.4:1. */
export function verhaeltnisText(v) {
  return String(v).replace(".", ",") + ":1";
}
