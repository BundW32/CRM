// Schnitt aus den Rohaufnahmen.
//
//   node video/compose-werbevideo.mjs                                   (Vollversion)
//   VIDEO_NAME=hero-loop MANIFEST=manifest-loop.json node …             (Hero-Schleife)
//
// Liest die Schnittliste, die beim Aufnehmen entsteht (out/manifest*.json), und
// schneidet danach. Aus 2560×1440 wird 1920×1080 — herunterskaliert, nicht
// hochgerechnet: Die Aufnahme läuft mit --force-device-scale-factor=2, das Bild
// ist echt in doppelter Auflösung da.
//
// Drei Regeln stecken fest in der Filterkette:
//   · `fps=30` steht immer zuerst. Die Aufnahmen haben variable Bildraten,
//     zoompan läuft damit sonst aus dem Tritt.
//   · Die Zufahrt zielt auf den **gemessenen** Kasten des Elements, das die
//     Aussage beweist (aus der Schnittliste), nicht auf geschätzte Koordinaten.
//     Geratene Ausschnitte klemmt ffmpeg stillschweigend an den Rand.
//   · Die Zufahrt kommt an und **steht** dann. Kein Herausfahren danach: Das
//     Auge liest nichts Bewegtes, und genau dort steht die Zahl, um die es geht.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ffmpegPath from "ffmpeg-static";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(DIR, "out");
const CUT = path.join(OUT, "cut");
const NAME = process.env.VIDEO_NAME || "werbevideo";
const REC = { w: 2560, h: 1440 }; // Aufnahmegröße
const SCALE = 2; // CSS-Pixel → Aufnahme-Pixel
const OUTW = 1920, OUTH = 1080;
const FPS = 30;
const PUSH_FRAMES = 9; // ~0,3 s Zufahrt
const LOGO_FROM = Number(process.env.LOGO_FROM || 0); // Sekunde, ab der das Logo steht
const PROGRESS = process.env.PROGRESS === "1";

const ff = (args) => execFileSync(ffmpegPath, args, { stdio: ["ignore", "pipe", "pipe"] });
const shots = JSON.parse(readFileSync(path.join(OUT, process.env.MANIFEST || "manifest.json"), "utf8"));

rmSync(CUT, { recursive: true, force: true });
mkdirSync(CUT, { recursive: true });

const parts = [];
let total = 0;

shots.forEach((s, i) => {
  const start = (s.atMs + (s.leadMs ?? 80)) / 1000;
  const dur = s.cutMs / 1000;
  const chain = [`fps=${FPS}`];
  let zoomUsed = 1;

  if (s.push) {
    // Zufahrt auf den gemessenen Kasten: Mittelpunkt in Aufnahme-Pixeln.
    const { box, to } = s.push;
    if (box.x < 0 || box.y < 0 || box.x + box.w > 1280 || box.y + box.h > 720) {
      throw new Error(`Kasten „${s.name}" liegt außerhalb des Fensters: ${JSON.stringify(box)}`);
    }
    const cx = Math.round((box.x + box.w / 2) * SCALE);
    const cy = Math.round((box.y + box.h / 2) * SCALE);
    const at = Math.round(((s.push.atMs ?? 0) / 1000) * FPS);
    // Der Zoom folgt dem Kasten, statt geraten zu werden: So weit heran, dass
    // der Kasten mit etwas Luft das Bild füllt — mehr würde ihn anschneiden.
    // `to` wirkt nur noch als Obergrenze.
    const fit = Math.min(1280 / (box.w * 1.12), 720 / (box.h * 1.12));
    const zoom = Math.max(1.05, Math.min(to ?? 99, fit, 2.2));
    const k = (zoom - 1).toFixed(3);
    zoomUsed = zoom;
    // ease-out-cubic bis zum Ziel, danach Stillstand.
    const z = `1+${k}*(1-pow(1-clip((on-${at})/${PUSH_FRAMES},0,1),3))`;
    chain.push(
      `zoompan=z='${z}':x='clip(${cx}-(iw/zoom/2),0,iw-iw/zoom)':y='clip(${cy}-(ih/zoom/2),0,ih-ih/zoom)'` +
        `:d=1:s=${REC.w}x${REC.h}:fps=${FPS}`,
    );
  } else if (s.drift) {
    // Ruhige Grundbewegung für Einstellungen ohne beweisendes Einzelelement.
    const k = (s.drift - 1).toFixed(3);
    const n = Math.max(1, Math.round(dur * FPS));
    chain.push(
      `zoompan=z='1+${k}*clip(on/${n},0,1)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'` +
        `:d=1:s=${REC.w}x${REC.h}:fps=${FPS}`,
    );
  }

  // Herunterskalieren mit leichter Nachschärfung: Die Oberfläche ist voller
  // feiner Linien und Ziffern, die beim Verkleinern sonst weich werden.
  chain.push(`scale=${OUTW}:${OUTH}:flags=lanczos`, "unsharp=5:5:0.5:5:5:0.0", "format=yuv420p");

  const file = path.join(CUT, `${String(i).padStart(2, "0")}-${s.name}.mp4`);
  ff(["-y", "-loglevel", "error", "-ss", start.toFixed(3), "-t", dur.toFixed(3), "-i", s.file,
      "-vf", chain.join(","), "-r", String(FPS), "-an", file]);
  parts.push(file);
  total += dur;
  console.log(`  ${s.name.padEnd(16)} ${dur.toFixed(1)}s${s.push ? `  Zufahrt ${zoomUsed.toFixed(2)}×` : s.drift ? "  Drift" : ""}`);
});

