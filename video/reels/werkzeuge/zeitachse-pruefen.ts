/**
 * Prüft die Zeitachse — die Stelle, an der ein falsches Vorzeichen das ganze
 * Reel aus dem Takt bringt, ohne dass man es am Einzelbild sieht.
 *
 *   node --experimental-strip-types werkzeuge/zeitachse-pruefen.ts
 */
import assert from "node:assert/strict";
import type { Caption } from "@remotion/captions";
import { bauZeitachse, reelDauerMs, rohZuReel, segmenteAusPausen, untertitelUmrechnen } from "../src/zeitachse.ts";

const wort = (text: string, startMs: number, endMs: number): Caption => ({
  text,
  startMs,
  endMs,
  timestampMs: Math.round((startMs + endMs) / 2),
  confidence: 1,
});

// Zwei Abschnitte mit einer 2-Sekunden-Pause dazwischen.
const achse = bauZeitachse([
  { datei: "roh.mp4", vonSekunde: 0, bisSekunde: 4 },
  { datei: "roh.mp4", vonSekunde: 6, bisSekunde: 10 },
]);

assert.equal(reelDauerMs(achse), 8000, "Zwei mal 4 Sekunden ergeben 8 Sekunden Reel");
assert.equal(rohZuReel(achse, 0), 0);
assert.equal(rohZuReel(achse, 3_500), 3_500, "vor dem Schnitt unverändert");
assert.equal(rohZuReel(achse, 5_000), null, "in der Pause: weggeschnitten");
assert.equal(rohZuReel(achse, 6_000), 4_000, "nach dem Schnitt um die Pause früher");
assert.equal(rohZuReel(achse, 9_999), 7_999);

// Untertitel: eins vorher, eins in der Pause, eins danach, eins über den Schnitt.
const umgerechnet = untertitelUmrechnen(
  [
    wort("davor", 1_000, 1_400),
    wort("verschluckt", 4_500, 5_500),
    wort("danach", 7_000, 7_400),
    wort("hineinragend", 3_800, 4_600),
  ],
  achse,
);

assert.deepEqual(
  umgerechnet.map((c) => [c.text, c.startMs, c.endMs]),
  [
    ["davor", 1_000, 1_400],
    ["hineinragend", 3_800, 4_000],
    ["danach", 5_000, 5_400],
  ],
  "Pausenwort fällt weg, hineinragendes Wort wird am Schnitt beschnitten, Rest wandert mit",
);

for (const c of umgerechnet) {
  assert.ok(c.timestampMs !== null && c.timestampMs >= c.startMs && c.timestampMs <= c.endMs, `timestampMs bleibt im Wort: ${c.text}`);
}

// Aus Pausen werden Segmente: die Luft an den Schnitten bleibt stehen.
const segmente = segmenteAusPausen({
  datei: "roh.mp4",
  gesamtSekunden: 10,
  pausen: [{ von: 4, bis: 6 }],
  luftMs: 100,
});

assert.deepEqual(
  segmente.map((s) => [s.vonSekunde, s.bisSekunde]),
  [
    [0, 4.1],
    [5.9, 10],
  ],
  "je 100 ms Atem an beiden Seiten des Schnitts",
);

// Zu kurze Reststücke entstehen nicht: eine Pause direkt am Anfang darf kein
// 0-Sekunden-Segment davor erzeugen.
const amAnfang = segmenteAusPausen({
  datei: "roh.mp4",
  gesamtSekunden: 5,
  pausen: [{ von: 0, bis: 1 }],
  luftMs: 0,
});
assert.deepEqual(amAnfang.map((s) => [s.vonSekunde, s.bisSekunde]), [[1, 5]], "kein leeres Segment vor einer Pause am Anfang");

console.log("Zeitachse: alle Prüfungen bestanden");
