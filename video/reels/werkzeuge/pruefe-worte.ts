/**
 * Vergleicht das fertige Reel Wort für Wort mit dem Rohmaterial.
 *
 *   node --experimental-strip-types werkzeuge/pruefe-worte.ts \
 *     out/reel.mp4 public/roh/<datei>-1080x1920-transkript.json
 *
 * Der Anlass: Alex hat zweimal gemeldet, dass Wörter fehlen und es Aussetzer
 * gibt. Beides lässt sich am Schnittplan nicht sehen und beim Ansehen leicht
 * überhören — man müsste jedes Wort mitlesen.
 *
 * Die Prüfung nutzt eine einfache Regel: **Geschnitten wird nur Stille, nie
 * ein Wort.** Daraus folgt, dass jedes Wort des Rohmaterials auch im fertigen
 * Reel vorkommen muss, in derselben Reihenfolge. Deshalb wird das fertige Reel
 * noch einmal transkribiert und mit dem Roh-Transkript verglichen. Was fehlt,
 * ist ein Befund.
 *
 * Zwei Einschränkungen, die man kennen muss:
 *
 *  * Wurde ein ganzer Take oder Satz bewusst gestrichen, meldet die Prüfung ihn
 *    als fehlend. Solche Stellen gehören mit `--gestrichen 12.5-18.0` (Sekunden
 *    im ROHMATERIAL, mehrfach möglich) ausgenommen — dann steht schwarz auf
 *    weiß, was absichtlich weg ist und was nicht.
 *  * Whisper hört nicht zweimal exakt gleich. Der Vergleich ist deshalb
 *    unempfindlich gegen Groß-/Kleinschreibung, Satzzeichen und leichte
 *    Schreibvarianten; ein Wort gilt als vorhanden, wenn es hinreichend ähnlich
 *    ist.
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { worteAusTokens } from "../src/worte.ts";

const require = createRequire(import.meta.url);
const ffmpeg = require("ffmpeg-static") as string;
const hier = dirname(fileURLToPath(import.meta.url));

const argumente = process.argv.slice(2);
const [reel, rohTranskript] = argumente.filter((a) => !a.startsWith("--"));

const gestrichen: { von: number; bis: number }[] = [];
argumente.forEach((a, i) => {
  if (a !== "--gestrichen") return;
  const [von, bis] = (argumente[i + 1] ?? "").split("-").map(Number);
  if (Number.isFinite(von) && Number.isFinite(bis)) gestrichen.push({ von, bis });
});

if (!reel || !rohTranskript) {
  console.error(
    "Aufruf: node --experimental-strip-types werkzeuge/pruefe-worte.ts <reel.mp4> <roh-transkript.json> [--gestrichen 12.5-18.0]",
  );
  process.exit(1);
}

const WHISPER_ORDNER = process.env.WHISPER_ORDNER ?? join(hier, "..", ".whisper");
const WHISPER_VERSION = "1.7.6";
const MODELL = (process.env.WHISPER_MODELL ?? "large-v3-turbo") as "large-v3-turbo";

type Token = { text: string; startMs: number; endMs: number };

const schluessel = (text: string) =>
  text
    .toLowerCase()
    .replace(/[.,!?;:…»«"'\-–—]/g, "")
    .replace(/ß/g, "ss")
    .trim();

/** Wortabstand nach Levenshtein — fängt „Beschlusssammlung" gegen „Beschluss-Sammlung". */
const aehnlich = (a: string, b: string) => {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 3) return false;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return d[a.length][b.length] <= Math.max(1, Math.floor(Math.max(a.length, b.length) / 5));
};

