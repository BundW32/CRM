// Schnitt der Endfassung. Liest die Marken, die die Aufnahme geschrieben hat.
//
//   node video/compose.js
//
// Warum kein Bash mit festen Sekunden: Wie lange eine Seite lädt, schwankt um
// über eine Sekunde. Geschätzte Schnittzeiten treffen dann die Unterzeile
// mitten im Ausblenden — und bei einer Pipeline, die nach jedem Design-Update
// neu läuft, geht das jedes Mal von vorne los. Die Aufnahme schreibt deshalb
// mit, wann etwas passiert ist; hier wird nur noch gerechnet.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const FF = require("ffmpeg-static");
const ROOT = __dirname;
const RAW = path.join(ROOT, "out", "raw");
const CUT = path.join(ROOT, "out", "cut");
const OUT = path.join(ROOT, "out");

const W = 1280, H = 720, FPS = 30;

function clip(name) {
  const dir = path.join(RAW, name);
  const f = fs.readdirSync(dir).find((x) => x.endsWith(".webm"));
  if (!f) throw new Error(`keine Aufnahme in ${dir}`);
  return path.join(dir, f);
}

function marks(name) {
  const p = path.join(RAW, name, "marks.json");
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : {};
}

function ff(args) {
  execFileSync(FF, ["-y", "-loglevel", "error", ...args], { stdio: ["ignore", "ignore", "pipe"] });
}

// `-ss` steht IMMER nach `-i`: bildgenau. Vor `-i` sucht ffmpeg nur zum nächsten
// Keyframe und verfehlt bei variabler Bildrate die Marke um Sekunden.
// `fps=30` steht IMMER als erstes Filterglied, sonst läuft zoompan aus dem Tritt.
function still(out, src, ss, t, crop) {
  const vf = ["fps=" + FPS, crop && `crop=${crop}`, `scale=${W}:${H}:flags=lanczos`, "format=yuv420p"]
    .filter(Boolean).join(",");
  ff(["-i", clip(src), "-ss", String(ss), "-t", String(t), "-vf", vf, "-an", path.join(CUT, out + ".mp4")]);
}

// Zufahrt mit ease-out-cubic, die nach `fahrt` Bildern ANKOMMT und dann steht.
// Ein Zoom, der bis zum Schnitt weiterläuft, ist das Erkennungszeichen des
// Amateurschnitts — und unlesbar, weil das Auge nichts Bewegtes liest.
function zoom(out, src, ss, t, crop, z, fahrt = 36) {
  const d = (z - 1).toFixed(3);
  const vf = [
    "fps=" + FPS,
    `crop=${crop}`,
    "scale=2560:1440",
    `zoompan=z='if(lt(on,${fahrt}),1+${d}*(1-pow(1-on/${fahrt},3)),${z})':d=1:` +
      `x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=2560x1440:fps=${FPS}`,
    `scale=${W}:${H}:flags=lanczos`,
    "format=yuv420p",
  ].join(",");
  ff(["-i", clip(src), "-ss", String(ss), "-t", String(t), "-vf", vf, "-an", path.join(CUT, out + ".mp4")]);
}

fs.rmSync(CUT, { recursive: true, force: true });
fs.mkdirSync(CUT, { recursive: true });

// ── 01 Hook-Tafel ───────────────────────────────────────────────────────────
zoom("01", "01-hook", 0.5, 3.3, "2560:1440:0:0", 1.04, 99);

// ── Bausteine einer Produktszene ────────────────────────────────────────────
// Jede Szene liefert drei Einstellungen: weit zum Ankommen, die Unterzeile über
// dem ganzen Bild (sie muss vollständig lesbar sein — deshalb kein Ausschnitt),
// und danach die Zufahrt auf die Stelle, um die es geht.
function produktszene(n, src, crop, z) {
  const m = marks(src);
  still(`${n}a`, src, Math.max(0.4, m.ruhig - 1.4), 1.3);
  still(`${n}b`, src, m.cap_an + 0.3, m.cap_aus - m.cap_an - 0.55);
  zoom(`${n}c`, src, m.cap_aus + 0.1, m.ruhe - m.cap_aus - 0.15, crop, z);
  return [`${n}a`, `${n}b`, `${n}c`];
}

