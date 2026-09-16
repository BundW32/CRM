/**
 * Bringt Rohmaterial auf ein einheitliches Format: 1080×1920, 30 fps, H.264.
 *
 *   node werkzeuge/normalisieren.mjs <rohdatei> [zielname]
 *
 * Warum überhaupt: Handys liefern variable Bildraten. Damit laufen Zeitmarken
 * aus dem Transkript und die Frame-Nummern im Schnitt auseinander — ein Schnitt
 * bei Sekunde 12 sitzt dann nicht bei Sekunde 12. `fps=30` steht deshalb als
 * ERSTES Glied der Filterkette, vor jedem Skalieren.
 *
 * Querformat wird mittig auf Hochkant beschnitten; taugt als B-Roll, nicht als
 * Sprecherbild.
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ffmpeg = require("ffmpeg-static");
const ffprobe = require("ffprobe-static").path;

const hier = dirname(fileURLToPath(import.meta.url));
const ZIEL_ORDNER = join(hier, "..", "public", "roh");

const [, , quelle, zielname] = process.argv;
if (!quelle) {
  console.error("Aufruf: node werkzeuge/normalisieren.mjs <rohdatei> [zielname]");
  process.exit(1);
}

const pruefen = (datei) => {
  const roh = execFileSync(
    ffprobe,
    [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=width,height,r_frame_rate,nb_frames",
      "-show_entries", "format=duration",
      "-of", "json",
      datei,
    ],
    { encoding: "utf8" },
  );
  return JSON.parse(roh);
};

const vorher = pruefen(quelle);
const strom = vorher.streams?.[0] ?? {};
console.log(
  `Quelle: ${strom.width}×${strom.height}, ${strom.r_frame_rate} fps, ${Number(vorher.format?.duration ?? 0).toFixed(2)} s`,
);

const ziel = join(ZIEL_ORDNER, zielname ?? basename(quelle).replace(/\.[^.]+$/, "") + "-1080x1920.mp4");

execFileSync(
  ffmpeg,
  [
    "-y",
    "-i", quelle,
    "-vf", "fps=30,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920",
    "-c:v", "libx264",
    "-preset", "slow",
    "-crf", "16",
    "-pix_fmt", "yuv420p",
    // Ton unangetastet lassen: die Lautheit wird erst am fertigen Reel gesetzt,
    // sonst normalisiert man Pausen mit.
    "-c:a", "aac",
    "-b:a", "192k",
    "-ar", "48000",
    ziel,
  ],
  { stdio: ["ignore", "ignore", "inherit"] },
);

const nachher = pruefen(ziel);
console.log(`Fertig: ${ziel}`);
console.log(`Ergebnis: ${nachher.streams?.[0]?.width}×${nachher.streams?.[0]?.height}, ${nachher.streams?.[0]?.r_frame_rate} fps`);
