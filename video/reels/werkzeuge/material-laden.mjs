/**
 * Lädt Schriften und Klangeffekte nach public/, damit der Render selbst ohne
 * Netz auskommt.
 *
 * Warum das sein muss: Der Render-Browser dieser Umgebung kennt die CA des
 * Agent-Proxys nicht. Alles, was zur Renderzeit aus dem Netz käme —
 * fonts.gstatic.com, remotion.media — scheitert dort mit
 * ERR_CERT_AUTHORITY_INVALID und der Frame erscheint in der Ersatzschrift oder
 * ohne Ton. Vorher herunterladen löst das und macht den Lauf reproduzierbar.
 *
 *   node werkzeuge/material-laden.mjs
 */
import { mkdir, writeFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const hier = dirname(fileURLToPath(import.meta.url));
const OEFFENTLICH = join(hier, "..", "public");

const BROWSER_KENNUNG =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

/** Die Schriften, die src/marke.ts erwartet. */
const SCHRIFTEN = [
  { abfrage: "Montserrat:wght@900", datei: "montserrat-900.woff2" },
  { abfrage: "Source+Sans+3:wght@600", datei: "sourcesans3-600.woff2" },
];

/**
 * Klangeffekte aus @remotion/sfx. Bewusst nur die sachlichen: Meme-Sounds
 * (vine-boom, bruh, windows-xp-error) passen nicht zu einer WEG-Marke.
 */
const KLAENGE = [
  "whoosh.wav",
  "whip.wav",
  "mouse-click.wav",
  "switch.wav",
  "ding.wav",
  "page-turn.wav",
];

const existiert = async (pfad) => {
  try {
    await access(pfad);
    return true;
  } catch {
    return false;
  }
};

const holen = async (url, kopfzeilen = {}) => {
  const antwort = await fetch(url, { headers: kopfzeilen });
  if (!antwort.ok) throw new Error(`${antwort.status} ${antwort.statusText} bei ${url}`);
  return antwort;
};

/**
 * Google liefert je Zeichensatz einen eigenen @font-face-Block. Gebraucht wird
 * der mit dem lateinischen Grundbereich — ein anderer Block enthält nur ein paar
 * Sonderzeichen und rendert dann als Ersatzschrift.
 */
const lateinischeSchriftDatei = (css) => {
  const bloecke = css.split("@font-face");
  const latein = bloecke.find((b) => b.includes("U+0000-00FF"));
  const treffer = (latein ?? "").match(/https:\/\/[^)]*\.woff2/);
  if (!treffer) throw new Error("Keinen lateinischen Schriftschnitt in der CSS-Antwort gefunden");
  return treffer[0];
};

const schriftLaden = async ({ abfrage, datei }) => {
  const ziel = join(OEFFENTLICH, "schriften", datei);
  if (await existiert(ziel)) return `übersprungen (liegt schon da): ${datei}`;
  const css = await (await holen(`https://fonts.googleapis.com/css2?family=${abfrage}`, {
    "User-Agent": BROWSER_KENNUNG,
  })).text();
  const antwort = await holen(lateinischeSchriftDatei(css));
  await writeFile(ziel, Buffer.from(await antwort.arrayBuffer()));
  return `geladen: ${datei}`;
};

const klangLaden = async (name) => {
  const ziel = join(OEFFENTLICH, "sfx", name);
  if (await existiert(ziel)) return `übersprungen (liegt schon da): ${name}`;
  const antwort = await holen(`https://remotion.media/${name}`);
  await writeFile(ziel, Buffer.from(await antwort.arrayBuffer()));
  return `geladen: ${name}`;
};

await mkdir(join(OEFFENTLICH, "schriften"), { recursive: true });
await mkdir(join(OEFFENTLICH, "sfx"), { recursive: true });

for (const schrift of SCHRIFTEN) console.log(await schriftLaden(schrift));
for (const klang of KLAENGE) console.log(await klangLaden(klang));
console.log("Material vollständig.");