// Ausschnitte in Koordinaten der 2560×1440-Aufnahme.
//
// Zwei Regeln, beide aus Fehlversuchen:
//  * Die linke Kante liegt bei x≈560 — dort endet die Seitenleiste und beginnt
//    der Inhalt. Weiter rechts angesetzt, schneidet der Ausschnitt die
//    Zeilenbeschriftungen an („…, EG links"), und das sieht kaputt aus,
//    nicht nah dran.
//  * Der Zoom bleibt bei 1.06. Die Nähe entsteht durch den SCHNITT von weit
//    auf eng, nicht durch die Fahrt; die Fahrt gibt dem Bild nur Leben.
//    Ein stärkerer Zoom auf einen schon engen Ausschnitt frisst genau die
//    Beschriftungen weg, die den Inhalt erklären.
const Z = 1.06;
const s02 = produktszene("02", "02-fahrplan", "1960:1103:520:430", Z);          // überfällige Zeilen
const s03 = produktszene("03", "03-erststart", "2000:1125:520:190", Z);         // „Als Nächstes"
const s04 = produktszene("04", "04-wirtschaftsplan", "2000:1125:520:270", Z);   // Umlageschlüssel
const s05 = produktszene("05", "05-hausgeld", "2000:1125:520:40", Z);           // Saldo je Einheit
const s06 = produktszene("06", "06-versammlung", "1900:1069:520:380", Z);       // TOP 2 mit § 28 WEG

// Wirtschaftsplan: nach dem Scrollen zusätzlich das Hausgeld je Einheit.
{
  const m = marks("04-wirtschaftsplan");
  still("04d", "04-wirtschaftsplan", m.gescrollt + 0.25, 2.1);
}

// ── 07 KI-Assistent ─────────────────────────────────────────────────────────
{
  const m = marks("07-ki");
  still("07a", "07-ki", m.zeiger_los - 0.25, m.offen - m.zeiger_los - 0.55);        // Zeiger fährt, klickt
  still("07b", "07-ki", m.offen + 0.15, Math.min(3.4, m.getippt - m.offen - 0.2),   // Frage wird getippt
    "1990:1120:570:120");
  zoom("07c", "07-ki", m.antwort - 0.55, 4.0, "1200:675:1360:210", 1.10);           // Antwort mit Quellen
}

// ── 08 Endtafel ─────────────────────────────────────────────────────────────
still("08", "08-cta", 0.45, 3.1);

// ── Zusammenfügen ───────────────────────────────────────────────────────────
// Harte Schnitte. Durchgehendes Überblenden zwischen allen Szenen ist der
// Diashow-Look, den das ganze Video vermeidet.
function join(name, parts) {
  const list = path.join(CUT, `list-${name}.txt`);
  fs.writeFileSync(list, parts.map((p) => `file '${p}.mp4'`).join("\n") + "\n");
  ff(["-f", "concat", "-safe", "0", "-i", list, "-c:v", "libx264", "-preset", "slow",
      "-crf", "21", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an",
      path.join(OUT, `${name}.mp4`)]);
  ff(["-i", path.join(OUT, `${name}.mp4`), "-c:v", "libvpx-vp9", "-crf", "34", "-b:v", "0",
      "-row-mt", "1", "-an", path.join(OUT, `${name}.webm`)]);
}

join("hero-full", ["01", ...s02, ...s03, ...s04, "04d", ...s05, ...s06, "07a", "07b", "07c", "08"]);

// Loop fürs Autoplay: nur Problem, ein Beleg, der KI-Moment, Plakat.
// Kein Erklärbogen — den erzählt die Seite bereits selbst.
join("hero-loop", ["01", "02b", "04c", "07c", "08"]);

// Plakat = letzter Frame: genau das Bild, das bei pausiertem Video steht.
ff(["-sseof", "-0.2", "-i", path.join(OUT, "hero-full.mp4"), "-vframes", "1", "-q:v", "3",
    path.join(OUT, "hero-poster.jpg")]);

for (const f of ["hero-full.mp4", "hero-full.webm", "hero-loop.mp4", "hero-loop.webm"]) {
  const p = path.join(OUT, f);
  // ffmpeg schreibt die Dateiinfo auf stderr und endet mit Fehlercode, wenn
  // keine Ausgabedatei angegeben ist — deshalb hier bewusst abgefangen.
  let txt = "";
  try {
    execFileSync(FF, ["-i", p], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    txt = String(e.stderr || "");
  }
  const dur = /Duration: ([0-9:.]+)/.exec(txt);
  const kb = Math.round(fs.statSync(p).size / 1024);
  console.log(`${f.padEnd(20)} ${String(kb).padStart(6)} kB  ${dur ? dur[1] : "?"}`);
}
