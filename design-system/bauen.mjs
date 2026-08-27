#!/usr/bin/env node
// Baut das Design-System-Bündel neu.
//
//   node design-system/bauen.mjs
//
// Alle Werte kommen aus `portal/src/app/globals.css`; die Kontrast-Zahlen
// werden gerechnet, nicht abgeschrieben. Was hier herausfällt, liegt in
// `design-system/vorschau/` und ist genau das, was in ein Claude-Design-Projekt
// hochgeladen wird (siehe README).

import { mkdirSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { tokenLesen, WURZEL } from "./lib/tokens.mjs";

import * as farben from "./karten/farben.mjs";
import * as schrift from "./karten/schrift.mjs";
import * as formUndTiefe from "./karten/form-und-tiefe.mjs";
import * as bewegung from "./karten/bewegung.mjs";
import * as wortmarke from "./karten/wortmarke.mjs";
import * as knoepfe from "./karten/knoepfe.mjs";
import * as formularfelder from "./karten/formularfelder.mjs";
import * as kartenUndHinweise from "./karten/karten-und-hinweise.mjs";
import * as kopfUndFusszeile from "./karten/kopf-und-fusszeile.mjs";
import * as baender from "./karten/baender.mjs";
import * as seitenaufbau from "./karten/seitenaufbau.mjs";

const ZIEL = join(WURZEL, "design-system", "vorschau");

// Reihenfolge = Reihenfolge in der Design-System-Ansicht.
const KARTEN = [
  { pfad: "grundlagen/farben.html", modul: farben },
  { pfad: "grundlagen/schrift.html", modul: schrift },
  { pfad: "grundlagen/form-und-tiefe.html", modul: formUndTiefe },
  { pfad: "grundlagen/bewegung.html", modul: bewegung },
  { pfad: "marke/wortmarke.html", modul: wortmarke },
  { pfad: "komponenten/knoepfe.html", modul: knoepfe },
  { pfad: "komponenten/formularfelder.html", modul: formularfelder },
  { pfad: "komponenten/karten-und-hinweise.html", modul: kartenUndHinweise },
  { pfad: "komponenten/kopf-und-fusszeile.html", modul: kopfUndFusszeile },
  { pfad: "muster/baender.html", modul: baender },
  { pfad: "muster/seitenaufbau.html", modul: seitenaufbau },
];

const SCHRIFTEN = ["sourcesans-400.woff2", "sourcesans-600.woff2"];

function schreiben(pfad, inhalt) {
  const ziel = join(ZIEL, pfad);
  mkdirSync(dirname(ziel), { recursive: true });
  writeFileSync(ziel, inhalt, "utf8");
  return ziel;
}

/** Liest die Kopfzeile einer erzeugten Seite zurück – die Karten-Angaben. */
function markerLesen(html, pfad) {
  const zeile = html.split("\n", 1)[0];
  const treffer = zeile.match(/^<!-- @dsCard (.+) -->$/);
  if (!treffer) throw new Error(`${pfad}: erste Zeile ist kein @dsCard-Marker`);
  const angaben = {};
  for (const paar of treffer[1].matchAll(/(\w+)="([^"]*)"/g)) {
    angaben[paar[1]] = paar[2];
  }
  return angaben;
}

function uebersicht(karten) {
  const gruppen = new Map();
  for (const k of karten) {
    if (!gruppen.has(k.group)) gruppen.set(k.group, []);
    gruppen.get(k.group).push(k);
  }
  const abschnitte = [...gruppen.entries()]
    .map(
      ([gruppe, liste]) => `  <section>
    <h2>${gruppe}</h2>
    <ul>
${liste
  .map(
    (k) =>
      `      <li><a href="${k.path}">${k.name}</a><span>${k.subtitle ?? ""}</span></li>`,
  )
  .join("\n")}
    </ul>
  </section>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Design-System wegportal24</title>
<style>
  body { margin: 0; padding: 48px 32px; background: #faf8f4; color: #374151;
    font-family: "Source Sans 3", ui-sans-serif, system-ui, sans-serif; line-height: 1.55; }
  .bogen { max-width: 780px; margin: 0 auto; }
  h1 { font-size: 30px; font-weight: 700; letter-spacing: -.02em; color: #00241f; margin: 0 0 10px; }
  .vor { color: #4b5563; max-width: 62ch; margin: 0 0 8px; }
  section { margin-top: 40px; }
  h2 { font-size: 12px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase;
    color: #00241f; margin: 0 0 14px; padding-bottom: 10px; border-bottom: 1px solid rgba(0,36,31,.14); }
  ul { list-style: none; margin: 0; padding: 0; }
  li { display: flex; flex-wrap: wrap; align-items: baseline; gap: 12px; padding: 9px 0; border-bottom: 1px solid #eef0ee; }
  li:last-child { border-bottom: 0; }
  a { color: #003630; font-weight: 600; text-decoration: none; text-decoration-color: #f69018; }
  a:hover { text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 4px; }
  span { color: #9ca3af; font-size: 13px; }
  .fuss { margin-top: 48px; padding-top: 16px; border-top: 1px solid rgba(0,36,31,.12); font-size: 12.5px; color: #9ca3af; }
  code { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 12px;
    background: rgba(0,54,48,.06); border-radius: 5px; padding: 1px 5px; color: #003630; }
</style>
</head>
<body>
<div class="bogen">
  <h1>Design-System wegportal24</h1>
  <p class="vor">Elf Bögen, erzeugt aus dem Code des Portals. Farben, Schrift, Form und Bewegung
  stammen aus <code>portal/src/app/globals.css</code>, die Kontraste sind gerechnet.</p>
${abschnitte}
  <p class="fuss">Erzeugt von <code>design-system/bauen.mjs</code> – Änderungen gehören in den
  Code des Portals, nicht in diese Dateien.</p>
</div>
</body>
</html>
`;
}

function main() {
  const tokens = tokenLesen();
  const karten = [];

  for (const { pfad, modul } of KARTEN) {
    const html = modul.bauen(tokens);
    schreiben(pfad, html);
    const angaben = markerLesen(html, pfad);
    karten.push({
      name: angaben.name,
      path: pfad,
      group: angaben.group,
      subtitle: angaben.subtitle,
      viewport: { width: Number(angaben.width), height: Number(angaben.height) },
    });
  }

  // Schriftschnitte mitnehmen: Die Bögen verweisen relativ auf ../schrift/*.
  for (const datei of SCHRIFTEN) {
    const quelle = join(WURZEL, "portal", "public", "fonts", datei);
    if (!existsSync(quelle)) {
      throw new Error(`Schriftdatei fehlt: ${quelle}`);
    }
    mkdirSync(join(ZIEL, "schrift"), { recursive: true });
    copyFileSync(quelle, join(ZIEL, "schrift", datei));
  }

  schreiben("index.html", uebersicht(karten));

  // Karten-Angaben als Datei: Wer über die Design-System-Ansicht hochlädt,
  // braucht sie nicht (die liest den @dsCard-Marker in Zeile 1). Wer über
  // `register_assets` geht, findet hier genau die Werte, die dort hingehören.
  schreiben("_ds_cards.json", JSON.stringify({ cards: karten }, null, 2) + "\n");

  console.log(`${karten.length} Bögen gebaut nach design-system/vorschau/`);
  for (const k of karten) console.log(`  ${k.group.padEnd(12)} ${k.name.padEnd(24)} ${k.path}`);
  console.log(`  Schriften     ${SCHRIFTEN.join(", ")}`);
}

main();
