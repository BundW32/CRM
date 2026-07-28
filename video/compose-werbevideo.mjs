// Schnitt der Vollversion aus den Rohaufnahmen.
//
//   node video/compose-werbevideo.mjs
//
// Liest out/manifest.json (schreibt werbevideo.js beim Aufnehmen) und schneidet
// daraus den Master. Aus 2560×1440 wird 1280×720 — der Weg über die doppelte
// Auflösung ist der Grund, warum die Zoomfahrten scharf bleiben.
//
// Zwei Regeln stecken fest in der Filterkette:
//   · `fps=30` steht immer zuerst. Die Aufnahmen haben variable Bildraten,
//     zoompan läuft damit sonst aus dem Tritt.
//   · Ausschnitte werden geprüft, nicht geraten. ffmpeg klemmt einen zu großen
//     Crop stillschweigend an den Rand und verschiebt damit die Komposition.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ffmpegPath from "ffmpeg-static";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(DIR, "out");
const CUT = path.join(OUT, "cut");
const NAME = process.env.VIDEO_NAME || "werbevideo";
const VIEW = { w: 1280, h: 720 }; // CSS-Pixel; die Aufnahme ist doppelt so groß
const SCALE = 2;
const ZOOM_FRAMES = 33; // ~1,1 s Zufahrt, danach steht das Bild
const MAX_SHOT = 5.0; // Sekunden — Obergrenze je Einstellung

const ff = (args) => execFileSync(ffmpegPath, args, { stdio: ["ignore", "pipe", "pipe"] });

const shots = JSON.parse(readFileSync(path.join(OUT, "manifest.json"), "utf8"));
rmSync(CUT, { recursive: true, force: true });
mkdirSync(CUT, { recursive: true });

const parts = [];
let total = 0;

shots.forEach((s, i) => {
  // Keine Einstellung steht länger als MAX_SHOT: Was darüber hinausgeht, ist
  // Leerlauf nach dem Lesen — und genau daran erkennt man die Bildschirmaufnahme.
  const start = (s.atMs + 80) / 1000;
  const dur = Math.min(MAX_SHOT, Math.max(0.8, (s.durMs - 80) / 1000));
  const chain = ["fps=30"];

  if (s.zoom?.crop) {
    const [w, h, x, y] = s.zoom.crop;
    if (x + w > VIEW.w || y + h > VIEW.h) {
      throw new Error(`Ausschnitt „${s.name}" liegt außerhalb des Bildes: ${x}+${w} / ${y}+${h}`);
    }
    const k = (s.zoom.to ?? 1.12) - 1;
    chain.push(`crop=${w * SCALE}:${h * SCALE}:${x * SCALE}:${y * SCALE}`);
    chain.push("scale=2560:1440");
    // ease-out-cubic bis zum Ziel, danach Stillstand — das Auge liest nichts Bewegtes.
    chain.push(
      `zoompan=z='if(lt(on,${ZOOM_FRAMES}),1+${k.toFixed(3)}*(1-pow(1-on/${ZOOM_FRAMES},3)),${(1 + k).toFixed(3)})'` +
        `:d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=2560x1440:fps=30`,
    );
  }
  chain.push("scale=1280:720:flags=lanczos", "format=yuv420p");

  const file = path.join(CUT, `${String(i).padStart(2, "0")}-${s.name}.mp4`);
  ff([
    "-y", "-loglevel", "error",
    "-ss", start.toFixed(3), "-t", dur.toFixed(3), "-i", s.file,
    "-vf", chain.join(","),
    "-r", "30", "-an", file,
  ]);
  parts.push(file);
  total += dur;
  console.log(`  ${s.name.padEnd(18)} ${dur.toFixed(1)}s${s.zoom ? "  (Zufahrt)" : ""}`);
});

// Harte Schnitte, keine Überblendungen: durchgehendes Kreuzblenden ist genau
// der Diashow-Look, den ein Werbevideo vermeiden muss.
const list = path.join(CUT, "list.txt");
writeFileSync(list, parts.map((p) => `file '${path.basename(p)}'`).join("\n") + "\n");

const mp4 = path.join(OUT, `${NAME}.mp4`);
ff(["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list,
    "-c:v", "libx264", "-preset", "slow", "-crf", "21", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", "-an", mp4]);

const webm = path.join(OUT, `${NAME}.webm`);
ff(["-y", "-loglevel", "error", "-i", mp4, "-c:v", "libvpx-vp9", "-crf", "34",
    "-b:v", "0", "-row-mt", "1", "-an", webm]);

// Das Plakat ist der letzte Frame — das Bild, das bei pausiertem Video steht.
const poster = path.join(OUT, `${NAME}-poster.jpg`);
ff(["-y", "-loglevel", "error", "-sseof", "-0.2", "-i", mp4, "-vframes", "1", "-q:v", "3", poster]);

const mb = (f) => (statSync(f).size / 1024 / 1024).toFixed(2) + " MB";
console.log(`\n${shots.length} Einstellungen · ${total.toFixed(1)} s`);
console.log(`  ${path.basename(mp4)}  ${mb(mp4)}`);
console.log(`  ${path.basename(webm)}  ${mb(webm)}`);
console.log(`  ${path.basename(poster)}  ${mb(poster)}`);
