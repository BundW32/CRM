import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { FARBEN, SAFE_ZONE, SCHRIFT } from "../marke";
import { useSchriften } from "../schriften";

/**
 * Entspricht dem Caption-Format von @remotion/captions, wie es
 * werkzeuge/transkribieren.mjs schreibt — Millisekunden ab Beginn der
 * umgebenden Sequenz.
 */
export type Wort = {
  text: string;
  startMs: number;
  endMs: number;
};

/**
 * Wort-für-Wort-Untertitel im unteren Drittel, oberhalb der Instagram-Leiste.
 *
 * Es stehen immer mehrere Wörter nebeneinander (Häppchen), damit das Auge nicht
 * springt; hervorgehoben wird nur das gerade gesprochene. Satzzeichen kommen aus
 * dem Transkript und werden vorher entfernt — außer "?".
 */
export const Untertitel: React.FC<{
  woerter: Wort[];
  /** Wie viele Wörter gleichzeitig stehen. 1–3 laut Skill. */
  proHaeppchen?: number;
  /** Abstand von unten. Standard hält die Safe-Zone ein. */
  abstandUnten?: number;
}> = ({ woerter, proHaeppchen = 3, abstandUnten = SAFE_ZONE.unten + 40 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bereit = useSchriften();

  const ms = (frame / fps) * 1000;
  const aktiverIndex = woerter.findIndex((w) => ms >= w.startMs && ms < w.endMs);
  if (!bereit || aktiverIndex === -1) return null;

  const haeppchenIndex = Math.floor(aktiverIndex / proHaeppchen);
  const haeppchen = woerter.slice(haeppchenIndex * proHaeppchen, (haeppchenIndex + 1) * proHaeppchen);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: abstandUnten,
        paddingLeft: SAFE_ZONE.links,
        paddingRight: SAFE_ZONE.rechts,
      }}
    >
      <div style={{ display: "flex", gap: 20, alignItems: "baseline", flexWrap: "wrap", justifyContent: "center" }}>
        {haeppchen.map((w) => {
          const istAktiv = woerter.indexOf(w) === aktiverIndex;
          const startFrame = (w.startMs / 1000) * fps;
          const pop = istAktiv
            ? spring({ frame: frame - startFrame, fps, config: { damping: 12, mass: 0.4 }, durationInFrames: 8 })
            : 0;
          return (
            <span
              key={`${w.text}-${w.startMs}`}
              style={{
                fontFamily: SCHRIFT.display.family,
                fontWeight: 900,
                fontSize: istAktiv ? 76 : 68,
                lineHeight: 1.05,
                letterSpacing: "-0.01em",
                color: istAktiv ? FARBEN.orange : FARBEN.weiss,
                textShadow: "0 4px 22px rgba(0,0,0,0.85)",
                transform: `scale(${1 + pop * 0.06})`,
              }}
            >
              {w.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
