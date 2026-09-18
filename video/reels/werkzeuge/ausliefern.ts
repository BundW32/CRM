/**
 * Macht aus dem Render die Datei, die gepostet wird.
 *
 *   node --experimental-strip-types werkzeuge/ausliefern.ts out/roh.mp4 "<Drive>/.../wegportal24_thema_v1.mp4"
 *
 * Der Render aus Remotion ist die Meisterfassung: hohe Qualität, aber nicht auf
 * Wiedergabe am Handy getrimmt. Alex hat die Reels in der Drive-App angesehen
 * und Ruckler gemeldet. An seiner Datei gemessen waren zwei Dinge auffällig:
 *
 *  * **Keyframes nur alle 5 Sekunden.** Wer streamt oder spult, muss dann bis
 *    zum letzten Keyframe zurück dekodieren — das ruckelt genau beim Anspringen.
 *    Hier stehen sie alle 2 Sekunden.
 *  * **Vollbereichs-Farbe (`yuvj420p`) ohne Farbraum-Kennzeichnung.** Handys und
 *    Umkodierer legen das unterschiedlich aus; das Ergebnis sind flaue oder zu
 *    harte Farben. Hier: `yuv420p` mit bt709, ausdrücklich benannt.
 *
 * Dazu die Lautheit auf −14 LUFS in zwei Durchläufen (erst messen, dann
 * korrigieren) und `faststart`, damit die Wiedergabe beginnt, bevor die Datei
 * vollständig geladen ist.
 *
 * Ob die Ruckler damit weg sind, entscheidet trotzdem der Blick aufs Handy:
 * Die Drive-App streamt eine eigene, umkodierte Fassung. Zum Unterscheiden die
 * Datei herunterladen und in der Fotos-App abspielen — läuft sie dort rund, lag
 * es an Drive.
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ffmpeg = require("ffmpeg-static") as string;
const ffprobe = (require("ffprobe-static") as { path: string }).path;

const ZIEL_LAUTHEIT = { I: -14, TP: -1.5, LRA: 11 };
/** Keyframe-Abstand in Bildern: 2 Sekunden bei 30 fps. */
const KEYFRAME_ABSTAND = 60;

const [, , quelle, ziel] = process.argv;
if (!quelle || !ziel) {
  console.error("Aufruf: node --experimental-strip-types werkzeuge/ausliefern.ts <render.mp4> <ziel.mp4>");
  process.exit(1);
}

const shell = (befehl: string) =>
  execFileSync("/bin/sh", ["-c", befehl], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

/** ffmpeg schreibt die Messung auf stderr — deshalb zusammenführen und den JSON-Block herausschneiden. */
const lautheitMessen = () => {
  const ergebnis = shell(
    `${JSON.stringify(ffmpeg)} -hide_banner -i ${JSON.stringify(quelle)} -af loudnorm=I=${ZIEL_LAUTHEIT.I}:TP=${ZIEL_LAUTHEIT.TP}:LRA=${ZIEL_LAUTHEIT.LRA}:print_format=json -f null - 2>&1`,
  );
  return JSON.parse(ergebnis.slice(ergebnis.lastIndexOf("{"), ergebnis.lastIndexOf("}") + 1));
};

const m = lautheitMessen();
console.log(`gemessen: ${m.input_i} LUFS, True Peak ${m.input_tp} dBTP`);

execFileSync(
  ffmpeg,
  [
    "-y",
    "-i", quelle,
    "-c:v", "libx264",
    "-preset", "slow",
    "-crf", "20",
    // Deckel, damit die Datei auf dem Handy nicht am Datendurchsatz hängt.
    "-maxrate", "12M",
    "-bufsize", "24M",
    "-profile:v", "high",
    "-level", "4.0",
    "-pix_fmt", "yuv420p",
    "-color_primaries", "bt709",
    "-color_trc", "bt709",
    "-colorspace", "bt709",
    // Feste Keyframes alle zwei Sekunden: dagegen hilft keine Bitrate.
    "-g", String(KEYFRAME_ABSTAND),
    "-keyint_min", String(KEYFRAME_ABSTAND),
    "-sc_threshold", "0",
    "-af",
    "loudnorm=" + [
      `I=${ZIEL_LAUTHEIT.I}`,
      `TP=${ZIEL_LAUTHEIT.TP}`,
      `LRA=${ZIEL_LAUTHEIT.LRA}`,
      `measured_I=${m.input_i}`,
      `measured_TP=${m.input_tp}`,
      `measured_LRA=${m.input_lra}`,
      `measured_thresh=${m.input_thresh}`,
      `offset=${m.target_offset}`,
      "linear=true",
    ].join(":"),
    "-c:a", "aac",
    "-b:a", "192k",
    "-ar", "48000",
    "-movflags", "+faststart",
    ziel,
  ],
  { stdio: ["ignore", "ignore", "inherit"] },
);

// Gegenprüfen statt behaupten.
const daten = JSON.parse(
  shell(
    `${JSON.stringify(ffprobe)} -v error -select_streams v:0 -show_entries stream=pix_fmt,profile,color_space -show_entries format=duration,bit_rate -of json ${JSON.stringify(ziel)}`,
  ),
);
const keyframes = shell(
  `${JSON.stringify(ffprobe)} -v error -select_streams v:0 -show_entries frame=key_frame -of csv=p=0 ${JSON.stringify(ziel)}`,
)
  .split("\n")
  .map((z, index) => ({ index, key: z.trim() === "1" }))
  .filter((f) => f.key)
  .map((f) => f.index);

const abstaende = keyframes.slice(1).map((k, i) => k - keyframes[i]);
const nachher = JSON.parse(
  (() => {
    const e = shell(
      `${JSON.stringify(ffmpeg)} -hide_banner -i ${JSON.stringify(ziel)} -af loudnorm=print_format=json -f null - 2>&1`,
    );
    return e.slice(e.lastIndexOf("{"), e.lastIndexOf("}") + 1);
  })(),
);

console.log(`\nfertig: ${ziel}`);
console.log(`  Bild: ${daten.streams[0].pix_fmt}, Profil ${daten.streams[0].profile}, Farbraum ${daten.streams[0].color_space}`);
console.log(`  Keyframes: ${keyframes.length} Stück, Abstand ${abstaende.length ? Math.max(...abstaende) : "—"} Bilder (Ziel: ${KEYFRAME_ABSTAND})`);
console.log(`  Länge ${Number(daten.format.duration).toFixed(2)} s, ${(Number(daten.format.bit_rate) / 1e6).toFixed(1)} Mbit/s`);
console.log(`  Lautheit ${nachher.input_i} LUFS, True Peak ${nachher.input_tp} dBTP`);
