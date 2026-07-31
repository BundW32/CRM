// Schnitt der Endfassung. Liest die Marken, die die Aufnahme geschrieben hat.
//
//   node video/compose.js
//
// Drei Dinge unterscheiden diese Fassung von den früheren:
//
//  1. KAMERAFAHRTEN statt Standbild-mit-Zoom. `fahrt()` gleitet innerhalb einer
//     Einstellung von Bildausschnitt A nach B — Schwenk und Zoom zugleich, mit
//     ease-in-out. Das ist der Unterschied zwischen „Bild mit Zoomeffekt" und
//     „Kamera".
//  2. KREUZBLENDEN zwischen den Einstellungen statt durchgehend harter Schnitte.
//     Bewusst kurz (0,28 s) und nur hier: Lange Blenden ergäben eine Diashow.
//  3. Schnitte kommen aus MARKEN, nicht aus geschätzten Sekunden.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const FF = require("ffmpeg-static");
const { fahrtFilter } = require("./lib/kamera");

const ROOT = __dirname;
const RAW = path.join(ROOT, "out", "raw");
const CUT = path.join(ROOT, "out", "cut");
const OUT = path.join(ROOT, "out");

const W = 1280, H = 720, FPS = 30;
const BLENDE = 0.28;
const teile = [];

const clip = (n) => {
  const dir = path.join(RAW, n);
  const f = fs.readdirSync(dir).filter((x) => x.endsWith(".webm"));
  if (f.length !== 1) throw new Error(`${dir}: ${f.length} Aufnahmen — erwartet genau eine`);
  return path.join(dir, f[0]);
};
const marks = (n) => JSON.parse(fs.readFileSync(path.join(RAW, n, "marks.json"), "utf8"));
const ff = (a) => execFileSync(FF, ["-y", "-loglevel", "error", ...a], { stdio: ["ignore", "ignore", "pipe"] });

// `-ss` steht IMMER nach `-i` (bildgenau) und `fps` als erstes Filterglied
// (die Aufnahmen haben variable Bildraten).
function schnitt(out, src, ss, t, filter) {
  if (t < 0.6) throw new Error(`${out}: ${t.toFixed(2)} s — zu kurz`);
  const vf = ["fps=" + FPS, filter, `scale=${W}:${H}:flags=lanczos`, "format=yuv420p"]
    .filter(Boolean).join(",");
  ff(["-i", clip(src), "-ss", ss.toFixed(2), "-t", t.toFixed(2), "-vf", vf, "-an",
      path.join(CUT, out + ".mp4")]);
  teile.push({ name: out, d: t });
  return out;
}

// Einstellung ohne Kamerabewegung (nur noch für Tafeln und kurze Anschlüsse).
const ruhig = (out, src, ss, t) => schnitt(out, src, ss, t);

// Kamerafahrt von A nach B. z = Zoomfaktor, cx/cy = Bildmitte in Anteilen.
function fahrt(out, src, ss, t, von, nach) {
  return schnitt(out, src, ss, t, fahrtFilter(von, nach, Math.round(t * FPS), 2560, 1440, FPS));
}

// Von Marke zu Marke, mit Deckel. Kein Bild länger als nötig.
function bis(src, von, nach, { vor = 0.25, nachlauf = 0.25, max = 5.0 } = {}) {
  const m = marks(src);
  return { ss: m[von] - vor, t: Math.min(max, m[nach] - m[von] + vor + nachlauf) };
}

fs.rmSync(CUT, { recursive: true, force: true });
fs.mkdirSync(CUT, { recursive: true });

const MITTE = { z: 1, cx: 0.5, cy: 0.5 };

// ── 01 Hook: sachte Zufahrt auf die Zeile ───────────────────────────────────
fahrt("01", "01-hook", 0.5, 2.8, MITTE, { z: 1.05, cx: 0.5, cy: 0.5 });

