/**
 * Erzeugt das Prüfmaterial für die Composition `Reelprobe`.
 *
 *   node werkzeuge/probe-material.mjs
 *
 * Das Rohmaterial eines Reels gehört nicht ins Repo (siehe .gitignore), die
 * Prüfung soll aber bei jedem laufen. Deshalb wird hier ein Ersatzvideo
 * gebaut: Testbild mit eingebautem Zähler, Ton als leiser Sinus, genau so lang wie
 * das mitgelieferte Transkript `src/probe-transkript.json`.
 *
 * Geprüft wird damit die Geometrie und der Takt — nicht der Klang: Sitzen die
 * Untertitel nach einem Schnitt noch auf dem richtigen Wort, und stimmt die
 * Gesamtlänge?
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ffmpeg = require("ffmpeg-static");
const hier = dirname(fileURLToPath(import.meta.url));

const transkript = JSON.parse(readFileSync(join(hier, "..", "src", "probe-transkript.json"), "utf8"));
const laenge = Math.ceil((transkript.at(-1)?.endMs ?? 5000) / 1000) + 1;
const ziel = join(hier, "..", "public", "roh", "probe-1080x1920.mp4");

execFileSync(
  ffmpeg,
  [
    "-y",
    // testsrc zeigt einen eingebauten Zähler — damit ist am Einzelbild
    // ablesbar, welche Rohsekunde gerade läuft. Der drawtext-Filter fehlt in
    // diesem ffmpeg-Build, deshalb nicht selbst beschriften.
    "-f", "lavfi", "-i", `testsrc=size=1080x1920:rate=30:duration=${laenge}`,
    "-f", "lavfi", "-i", `sine=frequency=330:duration=${laenge}`,
    "-vf", "fps=30",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18",
    "-c:a", "aac", "-b:a", "128k", "-ar", "48000",
    "-shortest",
    ziel,
  ],
  { stdio: ["ignore", "ignore", "inherit"] },
);

console.log(`Prüfmaterial: ${ziel} (${laenge} s)`);
