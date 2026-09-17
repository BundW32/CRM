import React from "react";
import { AbsoluteFill, Easing, OffthreadVideo, interpolate, staticFile, useCurrentFrame } from "remotion";
import { FARBEN } from "../marke";

/**
 * B-Roll aus dem Portal — entweder formatfüllend mit langsamer Zufahrt oder in
 * einem Handy-Rahmen.
 *
 * Der Rahmen ist kein Schmuck: Eine Portal-Aufnahme im Querformat, auf 1080
 * Breite gezogen, ist auf dem Handy unlesbar. Im Handy-Rahmen bleibt der
 * Ausschnitt hochkant und der Zuschauer sieht sofort, dass es eine App ist.
 *
 * Kurz halten — 1 bis 3 Sekunden, in schnellen Aufzählungen 1 bis 1,5.
 */
export const Mockup: React.FC<{
  datei: string;
  stil?: "rahmen" | "vollbild";
  /** Langsame Zufahrt. Sie fährt an und steht, sie läuft nicht bis zum Schnitt. */
  zufahrt?: boolean;
  fahrtFrames?: number;
  /** Zeigt nur einen Ausschnitt der Aufnahme — für den relevanten Bereich. */
  ausschnitt?: { skalierung: number; versatzX?: number; versatzY?: number };
}> = ({ datei, stil = "rahmen", zufahrt = true, fahrtFrames = 60, ausschnitt }) => {
  const frame = useCurrentFrame();
  const zoom = zufahrt
    ? interpolate(frame, [0, fahrtFrames], [1, 1.07], {
        extrapolateRight: "clamp",
        easing: Easing.out(Easing.cubic),
      })
    : 1;

  const inhalt = (
    <div
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        transform: ausschnitt
          ? `scale(${ausschnitt.skalierung}) translate(${ausschnitt.versatzX ?? 0}px, ${ausschnitt.versatzY ?? 0}px)`
          : undefined,
      }}
    >
      <OffthreadVideo src={staticFile(datei)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </div>
  );

  if (stil === "vollbild") {
    return (
      <AbsoluteFill style={{ backgroundColor: FARBEN.tinte, overflow: "hidden" }}>
        <AbsoluteFill style={{ transform: `scale(${zoom})` }}>{inhalt}</AbsoluteFill>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill
      style={{
        backgroundColor: FARBEN.orangeHell,
        justifyContent: "center",
        alignItems: "center",
        padding: 90,
      }}
    >
      <div
        style={{
          width: 760,
          height: 1520,
          borderRadius: 66,
          backgroundColor: "#ffffff",
          padding: 12,
          boxShadow: "0 50px 120px -30px rgba(0,36,31,0.55), 0 0 0 3px rgba(0,36,31,0.10)",
          transform: `scale(${zoom})`,
          overflow: "hidden",
        }}
      >
        <div style={{ width: "100%", height: "100%", borderRadius: 54, overflow: "hidden", backgroundColor: FARBEN.tinte }}>
          {inhalt}
        </div>
      </div>
    </AbsoluteFill>
  );
};