// ── 02 Jahresfahrplan: die Kamera sinkt mit dem wandernden Licht nach unten ──
// Spotlight und Kamerafahrt laufen in dieselbe Richtung — das zieht den Blick
// die Liste hinunter, ohne dass geschnitten werden muss.
{
  const s = bis("02-fahrplan", "cap_an", "spot_aus", { max: 5.2 });
  fahrt("02", "02-fahrplan", s.ss, s.t, { z: 1.0, cx: 0.5, cy: 0.46 }, { z: 1.12, cx: 0.52, cy: 0.62 });
}

// ── 03 Erststart: Licht auf „Als Nächstes", dann Scrollfahrt ────────────────
{
  const a = bis("03-erststart", "cap_an", "scroll_los", { max: 3.0 });
  fahrt("03a", "03-erststart", a.ss, a.t, { z: 1.0, cx: 0.5, cy: 0.45 }, { z: 1.1, cx: 0.5, cy: 0.42 });
  const b = bis("03-erststart", "scroll_los", "unten", { vor: 0.1, max: 2.2 });
  ruhig("03b", "03-erststart", b.ss, b.t);
}

// ── 04 Kommandopalette: Strg+K, tippen, springen ────────────────────────────
// Das Tippen bleibt ungeschnitten — es ist die Attraktion.
{
  const a = bis("04-palette", "cap_an", "strg_k", { max: 1.8 });
  ruhig("04a", "04-palette", a.ss, a.t);
  const b = bis("04-palette", "strg_k", "gesprungen", { vor: 0.2, nachlauf: 0.6, max: 5.0 });
  fahrt("04b", "04-palette", b.ss, b.t, { z: 1.0, cx: 0.5, cy: 0.5 }, { z: 1.08, cx: 0.5, cy: 0.42 });
}

// ── 05 Wirtschaftsplan: Licht auf die Schlüssel, dann hinunter zum Hausgeld ─
{
  const a = bis("05-wirtschaftsplan", "cap_an", "scroll_los", { max: 3.8 });
  fahrt("05a", "05-wirtschaftsplan", a.ss, a.t, { z: 1.0, cx: 0.5, cy: 0.5 }, { z: 1.12, cx: 0.55, cy: 0.45 });
  const b = bis("05-wirtschaftsplan", "scroll_los", "ende", { vor: 0.1, max: 3.4 });
  fahrt("05b", "05-wirtschaftsplan", b.ss, b.t, { z: 1.0, cx: 0.5, cy: 0.5 }, { z: 1.1, cx: 0.52, cy: 0.4 });
}

// ── 06 Hausgeld: Scrollfahrt in die Liste, Licht auf die Summe ──────────────
{
  const a = bis("06-hausgeld", "scroll_los", "liste", { vor: 0.1, max: 2.0 });
  ruhig("06a", "06-hausgeld", a.ss, a.t);
  const b = bis("06-hausgeld", "cap_an", "ende", { max: 3.6 });
  fahrt("06b", "06-hausgeld", b.ss, b.t, { z: 1.0, cx: 0.5, cy: 0.5 }, { z: 1.12, cx: 0.5, cy: 0.4 });
}

// ── 07 Versammlung: Tagesordnung, dann sortiert ein Klick sie um ────────────
{
  const a = bis("07-versammlung", "cap_an", "scroll_los", { max: 3.0 });
  fahrt("07a", "07-versammlung", a.ss, a.t, { z: 1.0, cx: 0.45, cy: 0.45 }, { z: 1.12, cx: 0.42, cy: 0.5 });
  const b = bis("07-versammlung", "reihenfolge", "ende", { vor: 0.7, max: 2.8 });
  fahrt("07b", "07-versammlung", b.ss, b.t, { z: 1.06, cx: 0.42, cy: 0.55 }, { z: 1.16, cx: 0.4, cy: 0.6 });
}

// ── 08 Rollenwechsel: dieselbe WEG, ein Miteigentümer, kürzeres Menü ────────
{
  const s = bis("08-rollen", "drin", "ende", { vor: 0.3, max: 3.6 });
  fahrt("08", "08-rollen", s.ss, s.t, { z: 1.0, cx: 0.5, cy: 0.5 }, { z: 1.12, cx: 0.32, cy: 0.5 });
}

