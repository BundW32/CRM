/**
 * Findet Stellen, die aus dem Rohmaterial rausfliegen: Stille, Denkpausen,
 * Füllwörter und Wiederholungen.
 *
 *   node werkzeuge/pausen.mjs <video.mp4> <transkript.json> [--schwelle -34] [--mindest 0.28]
 *
 * Zwei Quellen, weil keine allein reicht:
 *
 *  * **ffmpeg silencedetect** findet echte Stille — auch dort, wo Whisper
 *    nichts gehört hat. Whisper verschluckt „äh" oft ganz, im Ton ist es aber
 *    da und kostet Tempo.
 *  * **Die Lücken zwischen den Wort-Zeitstempeln** finden Denkpausen mitten im
 *    Satz, die unter der Stille-Schwelle bleiben (Atmen, Schmatzen, „hmm").
 *
 * Ausgabe ist eine Liste von Abschnitten mit Grund und Länge plus die
 * Restlänge, wenn man sie herausnimmt. Entschieden wird im Schnittplan, nicht
 * hier: Ein kurzer Bruch vor der wichtigsten Aussage ist gewollt, den behält
 * man bewusst.
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const ffmpeg = require("ffmpeg-static");

const argumente = process.argv.slice(2);
const [video, transkript] = argumente.filter((a) => !a.startsWith("--"));
const wert = (name, standard) => {
  const i = argumente.indexOf(`--${name}`);
  return i === -1 ? standard : Number(argumente[i + 1]);
};

if (!video) {
  console.error("Aufruf: node werkzeuge/pausen.mjs <video.mp4> [transkript.json] [--schwelle -34] [--mindest 0.28]");
  process.exit(1);
}

const SCHWELLE_DB = wert("schwelle", -34);
const MINDEST_S = wert("mindest", 0.28);

/** Füllwörter und Neuansätze, die im Schnitt fast immer weg können. */
const FUELLWOERTER = new Set(["äh", "ähm", "ah", "hm", "hmm", "öh", "also", "ja", "ne", "halt", "quasi", "sozusagen"]);

const stillen = () => {
  const ausgabe = execFileSync(
    "/bin/sh",
    [
      "-c",
      `${JSON.stringify(ffmpeg)} -hide_banner -i ${JSON.stringify(video)} -af silencedetect=noise=${SCHWELLE_DB}dB:d=${MINDEST_S} -f null - 2>&1`,
    ],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );

  const abschnitte = [];
  let start = null;
  for (const zeile of ausgabe.split("\n")) {
    const an = zeile.match(/silence_start: (-?[\d.]+)/);
    const aus = zeile.match(/silence_end: ([\d.]+)/);
    if (an) start = Math.max(0, Number(an[1]));
    if (aus && start !== null) {
      abschnitte.push({ von: start, bis: Number(aus[1]), grund: "Stille" });
      start = null;
    }
  }
  return abschnitte;
};

const luecken = () => {
  if (!transkript) return [];
  const worte = JSON.parse(readFileSync(transkript, "utf8"));
  const gefunden = [];
  for (let i = 1; i < worte.length; i += 1) {
    const abstand = (worte[i].startMs - worte[i - 1].endMs) / 1000;
    if (abstand >= MINDEST_S) {
      gefunden.push({
        von: worte[i - 1].endMs / 1000,
        bis: worte[i].startMs / 1000,
        grund: "Denkpause",
      });
    }
  }
  return gefunden;
};

const fuellwoerter = () => {
  if (!transkript) return [];
  const worte = JSON.parse(readFileSync(transkript, "utf8"));
  return worte
    .filter((w) => FUELLWOERTER.has(w.text.trim().toLowerCase().replace(/[.,!?]/g, "")))
    .map((w) => ({ von: w.startMs / 1000, bis: w.endMs / 1000, grund: `Füllwort „${w.text.trim()}"` }));
};

/** Überlappende Fundstellen zusammenlegen, sonst zählt man Zeit doppelt. */
const zusammenlegen = (abschnitte) => {
  const sortiert = [...abschnitte].sort((a, b) => a.von - b.von);
  const raus = [];
  for (const a of sortiert) {
    const letzter = raus[raus.length - 1];
    if (letzter && a.von <= letzter.bis + 0.05) {
      letzter.bis = Math.max(letzter.bis, a.bis);
      if (!letzter.grund.includes(a.grund)) letzter.grund += ` + ${a.grund}`;
    } else {
      raus.push({ ...a });
    }
  }
  return raus;
};

const dauer = () => {
  const ausgabe = execFileSync(
    "/bin/sh",
    [
      "-c",
      `${JSON.stringify(require("ffprobe-static").path)} -v error -show_entries format=duration -of csv=p=0 ${JSON.stringify(video)}`,
    ],
    { encoding: "utf8" },
  );
  return Number(ausgabe.trim());
};

const gefunden = zusammenlegen([...stillen(), ...luecken(), ...fuellwoerter()]);
const gesamt = dauer();
const weg = gefunden.reduce((s, a) => s + (a.bis - a.von), 0);

console.log(`Gesamtlänge: ${gesamt.toFixed(2)} s`);
console.log(`${gefunden.length} Fundstellen, zusammen ${weg.toFixed(2)} s`);
console.log(`Rest, wenn alles rausfliegt: ${(gesamt - weg).toFixed(2)} s\n`);
for (const a of gefunden) {
  console.log(`  ${a.von.toFixed(2)} – ${a.bis.toFixed(2)}  (${(a.bis - a.von).toFixed(2)} s)  ${a.grund}`);
}

const ziel = video.replace(/\.[^.]+$/, "") + "-pausen.json";
writeFileSync(ziel, JSON.stringify({ gesamt, weg, abschnitte: gefunden }, null, 2));
console.log(`\n→ ${ziel}`);
