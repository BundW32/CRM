import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { TikTokPage } from "@remotion/captions";
import { fitText } from "@remotion/layout-utils";
import { FARBEN, FORMAT, SAFE_ZONE, SCHRIFT } from "../marke";
import { useSchriften } from "../schriften";
import { worteAusSeite } from "../worte";

/**
 * Wort-für-Wort-Untertitel im unteren Drittel, oberhalb der Instagram-Leiste.
 *
 * Es steht immer eine ganze Seite (1–3 Wörter aus `createTikTokStyleCaptions`),
 * hervorgehoben wird nur das gerade gesprochene Wort. Satzweise Untertitel
 * wirken träge; einzelne Wörter ohne Umgebung lassen das Auge springen.
 *
 * Die Zeiten sind Millisekunden ab Beginn der umgebenden <Sequence>. Wer ein
 * Segment schneidet, verschiebt die Sequence — nicht die Zeitstempel.
 */
export const Untertitel: React.FC<{
  seiten: TikTokPage[];
  /** Abstand von unten. Standard hält die Instagram-Safe-Zone ein. */
  abstandUnten?: number;
  /** Während ein großer Kinetic-Text steht, bleiben die Untertitel aus. */
  aus?: boolean;
}> = ({ seiten, abstandUnten = SAFE_ZONE.unten + 40, aus = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bereit = useSchriften();

  const ms = (frame / fps) * 1000;
  const seite = seiten.find((s) => ms >= s.startMs && ms < s.startMs + s.durationMs);
  if (!bereit || aus || !seite) return null;

  const worte = worteAusSeite(seite);
  const aktiv = worte.findIndex((w) => ms >= w.vonMs && ms < w.bisMs);

  // Größe rechnen, nicht festschreiben: „Wohnungseigentümergemeinschaft" ist
  // 31 Zeichen und kann nicht umbrechen — bei fester Größe läuft es aus dem
  // Bild. Die Zeile bleibt dadurch immer vollständig lesbar.
  const innen = FORMAT.breite - SAFE_ZONE.links - SAFE_ZONE.rechts;
  const groesse = Math.max(
    44,
    Math.min(
      70,
      fitText({
        text: worte.map((w) => w.text).join(" "),
        fontFamily: SCHRIFT.display.family,
        fontWeight: SCHRIFT.display.gewicht,
        letterSpacing: "-0.01em",
        withinWidth: innen,
      }).fontSize,
    ),
  );

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
      <div style={{ display: "flex", gap: 18, alignItems: "baseline", flexWrap: "wrap", justifyContent: "center" }}>
        {worte.map((w, i) => {
          const istAktiv = i === aktiv;
          const pop = istAktiv
            ? spring({
                frame: frame - (w.vonMs / 1000) * fps,
                fps,
                config: { damping: 12, mass: 0.4 },
                durationInFrames: 7,
              })
            : 0;
          return (
            <span
              key={`${w.text}-${w.vonMs}`}
              style={{
                fontFamily: SCHRIFT.display.family,
                fontWeight: 900,
                fontSize: groesse,
                lineHeight: 1.05,
                letterSpacing: "-0.01em",
                color: istAktiv ? FARBEN.orange : FARBEN.weiss,
                textShadow: "0 4px 22px rgba(0,0,0,0.85)",
                transform: `scale(${1 + pop * 0.08})`,
                transformOrigin: "center bottom",
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
