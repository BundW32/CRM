/**
 * Findet die Stellen, an denen im Rohmaterial geschnitten werden darf.
 *
 *   node --experimental-strip-types werkzeuge/pausen.ts <video.mp4> <transkript.json>
 *
 * Zwei Quellen, weil keine allein reicht:
 *
 *  * **ffmpeg silencedetect** findet echte Stille — auch dort, wo Whisper
 *    nichts gehört hat. Ein „äh" verschluckt es oft ganz, im Ton ist es da und
 *    kostet Tempo.
 *  * **Satzzeichen-Token im Transkript** finden Pausen, die über der
 *    Stille-Schwelle bleiben (Atmen, Schmatzen), denn Whisper hängt die Zeit
 *    einer Pause an das Komma davor.
 *
 * Zwei Dinge, die im ersten echten Reel schiefgingen und hier behoben sind:
 *
 * 1. **Die Schwelle wird gemessen, nicht gesetzt.** Mit fest verdrahteten
 *    −34 dB blieben Sprechpausen stehen: Ansteckmikro und Raumton liegen
 *    lauter, die Pause unterschreitet die Schwelle nie. Jetzt wird eine Leiter
 *    von Schwellen durchprobiert und die genommen, die einen plausiblen Anteil
 *    Stille findet.
 * 2. **Kein Schnitt landet in einem Wort.** Gemessene Stille ist per Definition
 *    kein Sprechen und wird roh übernommen; die geratenen Pausen aus dem
 *    Transkript werden dagegen gegen die Sprech-Bereiche verrechnet
 *    (`schnittstellen`). Im ersten Reel fehlte mitten im Satz das Wort
 *    „gehört" — geschnitten hatte es eine Transkript-Heuristik, die lange
 *    Wort-Token hinten beschnitt. Die ist raus.
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { schnittstellen, pausenAusTranskript } from "../src/zeitachse.ts";

const require = createRequire(import.meta.url);
const ffmpeg = require("ffmpeg-static") as string;
const ffprobe = (require("ffprobe-static") as { path: string }).path;

const argumente = process.argv.slice(2);
const [video, transkript] = argumente.filter((a) => !a.startsWith("--"));
const zahl = (name: string, standard: number) => {
  const i = argumente.indexOf(`--${name}`);
  return i === -1 ? standard : Number(argumente[i + 1]);
};

if (!video) {
  console.error("Aufruf: node --experimental-strip-types werkzeuge/pausen.ts <video.mp4> [transkript.json] [--mindest 0.25]");
  process.exit(1);
}

const MINDEST_S = zahl("mindest", 0.25);
/** Anteil Stille, der bei normal gesprochenem Material zu erwarten ist. */
const ERWARTET = { min: 0.05, max: 0.32 };

/** Echte Verlegenheitslaute. „also", „ja", „halt" gehören oft zum Satz und stehen NICHT hier. */
const FUELLLAUTE = new Set(["äh", "ähm", "ähh", "öh", "öhm", "hm", "hmm", "mh", "mhm"]);

