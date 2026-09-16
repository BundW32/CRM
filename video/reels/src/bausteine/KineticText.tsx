import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { fitText } from "@remotion/layout-utils";
import { FARBEN, FORMAT, SAFE_ZONE, SCHRIFT } from "../marke";
import { useSchriften } from "../schriften";

export type Zeile = {
  text: string;
  /** Gewicht im Bild: "gross" trägt die Aussage, "klein" ist Füllwort. */
  groesse: "gross" | "klein";
  /** Genau EIN Wort je Einblendung darf die Akzentfarbe tragen. */
  akzent?: boolean;
  /** Warnfarbe statt Akzent – nur für Fristen, Fehler, Risiko. */
  warnung?: boolean;
  /** Frames nach Beginn der Sequenz, ab denen die Zeile steht. */
  abFrame: number;
};

const MAX = { gross: 230, klein: 96 } as const;

/**
 * Große gestapelte Kinetic-Texte, wie sie die Kernaussagen tragen.
 *
 * Die Zeilen kommen im Sprechtakt einzeln dazu (harter Scale-in, kein Fade),
 * jede Zeile wird auf die Bildbreite gerechnet statt fest verdrahtet — deutsche
 * Komposita sind länger, als man beim Entwurf denkt.
 *
 * Liegt diese Ebene UNTER der freigestellten Person, verdeckt der Kopf Teile der
 * Buchstaben (siehe references/text-hinter-person.md im Skill).
 */
export const KineticText: React.FC<{
  zeilen: Zeile[];
  /** Oberkante des Blocks. Standard: knapp unter der Instagram-Statusleiste. */
  vonOben?: number;
  ausrichtung?: "links" | "mitte";
}> = ({ zeilen, vonOben = SAFE_ZONE.oben + 40, ausrichtung = "links" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bereit = useSchriften();
  if (!bereit) return null;

  const innen = FORMAT.breite - SAFE_ZONE.links - SAFE_ZONE.rechts;

  return (
    <AbsoluteFill
      style={{
        paddingTop: vonOben,
        paddingLeft: SAFE_ZONE.links,
        paddingRight: SAFE_ZONE.rechts,
        alignItems: ausrichtung === "mitte" ? "center" : "flex-start",
      }}
    >
      {zeilen.map((z) => {
        const pop = spring({
          frame: frame - z.abFrame,
          fps,
          config: { damping: 13, mass: 0.45 },
          durationInFrames: 6,
        });
        if (frame < z.abFrame) return null;

        const passend = Math.min(
          MAX[z.groesse],
          fitText({
            text: z.text,
            fontFamily: SCHRIFT.display.family,
            fontWeight: SCHRIFT.display.gewicht,
            letterSpacing: "-0.02em",
            withinWidth: innen,
          }).fontSize,
        );

        return (
          <p
            key={`${z.text}-${z.abFrame}`}
            style={{
              margin: 0,
              fontFamily: SCHRIFT.display.family,
              fontWeight: 900,
              fontSize: passend,
              lineHeight: 0.88,
              letterSpacing: "-0.02em",
              whiteSpace: "nowrap",
              color: z.warnung ? FARBEN.warnung : z.akzent ? FARBEN.orange : FARBEN.weiss,
              opacity: z.groesse === "klein" ? 0.92 : 1,
              textShadow: "0 10px 44px rgba(0,0,0,0.55)",
              transform: `scale(${interpolate(pop, [0, 1], [1.3, 1])})`,
              transformOrigin: ausrichtung === "mitte" ? "center top" : "left top",
            }}
          >
            {z.text}
          </p>
        );
      })}
    </AbsoluteFill>
  );
};
