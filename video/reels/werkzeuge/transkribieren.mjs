/**
 * Transkribiert ein Video mit Wort-Zeitstempeln (whisper.cpp, deutsch).
 *
 *   node werkzeuge/transkribieren.mjs <video.mp4> [ausgabe.json]
 *
 * Beim ersten Lauf werden whisper.cpp und das Modell geladen und gebaut
 * (~4 Minuten, ~3 GB). Beides liegt außerhalb des Repos unter WHISPER_ORDNER.
 *
 * Das Ergebnis ist das Caption-Format von @remotion/captions: je Eintrag Text,
 * Start und Ende in Millisekunden. Fachbegriffe hört Whisper nicht immer richtig
 * (WEG, Hausgeld, Wirtschaftsplan, Beschluss-Sammlung, Erhaltungsrücklage,
 * wegportal24) — deshalb wird das Transkript vor dem Schnitt gegengelesen.
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { installWhisperCpp, downloadWhisperModel, transcribe, toCaptions } from "@remotion/install-whisper-cpp";

const require = createRequire(import.meta.url);
const ffmpeg = require("ffmpeg-static");
const hier = dirname(fileURLToPath(import.meta.url));

const WHISPER_ORDNER = process.env.WHISPER_ORDNER ?? join(hier, "..", ".whisper");
const WHISPER_VERSION = "1.7.6";
const MODELL = process.env.WHISPER_MODELL ?? "large-v3-turbo";

const [, , video, ausgabe] = process.argv;
if (!video) {
  console.error("Aufruf: node werkzeuge/transkribieren.mjs <video.mp4> [ausgabe.json]");
  process.exit(1);
}

// whisper.cpp erwartet 16-kHz-Mono-WAV.
const wav = video.replace(/\.[^.]+$/, "") + "-16k.wav";
execFileSync(ffmpeg, ["-y", "-i", video, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wav], {
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
const ziel = ausgabe ?? video.replace(/\.[^.]+$/, "") + "-transkript.json";
await writeFile(ziel, JSON.stringify(captions, null, 2));

const dauer = captions.at(-1)?.endMs ?? 0;
console.log(`${captions.length} Wörter über ${(dauer / 1000).toFixed(1)} s → ${ziel}`);
console.log(captions.map((c) => c.text).join(" ").slice(0, 400));