const transkribieren = async (datei: string): Promise<Token[]> => {
  const { installWhisperCpp, downloadWhisperModel, transcribe, toCaptions } = await import(
    "@remotion/install-whisper-cpp"
  );
  const wav = datei.replace(/\.[^.]+$/, "") + "-pruef16k.wav";
  execFileSync(ffmpeg, ["-y", "-i", datei, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wav], {
    stdio: ["ignore", "ignore", "inherit"],
  });
  await installWhisperCpp({ to: WHISPER_ORDNER, version: WHISPER_VERSION });
  await downloadWhisperModel({ model: MODELL, folder: WHISPER_ORDNER });
  const ergebnis = await transcribe({
    inputPath: wav,
    whisperPath: WHISPER_ORDNER,
    whisperCppVersion: WHISPER_VERSION,
    model: MODELL,
    language: "de",
    tokenLevelTimestamps: true,
    printOutput: false,
  });
  const { captions } = toCaptions({ whisperCppOutput: ergebnis });
  return captions.map((c) => ({ text: c.text, startMs: c.startMs, endMs: c.endMs }));
};

const zuWorten = (tokens: Token[]) =>
  worteAusTokens(tokens.map((t) => ({ text: t.text, fromMs: t.startMs, toMs: t.endMs })))
    .map((w) => ({ text: w.text, vonMs: w.vonMs, bisMs: w.bisMs, schluessel: schluessel(w.text) }))
    .filter((w) => w.schluessel.length > 0);

const roh = zuWorten(JSON.parse(readFileSync(rohTranskript, "utf8")) as Token[]).filter(
  (w) => !gestrichen.some((g) => w.vonMs / 1000 >= g.von && w.bisMs / 1000 <= g.bis),
);

console.log(`Rohmaterial: ${roh.length} Wörter (${gestrichen.length} gestrichene Bereiche ausgenommen)`);
console.log("Transkribiere das fertige Reel — das dauert etwa so lang wie die Rohfassung ...\n");

const fertig = zuWorten(await transkribieren(reel));
console.log(`Fertiges Reel: ${fertig.length} Wörter\n`);

/**
 * Längste gemeinsame Folge: so wird jedes Roh-Wort entweder einem Wort im Reel
 * zugeordnet oder als fehlend erkannt — auch wenn mittendrin etwas fehlt.
 */
const tabelle: number[][] = Array.from({ length: roh.length + 1 }, () => new Array(fertig.length + 1).fill(0));
for (let i = roh.length - 1; i >= 0; i -= 1) {
  for (let j = fertig.length - 1; j >= 0; j -= 1) {
    tabelle[i][j] = aehnlich(roh[i].schluessel, fertig[j].schluessel)
      ? tabelle[i + 1][j + 1] + 1
      : Math.max(tabelle[i + 1][j], tabelle[i][j + 1]);
  }
}

const fehlend: (typeof roh)[number][] = [];
let i = 0;
let j = 0;
while (i < roh.length && j < fertig.length) {
  if (aehnlich(roh[i].schluessel, fertig[j].schluessel)) {
    i += 1;
    j += 1;
  } else if (tabelle[i + 1][j] >= tabelle[i][j + 1]) {
    fehlend.push(roh[i]);
    i += 1;
  } else {
    j += 1;
  }
}
while (i < roh.length) {
  fehlend.push(roh[i]);
  i += 1;
}

if (fehlend.length === 0) {
  console.log("Kein Wort fehlt. Jedes Wort aus dem Rohmaterial ist im Reel wiederzufinden.");
  process.exit(0);
}

console.log(`${fehlend.length} fehlende Wörter — jeweils mit der Stelle im ROHMATERIAL:\n`);

// Zusammenhängende Lücken bündeln: „drei Wörter am Stück" ist ein anderer
// Fehler als „drei einzelne über das ganze Video verteilt".
const luecken: { von: number; bis: number; worte: string[] }[] = [];
for (const w of fehlend) {
  const letzte = luecken[luecken.length - 1];
  if (letzte && w.vonMs / 1000 - letzte.bis < 0.6) {
    letzte.bis = w.bisMs / 1000;
    letzte.worte.push(w.text);
  } else {
    luecken.push({ von: w.vonMs / 1000, bis: w.bisMs / 1000, worte: [w.text] });
  }
}

for (const l of luecken) {
  console.log(`  ${l.von.toFixed(2)} – ${l.bis.toFixed(2)} s   „${l.worte.join(" ")}"`);
}

console.log(
  `\n${luecken.length} Stellen. Entweder war der Schnitt dort zu scharf, oder die Stelle wurde bewusst gestrichen — dann mit --gestrichen ausnehmen.`,
);
process.exit(1);