const shell = (befehl: string) =>
  execFileSync("/bin/sh", ["-c", befehl], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

const dauerSekunden = () =>
  Number(shell(`${JSON.stringify(ffprobe)} -v error -show_entries format=duration -of csv=p=0 ${JSON.stringify(video)}`).trim());

const stillenBei = (schwelleDb: number) => {
  const ausgabe = shell(
    `${JSON.stringify(ffmpeg)} -hide_banner -i ${JSON.stringify(video)} -af silencedetect=noise=${schwelleDb}dB:d=${MINDEST_S} -f null - 2>&1`,
  );

  const gefunden: { von: number; bis: number; grund: string }[] = [];
  let start: number | null = null;
  for (const zeile of ausgabe.split("\n")) {
    const an = zeile.match(/silence_start: (-?[\d.]+)/);
    const aus = zeile.match(/silence_end: ([\d.]+)/);
    if (an) start = Math.max(0, Number(an[1]));
    if (aus && start !== null) {
      gefunden.push({ von: start, bis: Number(aus[1]), grund: "Stille" });
      start = null;
    }
  }
  return gefunden;
};

/**
 * Probiert Schwellen von leise nach laut und nimmt die erste, die einen
 * plausiblen Anteil Stille findet. Bleibt alles darunter, gewinnt die Schwelle
 * mit der meisten gefundenen Stille — lieber etwas zu viel vorschlagen, denn
 * entschieden wird ohnehin im Schnittplan.
 */
const schwelleFinden = (gesamt: number) => {
  const leiter = [-45, -42, -39, -36, -33, -30, -27, -24];
  const versuche = leiter.map((db) => {
    const stillen = stillenBei(db);
    const anteil = stillen.reduce((s, a) => s + (a.bis - a.von), 0) / gesamt;
    return { db, stillen, anteil };
  });

  for (const v of versuche) {
    if (v.anteil >= ERWARTET.min && v.anteil <= ERWARTET.max) return v;
  }
  return versuche.reduce((a, b) => (b.anteil > a.anteil && b.anteil < 0.6 ? b : a));
};

const gesamt = dauerSekunden();
const gewaehlt = schwelleFinden(gesamt);
console.log(`Schwelle ${gewaehlt.db} dB gewählt — ${gewaehlt.stillen.length} Stillen, ${(gewaehlt.anteil * 100).toFixed(1)} % der Länge\n`);

const captions: { text: string; startMs: number; endMs: number }[] = transkript
  ? JSON.parse(readFileSync(transkript, "utf8"))
  : [];

/**
 * Gemessene Stille ist per Definition kein Sprechen — sie darf roh übernommen
 * werden, die Luft am Schnitt setzt `segmenteAusPausen`.
 *
 * Die Pausen aus dem Transkript sind dagegen geraten: Whisper hängt die Zeit
 * einer Pause an das Satzzeichen davor, und dieses Fenster kann in das Wort
 * hineinreichen. Nur sie werden deshalb gegen die Sprech-Bereiche verrechnet.
 * Genau hier verschwand im ersten echten Reel das Wort „gehört".
 */
const ausTranskript = captions.length
  ? schnittstellen({
      stillen: pausenAusTranskript(captions, MINDEST_S * 1000),
      captions,
      mindestMs: MINDEST_S * 1000,
    })
  : [];
const sicher = gewaehlt.stillen;

const zusammenlegen = (abschnitte: { von: number; bis: number; grund: string }[]) => {
  const sortiert = [...abschnitte].sort((a, b) => a.von - b.von);
  const raus: { von: number; bis: number; grund: string }[] = [];
  for (const a of sortiert) {
    const letzter = raus[raus.length - 1];
    if (letzter && a.von <= letzter.bis + 0.05) {
      letzter.bis = Math.max(letzter.bis, a.bis);
      if (!letzter.grund.includes(a.grund)) letzter.grund += ` + ${a.grund}`;
    } else {
      raus.push({ ...a });
    }
  }
  return raus;
};

const schnitte = zusammenlegen([...sicher, ...ausTranskript]);
const weg = schnitte.reduce((s, a) => s + (a.bis - a.von), 0);

console.log(`Gesamtlänge: ${gesamt.toFixed(2)} s`);
console.log(`${schnitte.length} Schnittstellen, zusammen ${weg.toFixed(2)} s`);
console.log(`Rest: ${(gesamt - weg).toFixed(2)} s\n`);
for (const a of schnitte) {
  console.log(`  ${a.von.toFixed(2)} – ${a.bis.toFixed(2)}  (${(a.bis - a.von).toFixed(2)} s)  ${a.grund}`);
}

/**
 * Füllaute werden nur VORGESCHLAGEN, nie automatisch geschnitten. Ein Wort aus
 * der Mitte eines Satzes zu nehmen, klingt sofort nach Fehler — das gehört in
 * den Schnittplan und vor Alex' Augen, nicht in eine Automatik.
 */
const fuellvorschlaege = captions.filter((c) =>
  FUELLLAUTE.has(c.text.trim().toLowerCase().replace(/[.,!?]/g, "")),
);
if (fuellvorschlaege.length) {
  console.log("\nFülllaute (Vorschlag, nicht automatisch geschnitten):");
  for (const f of fuellvorschlaege) {
    console.log(`  ${(f.startMs / 1000).toFixed(2)} – ${(f.endMs / 1000).toFixed(2)}  „${f.text.trim()}"`);
  }
}

const ziel = video.replace(/\.[^.]+$/, "") + "-pausen.json";
writeFileSync(
  ziel,
  JSON.stringify({ gesamt, schwelleDb: gewaehlt.db, weg, schnitte, fuellvorschlaege }, null, 2),
);
console.log(`\n→ ${ziel}`);
