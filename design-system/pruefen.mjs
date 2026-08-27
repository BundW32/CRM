#!/usr/bin/env node
// Sieht sich jeden erzeugten Bogen wirklich an, statt zu vermuten.
//
//   node design-system/pruefen.mjs [--bilder]
//
// Geprüft wird je Bogen:
//   · Der @dsCard-Marker steht in Zeile 1 und ist vollständig.
//   · Die Seite läuft nicht waagerecht über (der häufigste Fehler in einer
//     Vorschau, die später in einer schmaleren Karte gerendert wird).
//   · Source Sans 3 ist wirklich geladen – sonst zeigt die Schrift-Seite eine
//     andere Schrift, als sie behauptet.
//   · Es steht genug drauf, dass die Karte nicht leer wirkt.
//   · Keine Fehler in der Konsole, keine gescheiterten Anfragen.
// Mit --bilder landen zusätzlich PNG-Aufnahmen in design-system/.aufnahmen/.

import { readFileSync, readdirSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { WURZEL } from "./lib/tokens.mjs";

const ZIEL = join(WURZEL, "design-system", "vorschau");
const AUFNAHMEN = join(WURZEL, "design-system", ".aufnahmen");
const BILDER = process.argv.includes("--bilder");

function bögeneinsammeln(ordner = ZIEL, vorsatz = "") {
  const gefunden = [];
  for (const eintrag of readdirSync(ordner, { withFileTypes: true })) {
    const rel = vorsatz ? `${vorsatz}/${eintrag.name}` : eintrag.name;
    if (eintrag.isDirectory()) gefunden.push(...bögeneinsammeln(join(ordner, eintrag.name), rel));
    else if (eintrag.name.endsWith(".html") && rel !== "index.html") gefunden.push(rel);
  }
  return gefunden.sort();
}

// Playwright liegt in dieser Umgebung global. ESM kennt kein NODE_PATH,
// deshalb wird notfalls über den globalen npm-Ordner nachgeladen.
async function playwrightLaden() {
  try {
    return await import("playwright");
  } catch {
    const { execSync } = await import("node:child_process");
    const wurzel = execSync("npm root -g", { encoding: "utf8" }).trim();
    return await import(pathToFileURL(join(wurzel, "playwright", "index.mjs")).href);
  }
}

const { chromium } = await playwrightLaden();

const bögen = bögeneinsammeln();
if (bögen.length === 0) {
  console.error("Keine Bögen in design-system/vorschau/ – erst `node design-system/bauen.mjs`.");
  process.exit(1);
}

if (BILDER) {
  if (existsSync(AUFNAHMEN)) rmSync(AUFNAHMEN, { recursive: true });
  mkdirSync(AUFNAHMEN, { recursive: true });
}

const browser = await chromium.launch();
const befunde = [];

for (const bogen of bögen) {
  const datei = join(ZIEL, bogen);
  const html = readFileSync(datei, "utf8");
  const markerZeile = html.split("\n", 1)[0];
  const marker = markerZeile.match(/^<!-- @dsCard (.+) -->$/);

  if (!marker) {
    befunde.push([bogen, "Erste Zeile ist kein @dsCard-Marker"]);
    continue;
  }
  const angaben = Object.fromEntries(
    [...marker[1].matchAll(/(\w+)="([^"]*)"/g)].map((p) => [p[1], p[2]]),
  );
  for (const pflicht of ["group", "name", "width", "height"]) {
    if (!angaben[pflicht]) befunde.push([bogen, `Marker ohne ${pflicht}`]);
  }

  const breite = Number(angaben.width) || 1200;
  const seite = await browser.newPage({ viewport: { width: breite, height: 900 } });
  const konsole = [];
  const fehlgeschlagen = [];
  seite.on("console", (m) => m.type() === "error" && konsole.push(m.text()));
  seite.on("requestfailed", (r) => fehlgeschlagen.push(r.url()));

  await seite.goto(pathToFileURL(datei).href, { waitUntil: "networkidle" });
  await seite.evaluate(() => document.fonts.ready);

  const messung = await seite.evaluate(() => ({
    scrollBreite: document.scrollingElement.scrollWidth,
    sichtBreite: document.documentElement.clientWidth,
    hoehe: document.scrollingElement.scrollHeight,
    zeichen: document.body.innerText.replace(/\s+/g, " ").trim().length,
    schrift: document.fonts.check('16px "Source Sans 3"'),
    titel: document.title,
  }));

  if (messung.scrollBreite > messung.sichtBreite + 1) {
    befunde.push([
      bogen,
      `läuft waagerecht über: ${messung.scrollBreite} px Inhalt auf ${messung.sichtBreite} px Breite`,
    ]);
  }
  if (!messung.schrift) befunde.push([bogen, "Source Sans 3 nicht geladen"]);
  // Die im Marker angegebene Höhe ist die Kartengröße in der
  // Design-System-Ansicht. Weicht sie stark ab, wird der Bogen dort
  // beschnitten oder schwimmt in leerer Fläche.
  const angegeben = Number(angaben.height);
  if (angegeben && Math.abs(angegeben - messung.hoehe) / messung.hoehe > 0.15) {
    befunde.push([
      bogen,
      `Marker sagt ${angegeben} px hoch, gemessen sind ${messung.hoehe} px`,
    ]);
  }
  if (messung.zeichen < 400) befunde.push([bogen, `nur ${messung.zeichen} Zeichen Text – zu dünn`]);
  if (konsole.length) befunde.push([bogen, `Konsolenfehler: ${konsole[0]}`]);
  if (fehlgeschlagen.length) {
    befunde.push([bogen, `Anfrage fehlgeschlagen: ${fehlgeschlagen[0].split("/").pop()}`]);
  }

  if (BILDER) {
    const name = bogen.replace(/\//g, "-").replace(/\.html$/, ".png");
    await seite.screenshot({ path: join(AUFNAHMEN, name), fullPage: true });
  }

  const marke = befunde.some(([b]) => b === bogen) ? "✗" : "✓";
  console.log(
    `${marke} ${bogen.padEnd(38)} ${String(breite).padStart(4)}×${String(messung.hoehe).padStart(4)} px · ` +
      `${String(messung.zeichen).padStart(4)} Zeichen`,
  );
  await seite.close();
}

await browser.close();

console.log("");
if (befunde.length === 0) {
  console.log(`Alle ${bögen.length} Bögen in Ordnung.`);
} else {
  console.log(`${befunde.length} Befund(e):`);
  for (const [bogen, text] of befunde) console.log(`  ${bogen}: ${text}`);
  process.exitCode = 1;
}
