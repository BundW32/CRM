import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { createTikTokStyleCaptions, type Caption } from "@remotion/captions";
import { FARBEN, LAUTSTAERKE, SAFE_ZONE } from "./marke";
import { KineticText } from "./bausteine/KineticText";
import { Untertitel } from "./bausteine/Untertitel";

/**
 * Prüfbild für das Gerüst — kein Reel.
 *
 * Zeigt in einem Durchlauf: geladene Schrift, gestapelten Kinetic-Text mit
 * Akzentwort, Wort-für-Wort-Untertitel mit aktivem Wort, einen Klangakzent und
 * die eingezeichnete Instagram-Safe-Zone.
 *
 * Die Beispiel-Untertitel sind absichtlich so geformt, wie Whisper wirklich
 * liefert: ein Kompositum kommt in Wortteilen an. Wenn hier
 * „Wohnungseigentümergemeinschaft" als ein Wort aufleuchtet und nicht als
 * sieben Fragmente, funktioniert die Zusammenführung.
 */

const roheWorte: Caption[] = [
  { text: "Eine", startMs: 0, endMs: 380, timestampMs: 190, confidence: 1 },
  { text: " kleine", startMs: 380, endMs: 780, timestampMs: 580, confidence: 1 },
  { text: " Wohnung", startMs: 900, endMs: 1150, timestampMs: 1020, confidence: 1 },
  { text: "se", startMs: 1150, endMs: 1260, timestampMs: 1200, confidence: 1 },
  { text: "igent", startMs: 1260, endMs: 1420, timestampMs: 1340, confidence: 1 },
  { text: "ü", startMs: 1420, endMs: 1500, timestampMs: 1460, confidence: 1 },
  { text: "mer", startMs: 1500, endMs: 1650, timestampMs: 1570, confidence: 1 },
  { text: "geme", startMs: 1650, endMs: 1800, timestampMs: 1720, confidence: 1 },
  { text: "ins", startMs: 1800, endMs: 1900, timestampMs: 1850, confidence: 1 },
  { text: "chaft", startMs: 1900, endMs: 2100, timestampMs: 2000, confidence: 1 },
  { text: " macht", startMs: 2200, endMs: 2520, timestampMs: 2360, confidence: 1 },
  { text: " das", startMs: 2520, endMs: 2740, timestampMs: 2630, confidence: 1 },
  { text: " selbst", startMs: 2740, endMs: 3000, timestampMs: 2870, confidence: 1 },
];

const { pages } = createTikTokStyleCaptions({
  captions: roheWorte,
  combineTokensWithinMilliseconds: 900,
});

export const Gruesttest: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: FARBEN.gruen }}>
    <AbsoluteFill
      style={{
        background: `radial-gradient(120% 80% at 50% 15%, ${FARBEN.gruenHell} 0%, ${FARBEN.gruen} 55%, ${FARBEN.tinte} 100%)`,
      }}
    />

    <Sequence from={6} durationInFrames={40}>
      <Audio src={staticFile("sfx/whoosh.wav")} volume={LAUTSTAERKE.whoosh} />
    </Sequence>

    <KineticText
      zeilen={[
        { text: "DAS GERÜST", groesse: "klein", abFrame: 0 },
        { text: "STEHT", groesse: "gross", abFrame: 6 },
        { text: "SAUBER", groesse: "gross", akzent: true, abFrame: 14 },
      ]}
    />

    <Untertitel seiten={pages} />

    <SafeZone />
  </AbsoluteFill>
);

/** Nur im Prüfbild sichtbar: die Bereiche, die Instagram überdeckt. */
const SafeZone: React.FC = () => {
  const rand: React.CSSProperties = {
    position: "absolute",
    backgroundColor: "rgba(246,144,24,0.16)",
    borderColor: FARBEN.orange,
    borderStyle: "dashed",
    borderWidth: 0,
  };
  return (
    <AbsoluteFill>
      <div style={{ ...rand, top: 0, left: 0, right: 0, height: SAFE_ZONE.oben, borderBottomWidth: 3 }} />
      <div style={{ ...rand, bottom: 0, left: 0, right: 0, height: SAFE_ZONE.unten, borderTopWidth: 3 }} />
      <div style={{ ...rand, top: 0, bottom: 0, right: 0, width: SAFE_ZONE.rechts, borderLeftWidth: 3 }} />
    </AbsoluteFill>
  );
};