// Harte Schnitte, keine Überblendungen.
const list = path.join(CUT, "list.txt");
writeFileSync(list, parts.map((p) => `file '${path.basename(p)}'`).join("\n") + "\n");

const raw = path.join(CUT, "_concat.mp4");
ff(["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list,
    "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p", "-an", raw]);

// ── Auflagen: Fortschrittsbalken und Logo-Bug ───────────────────────────────
const mp4 = path.join(OUT, `${NAME}.mp4`);
const logo = path.join(DIR, "cards", "bw-logo.png");
const overlays = [];
let last = "0:v";

if (PROGRESS) {
  // Zeigt, wie lang das Video noch läuft — hält die, die sonst abspringen.
  overlays.push(`[${last}]drawbox=x=0:y=0:w='iw*t/${total.toFixed(2)}':h=6:color=0xf69018@0.95:t=fill[p]`);
  last = "p";
}
if (LOGO_FROM > 0 && existsSync(logo)) {
  // Das Logo trägt dunkelgrüne Schrift und verschwindet auf dunklem Grund —
  // deshalb steht es auf einer hellen Platte, wie auf Briefpapier.
  const en = `enable='gte(t,${LOGO_FROM})'`;
  // Höhe zuerst festlegen, dann die Platte darum: Skaliert man nach Breite,
  // wird das Logo höher als seine Platte und ragt darüber hinaus.
  // Unten rechts: Die Einblendungen stehen links unten, die Kopfzeile der App
  // oben — dort wäre der Bug ein Fremdkörper, der echte Bedienelemente verdeckt.
  overlays.push(`[${last}]drawbox=x=iw-168:y=ih-92:w=132:h=64:color=white@0.93:t=fill:${en}[bg]`);
  overlays.push(`[1:v]scale=-1:42[lg]`);
  overlays.push(`[bg][lg]overlay=x=W-168+(132-w)/2:y=H-92+(64-h)/2:${en}[o]`);
  last = "o";
}

if (overlays.length) {
  const args = ["-y", "-loglevel", "error", "-i", raw];
  if (LOGO_FROM > 0 && existsSync(logo)) args.push("-i", logo);
  args.push("-filter_complex", overlays.join(";"), "-map", `[${last}]`,
    "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", "-an", mp4);
  ff(args);
} else {
  ff(["-y", "-loglevel", "error", "-i", raw, "-c:v", "copy", "-movflags", "+faststart", mp4]);
}

const webm = path.join(OUT, `${NAME}.webm`);
ff(["-y", "-loglevel", "error", "-i", mp4, "-c:v", "libvpx-vp9", "-crf", "33",
    "-b:v", "0", "-row-mt", "1", "-an", webm]);

// Das Plakat ist der letzte Frame — das Bild, das bei pausiertem Video steht.
const poster = path.join(OUT, `${NAME}-poster.jpg`);
ff(["-y", "-loglevel", "error", "-sseof", "-0.2", "-i", mp4, "-vframes", "1", "-q:v", "3", poster]);

const mb = (f) => (statSync(f).size / 1024 / 1024).toFixed(2) + " MB";
console.log(`\n${shots.length} Einstellungen · ${total.toFixed(1)} s · ${OUTW}×${OUTH}`);
for (const f of [mp4, webm, poster]) console.log(`  ${path.basename(f)}  ${mb(f)}`);