// ── 09 KI-Assistent ─────────────────────────────────────────────────────────
{
  const m = marks("09-ki");
  ruhig("09a", "09-ki", m.zeiger_los - 0.25, m.offen - m.zeiger_los - 0.55);
  // Das Tippen: nah dran, damit man mitlesen kann.
  fahrt("09b", "09-ki", m.offen + 0.15, Math.min(3.0, m.getippt - m.offen - 0.3),
    { z: 1.28, cx: 0.78, cy: 0.5 }, { z: 1.34, cx: 0.78, cy: 0.55 });
  // Die Antwort: langsame Zufahrt auf die Quellenangaben.
  fahrt("09c", "09-ki", m.antwort - 0.5, 3.4,
    { z: 1.3, cx: 0.78, cy: 0.42 }, { z: 1.5, cx: 0.79, cy: 0.5 });
}

// ── 10 Endtafel ─────────────────────────────────────────────────────────────
ruhig("10", "10-cta", 0.45, 2.7);

// ── Zusammenfügen mit Kreuzblenden ──────────────────────────────────────────
// xfade verkettet paarweise; der Versatz ist die bisherige Gesamtlänge minus
// der Blendendauer, sonst schieben sich die Clips übereinander.
function join(name, namen) {
  const liste = namen.map((n) => teile.find((t) => t.name === n) || { name: n, d: dauer(path.join(CUT, `${n}.mp4`)) });
  const args = [];
  for (const t of liste) args.push("-i", path.join(CUT, `${t.name}.mp4`));

  let filter = "";
  let vor = "0:v";
  let gesamt = liste[0].d;
  for (let i = 1; i < liste.length; i++) {
    const offset = (gesamt - BLENDE).toFixed(3);
    const label = i === liste.length - 1 ? "v" : `v${i}`;
    filter += `[${vor}][${i}:v]xfade=transition=fade:duration=${BLENDE}:offset=${offset}[${label}];`;
    vor = label;
    gesamt = gesamt - BLENDE + liste[i].d;
  }
  filter = filter.replace(/;$/, "");

  ff([...args, "-filter_complex", filter, "-map", "[v]", "-c:v", "libx264", "-preset", "slow",
      "-crf", "21", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an",
      path.join(OUT, `${name}.mp4`)]);
  ff(["-i", path.join(OUT, `${name}.mp4`), "-c:v", "libvpx-vp9", "-crf", "34", "-b:v", "0",
      "-row-mt", "1", "-an", path.join(OUT, `${name}.webm`)]);
}

join("hero-full", teile.map((t) => t.name));

// Loop fürs Autoplay: die beiden Momente, in denen jemand tippt, plus Plakat.
join("hero-loop", ["01", "04b", "09b", "09c", "10"]);

ff(["-sseof", "-0.2", "-i", path.join(OUT, "hero-full.mp4"), "-vframes", "1", "-q:v", "3",
    path.join(OUT, "hero-poster.jpg")]);

// Mitte jeder Einstellung für die Sichtprüfung (Blenden eingerechnet).
let t = 0;
const mitten = [];
for (const [i, teil] of teile.entries()) {
  if (i > 0) t -= BLENDE;
  mitten.push(`${teil.name} ${(t + teil.d / 2).toFixed(2)}`);
  t += teil.d;
}
fs.writeFileSync(path.join(OUT, "mitten.txt"), mitten.join("\n") + "\n");

function dauer(p) {
  let txt = "";
  try { execFileSync(FF, ["-i", p], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); }
  catch (e) { txt = String(e.stderr || ""); }
  const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(txt);
  return m ? +m[2] * 60 + +m[3] : 0;
}

for (const f of ["hero-full.mp4", "hero-full.webm", "hero-loop.mp4", "hero-loop.webm"]) {
  const p = path.join(OUT, f);
  console.log(`${f.padEnd(18)} ${String(Math.round(fs.statSync(p).size / 1024)).padStart(6)} kB  ${dauer(p).toFixed(1)} s`);
}
