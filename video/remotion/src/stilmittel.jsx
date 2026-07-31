// Stilmittel jenseits der Kamerafahrt.
//
// Fassung 4 hatte in 13 von 13 Einstellungen eine Kamerabewegung. Damit wird
// das stärkste Mittel zur Gewohnheit und verliert seine Wirkung — und wer
// genau hinsieht, merkt, dass immer dasselbe passiert.
//
// Die Mittel hier erzeugen Abwechslung, ohne die Kamera zu bemühen:
//
//   Statisch      — die Einstellung steht. Erst der Stillstand macht die
//                   nächste Fahrt wieder zu einem Ereignis.
//   Karte         — die Oberfläche liegt als Karte auf Markenfarbe. Ein Beat
//                   ohne jede Bewegung, gut nach einer bewegten Einstellung.
//   Nebeneinander — zwei Aufnahmen im geteilten Bild. Zeigt einen Unterschied
//                   in einem Bild, statt ihn nacheinander zu behaupten.
//   Notiz         — eine Sprechblase fliegt an eine Stelle im Bild und nennt
//                   die Zahl. Bewegung in der Overlay-Ebene statt in der Kamera.
//   Schub         — Übergang, bei dem die neue Einstellung die alte seitlich
//                   hinausschiebt. Sparsam: höchstens zweimal im Video.
import React from "react";
import { AbsoluteFill, OffthreadVideo, interpolate, staticFile, useCurrentFrame } from "remotion";
import { BREITE, FARBEN, FPS, HOEHE } from "./bausteine";

const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
const federn = (p) => 1 - Math.pow(1 - p, 3);

const Roh = ({ clip, ab, style }) => (
  <OffthreadVideo
    src={staticFile(`clips/${clip}.webm`)}
    trimBefore={Math.round(ab * FPS)}
    style={{ width: BREITE, height: HOEHE, objectFit: "cover", ...style }}
  />
);

// ── Karte ───────────────────────────────────────────────────────────────────
// Die Aufnahme sitzt als abgerundete Karte auf Markengrund. Der Rand gibt dem
// Bild Ruhe und wirkt wie ein Fenster — ein Wechsel der Bildsprache, der ohne
// Bewegung auskommt.
export const Karte = ({ clip, ab, dauer, kinder }) => {
  const frame = useCurrentFrame();
  const auf = federn(interpolate(frame, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const skala = 0.86 + 0.02 * auf;
  return (
    <AbsoluteFill style={{
      background: `radial-gradient(120% 120% at 50% 0%, #1d332e 0%, ${FARBEN.dunkel} 70%)`,
      alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        width: BREITE * skala, height: HOEHE * skala, borderRadius: 18, overflow: "hidden",
        boxShadow: "0 30px 80px rgba(0,0,0,.55)", border: "1px solid rgba(255,255,255,.08)",
        // Etwas nach oben gerückt: Unten liegt die Unterzeile, und die helle
        // Karte schien vorher durch deren Verlauf hindurch.
        opacity: auf, transform: `translateY(${(1 - auf) * 18 - 34}px)`, position: "relative",
      }}>
        <Roh clip={clip} ab={ab} style={{ width: BREITE * skala, height: HOEHE * skala }} />
        {kinder}
      </div>
    </AbsoluteFill>
  );
};

// ── Nebeneinander ───────────────────────────────────────────────────────────
// Zwei Aufnahmen im geteilten Bild, die Trennkante fährt auf. Zeigt den
// Rollenunterschied in EINEM Bild — vorher brauchte das zwei Einstellungen
// hintereinander und die Behauptung, es sei dasselbe Objekt.
export const Nebeneinander = ({ links, rechts, dauer }) => {
  const frame = useCurrentFrame();
  const auf = ease(interpolate(frame, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const halb = BREITE / 2;
  const Seite = ({ seite, spalte }) => (
    <div style={{
      position: "absolute", top: 0, width: halb, height: HOEHE, overflow: "hidden",
      [spalte]: 0, transform: `translateX(${(spalte === "left" ? -1 : 1) * (1 - auf) * 40}px)`,
    }}>
      {/* BEIDE Seiten zeigen ihre linke Bildhälfte — dort steht die
          Bereichsleiste, und genau deren Länge ist der Unterschied, um den es
          geht. Ein Versatz nach rechts zeigte den Inhalt und verfehlte den Punkt. */}
      <div style={{ position: "absolute", left: 0, top: 0 }}>
        <Roh clip={seite.clip} ab={seite.ab} />
      </div>
      {/* Beschriftung OBEN: unten liegt die Unterzeile und verdeckte sie. */}
      <div style={{
        position: "absolute", left: 0, right: 0, top: 0, padding: "18px 20px 34px",
        background: "linear-gradient(to bottom, rgba(8,6,5,.92), rgba(8,6,5,0))",
        fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: 24,
        color: "#fff", textAlign: "center", opacity: auf,
      }}>{seite.titel}</div>
    </div>
  );
  return (
    <AbsoluteFill style={{ backgroundColor: FARBEN.dunkel }}>
      <Seite seite={links} spalte="left" />
      <Seite seite={rechts} spalte="right" />
      <div style={{
        position: "absolute", left: halb - 1, top: 0, width: 2, height: HOEHE,
        background: FARBEN.orange, opacity: 0.9 * auf,
        transform: `scaleY(${auf})`, transformOrigin: "center",
      }} />
    </AbsoluteFill>
  );
};

// ── Notiz ───────────────────────────────────────────────────────────────────
// Fliegt an eine Stelle im Bild und nennt die Zahl. Sitzt in der Kamera-Ebene,
// wandert also mit dem Inhalt.
export const Notiz = ({ box, text, ab, bis, seite = "rechts" }) => {
  const frame = useCurrentFrame();
  if (frame < ab - 8 || frame > bis + 10) return null;
  const auf = federn(interpolate(frame, [ab, ab + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const zu = interpolate(frame, [bis, bis + 10], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const o = Math.min(auf, zu);
  const rechts = seite === "rechts";
  return (
    <div style={{
      position: "absolute",
      left: rechts ? box.x + box.w + 16 : box.x - 16,
      top: box.y + box.h / 2,
      transform: `translate(${rechts ? 0 : -100}%, -50%) translateX(${(1 - auf) * (rechts ? 24 : -24)}px)`,
      opacity: o, pointerEvents: "none",
    }}>
      <div style={{
        background: FARBEN.orange, color: "#00241f", borderRadius: 10,
        padding: "8px 14px", fontFamily: '"Inter", sans-serif', fontWeight: 600,
        fontSize: 20, whiteSpace: "nowrap", boxShadow: "0 8px 24px rgba(0,0,0,.4)",
      }}>{text}</div>
    </div>
  );
};

export { ease, federn };
