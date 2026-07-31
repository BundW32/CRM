// Schnitt der Endfassung. Liest die Marken, die die Aufnahme geschrieben hat.
//
//   node video/compose.js
//
// Warum kein Bash mit festen Sekunden: Wie lange eine Seite lädt, schwankt um
// über eine Sekunde. Geschätzte Schnittzeiten treffen dann die Unterzeile
// mitten im Ausblenden — und bei einer Pipeline, die nach jedem Design-Update
// neu läuft, geht das jedes Mal von vorne los. Die Aufnahme schreibt mit, wann
// etwas passiert ist; hier wird nur noch gerechnet.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const FF = require("ffmpeg-static");
const ROOT = __dirname;
const RAW = path.join(ROOT, "out", "raw");
const CUT = path.join(ROOT, "out", "cut");
const OUT = path.join(ROOT, "out");

const W = 1280, H = 720, FPS = 30;
const teile = [];

function clip(name) {
  const dir = path.join(RAW, name);
  const f = fs.readdirSync(dir).filter((x) => x.endsWith(".webm"));
  if (f.length !== 1) throw new Error(`${dir}: ${f.length} Aufnahmen — erwartet genau eine`);
  return path.join(dir, f[0]);
}

function marks(name) {
  return JSON.parse(fs.readFileSync(path.join(RAW, name, "marks.json"), "utf8"));
}

function ff(args) {
  execFileSync(FF, ["-y", "-loglevel", "error", ...args], { stdio: ["ignore", "ignore", "pipe"] });
}

// `-ss` steht IMMER nach `-i`: bildgenau. Vor `-i` sucht ffmpeg nur zum nächsten
// Keyframe und verfehlt bei variabler Bildrate die Marke um Sekunden.
// `fps=30` steht IMMER als erstes Filterglied, sonst läuft zoompan aus dem Tritt.
function still(out, src, ss, t, crop) {
  if (t < 0.5) throw new Error(`${out}: ${t.toFixed(2)} s ist zu kurz zum Lesen`);
  const vf = ["fps=" + FPS, crop && `crop=${crop}`, `scale=${W}:${H}:flags=lanczos`, "format=yuv420p"]
    .filter(Boolean).join(",");
  ff(["-i", clip(src), "-ss", String(ss.toFixed(2)), "-t", String(t.toFixed(2)), "-vf", vf, "-an",
      path.join(CUT, out + ".mp4")]);
  teile.push(out);
  return out;
}

// Zufahrt mit ease-out-cubic, die nach `fahrt` Bildern ANKOMMT und dann steht.
// Sparsam einsetzen: Die Nähe entsteht durch den Schnitt von weit auf eng, und
// ein starker Zoom auf einen engen Ausschnitt frisst die Zeilenbeschriftungen.
function zoom(out, src, ss, t, crop, z, fahrt = 36) {
  const d = (z - 1).toFixed(3);
  const vf = [
    "fps=" + FPS, `crop=${crop}`, "scale=2560:1440",
    `zoompan=z='if(lt(on,${fahrt}),1+${d}*(1-pow(1-on/${fahrt},3)),${z})':d=1:` +
      `x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=2560x1440:fps=${FPS}`,
    `scale=${W}:${H}:flags=lanczos`, "format=yuv420p",
  ].join(",");
  ff(["-i", clip(src), "-ss", String(ss.toFixed(2)), "-t", String(t.toFixed(2)), "-vf", vf, "-an",
      path.join(CUT, out + ".mp4")]);
  teile.push(out);
  return out;
}

fs.rmSync(CUT, { recursive: true, force: true });
fs.mkdirSync(CUT, { recursive: true });

// ── 01 Hook ─────────────────────────────────────────────────────────────────
zoom("01", "01-hook", 0.5, 3.2, "2560:1440:0:0", 1.04, 96);

// Ab hier gilt eine Regel, die die erste Fassung noch nicht hatte:
//
//   Unterzeile und Aktion laufen in DERSELBEN Einstellung.
//
// Vorher stand erst das Bild mit der Zeile still, danach folgte die Bewegung —
// das ergab pro Szene mehrere Sekunden tote Zeit und war der Hauptgrund, warum
// alles außer der KI-Szene langweilte. Jetzt blendet die Zeile aus, während der
// Spotlight schon wandert oder die Seite bereits scrollt.
//
// `bis()` schneidet von einer Marke zur nächsten und deckelt die Länge: Keine
// Einstellung über gut sechs Sekunden, sonst schläft der Blick ein.
const MAX = 5.2;
function bis(out, src, von, nach, { vor = 0.3, nachlauf = 0.3, max = MAX, crop } = {}) {
  const m = marks(src);
  const ss = m[von] - vor;
  const t = Math.min(max, m[nach] - m[von] + vor + nachlauf);
  return still(out, src, ss, t, crop);
}

