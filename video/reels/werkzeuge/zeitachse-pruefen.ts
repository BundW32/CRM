/**
 * Prüft die Zeitachse — die Stelle, an der ein falsches Vorzeichen das ganze
 * Reel aus dem Takt bringt, ohne dass man es am Einzelbild sieht.
 *
 *   node --experimental-strip-types werkzeuge/zeitachse-pruefen.ts
 */
import assert from "node:assert/strict";
import type { Caption } from "@remotion/captions";
import { bauZeitachse, pausenAusTranskript, reelDauerMs, rohZuReel, schnittstellen, segmenteAusPausen, untertitelUmrechnen } from "../src/zeitachse.ts";
import { MAX_ZOOM, kameraFahrten } from "../src/kamera.ts";
import { pruefePlan } from "../src/pruefung.ts";
import type { ReelPlan } from "../src/plan.ts";

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

// Kein Schnitt landet je in einem Wort. Das ist der Fehler aus dem ersten
// echten Reel: Eine gemessene Stille lag über dem leisen Ende von „gehört",
// und beim Herausschneiden verschwand das Wort.
const sicher = schnittstellen({
  stillen: [{ von: 1.0, bis: 2.4, grund: "Stille" }],
  captions: [wort("gehört", 1_800, 2_100)],
  mindestMs: 200,
  toleranzMs: 0,
});

assert.deepEqual(
  sicher.map((s) => [s.von, s.bis]),
  [
    [1.0, 1.8],
    [2.1, 2.4],
  ],
  "die Stille zerfällt am Wort in zwei Stücke, das Wort selbst bleibt stehen",
);

assert.deepEqual(
  schnittstellen({ stillen: [{ von: 1.7, bis: 2.2 }], captions: [wort("gehört", 1_800, 2_100)], mindestMs: 200, toleranzMs: 0 }),
  [],
  "eine Stille, die fast ganz im Wort liegt, ergibt gar keinen Schnitt",
);

// Ein kurzes Wort wird trotz Toleranz vollständig geschützt — sonst bliebe von
// ihm bei 120 ms Toleranz an beiden Seiten nichts übrig.
assert.deepEqual(
  schnittstellen({
    stillen: [{ von: 1.0, bis: 2.4 }],
    captions: [wort("ja", 1_900, 2_050)],
    mindestMs: 200,
  }).map((s) => [Number(s.von.toFixed(3)), Number(s.bis.toFixed(3))]),
  [
    [1.0, 1.9],
    [2.05, 2.4],
  ],
  "kurzes Wort bleibt ganz stehen",
);

// Lange Wort-Token werden nicht mehr hinten beschnitten — genau daran sind
// im ersten Reel Wörter verschwunden.
assert.deepEqual(
  pausenAusTranskript([wort("gehört", 1_000, 2_600), wort(",", 2_600, 3_100)], 300).map((p) => p.grund),
  ['Pause bei „,"'],
  "nur Satzzeichen zählen als Pause, lange Wörter nicht",
);

// Punch-ins sind Akzente und summieren sich nicht auf.
const fahrten = kameraFahrten(9);
assert.equal(fahrten.filter((f) => f.zoomBis !== 1).length, 3, "nur jedes dritte Segment bekommt eine Fahrt");
assert.ok(
  fahrten.every((f) => f.zoomVon === 1 && (f.zoomBis ?? 1) <= MAX_ZOOM),
  "jede Fahrt beginnt bei 1,0 und bleibt unter der Obergrenze",
);

// Ein Segment, das über das Ende der Quelle hinausreicht, ist der Grund für
// die Bildschnipsel am Schluss des ersten echten Reels. Das muss auffallen,
// bevor gerendert wird.
const planZuLang: ReelPlan = {
  titel: "zu lang",
  segmente: [
    { datei: "roh.mp4", vonSekunde: 0, bisSekunde: 5 },
    { datei: "roh.mp4", vonSekunde: 6, bisSekunde: 12 },
  ],
  untertitelRoh: [],
};

const befunde = pruefePlan(planZuLang, { "roh.mp4": 10 });
assert.equal(befunde.filter((b) => b.schwere === "fehler").length, 1, "das zu lange Segment wird als Fehler gemeldet");
assert.match(befunde[0].text, /nur 10\.00 s lang/, "die Meldung nennt die echte Länge der Quelle");

assert.deepEqual(
  pruefePlan(
    { titel: "passt", segmente: [{ datei: "roh.mp4", vonSekunde: 0, bisSekunde: 10 }], untertitelRoh: [] },
    { "roh.mp4": 10 },
  ),
  [],
  "ein Segment exakt bis zum Ende der Quelle ist in Ordnung",
);

// Ein Kinetic-Text, der über das Reelende hinausläuft, ist eine Warnung.
const planUeberhang: ReelPlan = {
  titel: "Überhang",
  segmente: [{ datei: "roh.mp4", vonSekunde: 0, bisSekunde: 4 }],
  untertitelRoh: [],
  kinetic: [{ abSekunde: 3, dauerSekunden: 3, zeilen: [{ text: "ZU SPÄT", groesse: "gross", abFrame: 0 }] }],
};
assert.equal(
  pruefePlan(planUeberhang, { "roh.mp4": 10 }).filter((b) => b.schwere === "warnung").length,
  1,
  "Kinetic-Text über das Reelende hinaus wird gemeldet",
);

console.log("Zeitachse: alle Prüfungen bestanden");
