/**
 * Prüft ein fertig gerendertes Reel, bevor es jemand zu sehen bekommt.
 *
 *   node --experimental-strip-types werkzeuge/pruefe-render.ts out/reel.mp4 [--erwartet 38.5]
 *
 * Der Anlass: Im ersten echten Reel zerfiel das Bild gegen Ende in Schnipsel,
 * und aufgefallen ist es erst Alex. Am Schnittplan sieht man das nicht, an
 * einem Einzelbild aus der Mitte auch nicht — man muss das fertige Video
 * befragen.
 *
 * Geprüft wird:
 *   * **Standbilder** (`freezedetect`) — das Zeichen dafür, dass ein Segment
 *     über das Ende der Quelle hinausreicht und der Decoder das letzte Bild
 *     wiederholt.
 *   * **Schwarzbilder** (`blackdetect`) — Löcher im Schnitt.
 *   * **Stille am Schluss** — abgeschnittener Ton oder ein Segment ohne Audio.
 *   * **Format und Länge** — 1080×1920, 30 fps, Tonspur vorhanden, und die
 *     Länge stimmt mit der erwarteten überein.
 *
 * Zusätzlich werden Einzelbilder über die ganze Länge herausgeschrieben; die
 * letzten drei liegen dicht am Ende, weil genau dort der Fehler saß.
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const ffmpeg = require("ffmpeg-static") as string;
const ffprobe = (require("ffprobe-static") as { path: string }).path;

const argumente = process.argv.slice(2);
const [video] = argumente.filter((a) => !a.startsWith("--"));
const erwartetIndex = argumente.indexOf("--erwartet");
const erwartet = erwartetIndex === -1 ? null : Number(argumente[erwartetIndex + 1]);

if (!video) {
  console.error("Aufruf: node --experimental-strip-types werkzeuge/pruefe-render.ts <reel.mp4> [--erwartet <sekunden>]");
  process.exit(1);
}

const shell = (befehl: string) =>
  execFileSync("/bin/sh", ["-c", befehl], { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });

const befunde: string[] = [];
const melde = (text: string) => {
  befunde.push(text);
  console.log(`  ✗ ${text}`);
};

// ── Format ────────────────────────────────────────────────────────────────
const daten = JSON.parse(
  shell(
    `${JSON.stringify(ffprobe)} -v error -show_entries stream=codec_type,codec_name,width,height,r_frame_rate -show_entries format=duration,bit_rate -of json ${JSON.stringify(video)}`,
  ),
);
const bild = daten.streams.find((s: { codec_type: string }) => s.codec_type === "video");
const ton = daten.streams.find((s: { codec_type: string }) => s.codec_type === "audio");
const dauer = Number(daten.format.duration);

console.log(`Datei: ${video}`);
console.log(`Bild: ${bild?.width}×${bild?.height} @ ${bild?.r_frame_rate}, ${bild?.codec_name}`);
console.log(`Ton: ${ton ? ton.codec_name : "FEHLT"}`);
console.log(`Länge: ${dauer.toFixed(2)} s\n`);

if (bild?.width !== 1080 || bild?.height !== 1920) melde(`Format ist ${bild?.width}×${bild?.height}, Instagram erwartet 1080×1920`);
if (bild?.r_frame_rate !== "30/1") melde(`Bildrate ist ${bild?.r_frame_rate}, erwartet 30/1`);
if (!ton) melde("Es gibt keine Tonspur");
if (erwartet !== null && Math.abs(dauer - erwartet) > 0.2) {
  melde(`Länge ${dauer.toFixed(2)} s weicht von den erwarteten ${erwartet.toFixed(2)} s ab`);
}

// ── Standbilder ───────────────────────────────────────────────────────────
// Ein eingefrorenes Bild von einer halben Sekunde fällt beim Ansehen sofort
// auf und hat im Reel nie etwas zu suchen — es gibt keine Standbild-Gestaltung
// in diesem Stil.
const frost = shell(
  `${JSON.stringify(ffmpeg)} -hide_banner -i ${JSON.stringify(video)} -vf freezedetect=n=-55dB:d=0.4 -map 0:v -f null - 2>&1`,
)
  .split("\n")
  .filter((z) => z.includes("freeze_start") || z.includes("freeze_duration"));

const froststellen: { ab: number; dauer: number }[] = [];
let letzterStart: number | null = null;
for (const zeile of frost) {
  const start = zeile.match(/freeze_start: ([\d.]+)/);
  const laenge = zeile.match(/freeze_duration: ([\d.]+)/);
  if (start) letzterStart = Number(start[1]);
  if (laenge && letzterStart !== null) {
    froststellen.push({ ab: letzterStart, dauer: Number(laenge[1]) });
    letzterStart = null;
  }
}
if (letzterStart !== null) froststellen.push({ ab: letzterStart, dauer: dauer - letzterStart });

for (const f of froststellen) {
  melde(`Standbild ab ${f.ab.toFixed(2)} s für ${f.dauer.toFixed(2)} s — reicht ein Segment über das Ende der Quelle hinaus?`);
}

// ── Schwarzbilder ─────────────────────────────────────────────────────────
const schwarz = shell(
  `${JSON.stringify(ffmpeg)} -hide_banner -i ${JSON.stringify(video)} -vf blackdetect=d=0.15:pix_th=0.10 -map 0:v -f null - 2>&1`,
)
  .split("\n")
  .filter((z) => z.includes("black_start"));
for (const z of schwarz) {
  const m = z.match(/black_start:([\d.]+) black_end:([\d.]+)/);
  if (m) melde(`Schwarzbild von ${Number(m[1]).toFixed(2)} bis ${Number(m[2]).toFixed(2)} s`);
}

// ── Ton am Schluss ────────────────────────────────────────────────────────
if (ton) {
  const stillen = shell(
    `${JSON.stringify(ffmpeg)} -hide_banner -i ${JSON.stringify(video)} -af silencedetect=noise=-50dB:d=0.8 -f null - 2>&1`,
  )
    .split("\n")
    .filter((z) => z.includes("silence_start"))
    .map((z) => Number(z.match(/silence_start: (-?[\d.]+)/)?.[1] ?? NaN))
    .filter((n) => !Number.isNaN(n));

  const letzteStille = stillen.at(-1);
  if (letzteStille !== undefined && dauer - letzteStille > 1.2) {
    melde(`Ab ${letzteStille.toFixed(2)} s ist es still bis zum Ende (${(dauer - letzteStille).toFixed(2)} s) — abgeschnittener Ton?`);
  }
}

// ── Einzelbilder zum Ansehen ──────────────────────────────────────────────
const ordner = join(dirname(video), "kontrolle");
mkdirSync(ordner, { recursive: true });
const zeitpunkte = [
  0.3,
  ...[0.15, 0.3, 0.45, 0.6, 0.75].map((p) => dauer * p),
  // Dicht ans Ende, dort saß der Fehler.
  Math.max(0, dauer - 1.5),
  Math.max(0, dauer - 0.6),
  Math.max(0, dauer - 0.15),
];
for (const [i, t] of zeitpunkte.entries()) {
  shell(
    `${JSON.stringify(ffmpeg)} -y -ss ${t.toFixed(2)} -i ${JSON.stringify(video)} -vframes 1 -vf scale=360:-1 ${JSON.stringify(join(ordner, `${String(i + 1).padStart(2, "0")}-${t.toFixed(1)}s.png`))} 2>&1 | tail -1`,
  );
}
console.log(`\n${zeitpunkte.length} Kontrollbilder → ${ordner}`);

if (befunde.length === 0) {
  console.log("\nKeine Auffälligkeiten. Trotzdem die Kontrollbilder ansehen — Lesbarkeit und Bildaufbau prüft kein Filter.");
} else {
  console.log(`\n${befunde.length} Auffälligkeiten. Das Reel geht so nicht raus.`);
  process.exit(1);
}
