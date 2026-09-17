import React from "react";
import type { Caption } from "@remotion/captions";
import { Reel } from "./Reel";
import type { ReelPlan } from "./plan";
import { pausenAusTranskript, segmenteAusPausen } from "./zeitachse";
import rohesTranskript from "./probe-transkript.json";
import gemesseneStillen from "./probe-pausen.json";

/**
 * Prüfstück für die ganze Kette — kein Reel.
 *
 * Nimmt ein echtes Whisper-Transkript, schneidet die Denkpausen heraus und
 * setzt daraus ein Reel zusammen. Wichtig ist dabei die Probe, die man an
 * einem Einzelbild nicht sieht: Nach jedem Schnitt müssen die Untertitel noch
 * auf dem gesprochenen Wort sitzen. Das Prüfvideo zeigt einen Zähler, also ist
 * am Bild ablesbar, welche Rohsekunde gerade läuft.
 *
 * Material vorher erzeugen: `node werkzeuge/probe-material.mjs`
 */

const DATEI = "roh/probe-1080x1920.mp4";
const GESAMT_SEKUNDEN = 16;
const MINDEST_PAUSE_S = 0.3;

const captions = rohesTranskript as Caption[];

/**
 * Dieselben zwei Quellen wie im echten Schnitt: die am Ton gemessenen Stillen
 * (`silencedetect`, hier als Datei mitgeliefert) und die Pausen, die im
 * Transkript in den Satzzeichen-Token stecken.
 */
const pausen = [...gemesseneStillen, ...pausenAusTranskript(captions, MINDEST_PAUSE_S * 1000)];

const segmente = segmenteAusPausen({
  datei: DATEI,
  gesamtSekunden: GESAMT_SEKUNDEN,
  pausen,
  luftMs: 60,
});

export const probePlan: ReelPlan = {
  titel: "Prüfstück",
  segmente,
  untertitelRoh: captions,
  kamera: segmente.map((_, i) => (i % 2 === 0 ? { zoomVon: 1, zoomBis: 1.12 } : {})),
  kinetic: [
    {
      abSekunde: 0,
      dauerSekunden: 1.8,
      zeilen: [
        { text: "KLEINE WEG", groesse: "klein", abFrame: 0 },
        { text: "OHNE", groesse: "gross", abFrame: 4 },
        { text: "VERWALTER", groesse: "gross", akzent: true, abFrame: 10 },
      ],
    },
    {
      abSekunde: 8,
      dauerSekunden: 1.6,
      zeilen: [
        { text: "MACHT", groesse: "gross", abFrame: 0 },
        { text: "IHR SELBST", groesse: "gross", akzent: true, abFrame: 6 },
      ],
    },
  ],
  broll: [{ abSekunde: 5.2, dauerSekunden: 1.6, datei: DATEI, stil: "rahmen" }],
  klaenge: [
    { abSekunde: 0, klang: "whoosh" },
    { abSekunde: 8, klang: "whip" },
    { abSekunde: 5.2, klang: "switch", lautstaerke: 0.2 },
  ],
};

export const Reelprobe: React.FC = () => <Reel plan={probePlan} />;
