/**
 * Setzt die Lautheit des fertigen Reels auf −14 LUFS (Instagram-Referenz).
 *
 *   node werkzeuge/lautheit.mjs out/reel.mp4 out/reel-final.mp4
 *
 * Zwei Durchläufe: erst messen, dann mit den gemessenen Werten korrigieren. Der
 * einstufige Weg regelt im Verlauf nach und pumpt hörbar, sobald Sprechpausen
 * im Material sind — und Sprechpausen sind hier die Regel.
 *
 * Das Bild wird nur kopiert, nicht neu kodiert: Der Schnitt ist schon gerendert,
 * ein zweiter Durchlauf durch den Encoder kostet nur Qualität.
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ffmpeg = require("ffmpeg-static");

const ZIEL = { I: -14, TP: -1.5, LRA: 11 };

const [, , quelle, ziel] = process.argv;
if (!quelle || !ziel) {
  console.error("Aufruf: node werkzeuge/lautheit.mjs <eingabe.mp4> <ausgabe.mp4>");
  process.exit(1);
}

/**
 * ffmpeg schreibt die Messung auf stderr, nicht auf stdout — deshalb wird sie
 * über die Shell zusammengeführt und danach der JSON-Block herausgeschnitten.
 */
const messen = () => {
  const ergebnis = execFileSync(
    "/bin/sh",
    [
      "-c",
      `${JSON.stringify(ffmpeg)} -hide_banner -i ${JSON.stringify(quelle)} -af loudnorm=I=${ZIEL.I}:TP=${ZIEL.TP}:LRA=${ZIEL.LRA}:print_format=json -f null - 2>&1`,
    ],
    { encoding: "utf8" },
  );
  const roh = ergebnis.slice(ergebnis.lastIndexOf("{"), ergebnis.lastIndexOf("}") + 1);
  return JSON.parse(roh);
};

const m = messen();
console.log(`gemessen: ${m.input_i} LUFS, True Peak ${m.input_tp} dBTP, LRA ${m.input_lra}`);

execFileSync(
  ffmpeg,
  [
    "-y",
    "-i", quelle,
    "-c:v", "copy",
    "-af",
    "loudnorm=" + [
      `I=${ZIEL.I}`,
      `TP=${ZIEL.TP}`,
      `LRA=${ZIEL.LRA}`,
      `measured_I=${m.input_i}`,
      `measured_TP=${m.input_tp}`,
      `measured_LRA=${m.input_lra}`,
      `measured_thresh=${m.input_thresh}`,
      `offset=${m.target_offset}`,
      "linear=true",
      "print_format=summary",
    ].join(":"),
    "-c:a", "aac",
    "-b:a", "192k",
    "-ar", "48000",
    ziel,
  ],
  { stdio: ["ignore", "ignore", "inherit"] },
);

const nachher = execFileSync(
  "/bin/sh",
  [
    "-c",
    `${JSON.stringify(ffmpeg)} -hide_banner -i ${JSON.stringify(ziel)} -af loudnorm=print_format=json -f null - 2>&1`,
  ],
  { encoding: "utf8" },
);
const n = JSON.parse(nachher.slice(nachher.lastIndexOf("{"), nachher.lastIndexOf("}") + 1));
console.log(`fertig: ${n.input_i} LUFS, True Peak ${n.input_tp} dBTP → ${ziel}`);
