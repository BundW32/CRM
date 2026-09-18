import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { fitTextOnNLines } from "@remotion/layout-utils";
import { BUEHNE, FARBEN, FORMAT, SAFE_ZONE, SCHRIFT, TEXTBAND } from "./marke";
import { useSchriften } from "./schriften";

/**
 * Zeigt den Bildaufbau zur Abstimmung — kein Reel.
 *
 * Links im Vergleich steckt die Frage, die Alex gestellt hat: Wohin mit den
 * Untertiteln, wenn der Sprecher das ganze Bild füllt? Hier sitzt er als 4:5-
 * Fläche unten, darüber liegt das freie Band.
 *
 * Material dafür: `node werkzeuge/demo-material.mjs`
 */

const BAND_HOEHE = TEXTBAND.unten - TEXTBAND.oben;
const INNEN = FORMAT.breite - SAFE_ZONE.links - SAFE_ZONE.rechts;

export const Bildaufbau: React.FC<{ hilfslinien?: boolean }> = ({ hilfslinien = false }) => {
  const bereit = useSchriften();
  if (!bereit) return <AbsoluteFill style={{ backgroundColor: FARBEN.tinte }} />;

  const zeile = "ihr braucht keinen Verwalter";
  const { fontSize } = fitTextOnNLines({
    text: zeile,
    maxLines: 2,
    maxBoxWidth: INNEN,
    fontFamily: SCHRIFT.display.family,
    fontWeight: SCHRIFT.display.gewicht,
    letterSpacing: "-0.01em",
    maxFontSize: 96,
  });

  return (
    <AbsoluteFill style={{ backgroundColor: FARBEN.tinte }}>
      {/* Hintergrund: stark unscharfes Foto, abgedunkelt, damit Text darauf trägt */}
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <Img
          src={staticFile("demo/hintergrund.jpg")}
          style={{
            width: "110%",
            height: "110%",
            objectFit: "cover",
            filter: "blur(38px) saturate(0.85) brightness(0.55)",
            transform: "translate(-5%, -5%)",
          }}
        />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, rgba(0,36,31,0.55) 0%, rgba(0,36,31,0.15) 45%, rgba(0,36,31,0.75) 100%)`,
        }}
      />

      {/* Das freie Band: hier stehen große Untertitel und Einblendungen */}
      <AbsoluteFill
        style={{
          top: TEXTBAND.oben,
          height: BAND_HOEHE,
          paddingLeft: SAFE_ZONE.links,
          paddingRight: SAFE_ZONE.rechts,
          justifyContent: "flex-end",
          alignItems: "center",
          paddingBottom: 36,
        }}
      >
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
          {zeile.split(" ").map((w, i) => (
            <span
              key={w}
              style={{
                fontFamily: SCHRIFT.display.family,
                fontWeight: 900,
                fontSize,
                lineHeight: 1.02,
                letterSpacing: "-0.01em",
                color: i === 3 ? FARBEN.orange : FARBEN.weiss,
                textShadow: "0 6px 28px rgba(0,0,0,0.8)",
              }}
            >
              {w}
            </span>
          ))}
        </div>
      </AbsoluteFill>

      {/* Die Bühne: Sprecherbild als 4:5-Fläche unten */}
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: BUEHNE.vonUnten }}>
        <div
          style={{
            width: BUEHNE.breite,
            height: BUEHNE.hoehe,
            borderRadius: BUEHNE.radius,
            overflow: "hidden",
            boxShadow: "0 40px 90px -30px rgba(0,0,0,0.75)",
            backgroundColor: FARBEN.tinte,
          }}
        >
          <Img
            src={staticFile("demo/sprecher.jpg")}
            style={{
              width: "100%",
              height: `${100 / (BUEHNE.hoehe / (BUEHNE.breite * (FORMAT.hoehe / FORMAT.breite)))}%`,
              objectFit: "cover",
              objectPosition: `50% ${BUEHNE.ausschnittVonOben * 100}%`,
              display: "block",
            }}
          />
        </div>
      </AbsoluteFill>

      {hilfslinien ? <Hilfslinien /> : null}
    </AbsoluteFill>
  );
};

/** Nur zur Abstimmung: zeigt Safe-Zone und Bandgrenzen. */
const Hilfslinien: React.FC = () => (
  <AbsoluteFill>
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: SAFE_ZONE.oben, borderBottom: `3px dashed ${FARBEN.orange}`, backgroundColor: "rgba(246,144,24,0.10)" }} />
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: SAFE_ZONE.unten, borderTop: `3px dashed ${FARBEN.orange}`, backgroundColor: "rgba(246,144,24,0.10)" }} />
    <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: SAFE_ZONE.rechts, borderLeft: `3px dashed ${FARBEN.orange}`, backgroundColor: "rgba(246,144,24,0.10)" }} />
    <div
      style={{
        position: "absolute",
        top: TEXTBAND.oben,
        left: 0,
        right: 0,
        height: TEXTBAND.unten - TEXTBAND.oben,
        border: "3px solid rgba(255,255,255,0.45)",
      }}
    />
  </AbsoluteFill>
);