// ── 02 Jahresfahrplan: Zeile blendet aus, während der Spotlight losläuft ────
bis("02", "02-fahrplan", "cap_an", "spot_aus", { max: 5.0 });

// ── 03 Erststart: Spotlight auf „Als Nächstes", dann Scrollfahrt ───────────
bis("03", "03-erststart", "cap_an", "unten", { max: 4.8 });

// ── 04 Kommandopalette: Strg+K, tippen, springen ───────────────────────────
// Bekommt als einzige Szene zwei Einstellungen: Das Tippen ist die Attraktion
// und braucht seinen eigenen, ungeschnittenen Lauf.
bis("04a", "04-palette", "cap_an", "strg_k", { max: 2.8 });
bis("04b", "04-palette", "strg_k", "gesprungen", { vor: 0.25, nachlauf: 0.9, max: 5.4 });

// ── 05 Wirtschaftsplan: zwei Schlüssel im Licht, dann zum Hausgeld ─────────
bis("05a", "05-wirtschaftsplan", "cap_an", "scroll_los", { max: 4.6 });
bis("05b", "05-wirtschaftsplan", "scroll_los", "ende", { vor: 0.15, max: 3.8 });

// ── 06 Hausgeld: Scrollfahrt in die Liste, Licht auf die Summe ─────────────
bis("06a", "06-hausgeld", "scroll_los", "liste", { vor: 0.1, max: 2.6 });
bis("06b", "06-hausgeld", "cap_an", "ende", { max: 4.4 });

// ── 07 Versammlung: Tagesordnung, dann sortiert ein Klick sie um ───────────
bis("07a", "07-versammlung", "cap_an", "scroll_los", { max: 3.8 });
bis("07b", "07-versammlung", "reihenfolge", "ende", { vor: 0.8, max: 3.0 });

// ── 08 KI-Assistent ─────────────────────────────────────────────────────────
{
  const m = marks("08-ki");
  still("08a", "08-ki", m.zeiger_los - 0.25, m.offen - m.zeiger_los - 0.55);
  still("08b", "08-ki", m.offen + 0.15, Math.min(3.4, m.getippt - m.offen - 0.2), "1990:1120:570:120");
  zoom("08c", "08-ki", m.antwort - 0.55, 4.0, "1200:675:1360:210", 1.10);
}

// ── 09 Endtafel ─────────────────────────────────────────────────────────────
still("09", "09-cta", 0.45, 3.0);

// ── Zusammenfügen ───────────────────────────────────────────────────────────
// Harte Schnitte. Durchgehendes Überblenden ist der Diashow-Look.
function join(name, parts) {
  const list = path.join(CUT, `list-${name}.txt`);
  fs.writeFileSync(list, parts.map((p) => `file '${p}.mp4'`).join("\n") + "\n");
  ff(["-f", "concat", "-safe", "0", "-i", list, "-c:v", "libx264", "-preset", "slow",
      "-crf", "21", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an",
      path.join(OUT, `${name}.mp4`)]);
  ff(["-i", path.join(OUT, `${name}.mp4`), "-c:v", "libvpx-vp9", "-crf", "34", "-b:v", "0",
      "-row-mt", "1", "-an", path.join(OUT, `${name}.webm`)]);
}

join("hero-full", teile);

// Loop fürs Autoplay: nur die zwei Momente, in denen jemand tippt, plus Plakat.
// Kein Erklärbogen — den erzählt die Landingpage bereits selbst.
join("hero-loop", ["01", "04b", "08b", "08c", "09"]);

ff(["-sseof", "-0.2", "-i", path.join(OUT, "hero-full.mp4"), "-vframes", "1", "-q:v", "3",
    path.join(OUT, "hero-poster.jpg")]);

// Mitte jeder Einstellung ausgeben — Grundlage für die Sichtprüfung.
let t = 0;
const mitten = [];
for (const c of teile) {
  const d = dauer(path.join(CUT, `${c}.mp4`));
  mitten.push(`${c} ${(t + d / 2).toFixed(2)}`);
  t += d;
}
fs.writeFileSync(path.join(OUT, "mitten.txt"), mitten.join("\n") + "\n");

function dauer(p) {
  let txt = "";
  try {
    execFileSync(FF, ["-i", p], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    txt = String(e.stderr || "");
  }
  const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(txt);
  return m ? +m[2] * 60 + +m[3] : 0;
}

for (const f of ["hero-full.mp4", "hero-full.webm", "hero-loop.mp4", "hero-loop.webm"]) {
  const p = path.join(OUT, f);
  console.log(`${f.padEnd(18)} ${String(Math.round(fs.statSync(p).size / 1024)).padStart(6)} kB  ` +
    `${dauer(p).toFixed(1)} s`);
}
