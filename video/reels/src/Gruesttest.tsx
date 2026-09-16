import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { FARBEN, LAUTSTAERKE, SAFE_ZONE } from "./marke";
import { KineticText } from "./bausteine/KineticText";
import { Untertitel } from "./bausteine/Untertitel";

/**
 * Prüfbild für das Gerüst — kein Reel.
 *
 * Zeigt in einem Durchlauf: geladene Schrift, gestapelten Kinetic-Text mit
 * Akzentwort, Wort-für-Wort-Untertitel mit aktivem Wort, einen Klangakzent und
 * die eingezeichnete Instagram-Safe-Zone. Wenn das sauber rendert, hängt am
 * ersten echten Reel nur noch der Schnitt.
 */
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

    <Untertitel
      woerter={[
        { text: "Schrift", startMs: 0, endMs: 500 },
        { text: "Text", startMs: 500, endMs: 1000 },
        { text: "Ton", startMs: 1000, endMs: 1500 },
        { text: "Safe-Zone", startMs: 1500, endMs: 2200 },
        { text: "alles", startMs: 2200, endMs: 2600 },
        { text: "da", startMs: 2600, endMs: 3000 },
      ]}
    />

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
