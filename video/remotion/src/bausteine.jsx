// Bausteine der Komposition.
//
// Der entscheidende Unterschied zur ffmpeg-Fassung ist die Reihenfolge der
// Ebenen:
//
//   ┌ Unterzeile ────────────── liegt ÜBER der Kamera und wird deshalb
//   │                           niemals von einer Fahrt beschnitten. Genau
//   │                           das war vorher der Fehler.
//   ├ Spotlight ─────────────── liegt IN der Kamera und wandert deshalb
//   │                           korrekt mit dem Inhalt mit.
//   └ Video ────────────────── die reine Aufnahme der App.
import React from "react";
import { AbsoluteFill, OffthreadVideo, interpolate, staticFile, useCurrentFrame } from "remotion";

export const BREITE = 1280;
export const HOEHE = 720;
export const FPS = 30;

// Markenwerte aus globals.css der App.
export const FARBEN = {
  orange: "#f69018",
  gruen: "#003630",
  dunkel: "#0a0806",
};

// ease-in-out für Kamerafahrten: langsam los, weich ankommen. Ein linearer
// Schwenk wirkt maschinell, ein reines ease-out startet zu abrupt.
const easeInOut = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);

const fortschritt = (frame, dauer, verzug = 0) =>
  easeInOut(interpolate(frame, [verzug, verzug + dauer], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  }));

// ── Kamera ──────────────────────────────────────────────────────────────────
// z = Zoomfaktor, cx/cy = der Punkt (in Anteilen des Bildes), der in die Mitte
// kommt. Umgesetzt als translate+scale um die Bildmitte, damit ein Wechsel des
// Bezugspunkts während der Fahrt keinen Sprung erzeugt.
export const Kamera = ({ von, nach, dauer, verzug = 0, children }) => {
  const frame = useCurrentFrame();
  const p = fortschritt(frame, dauer, verzug);
  const z = von.z + (nach.z - von.z) * p;
  const cx = von.cx + (nach.cx - von.cx) * p;
  const cy = von.cy + (nach.cy - von.cy) * p;
  const tx = -(cx - 0.5) * BREITE * z;
  const ty = -(cy - 0.5) * HOEHE * z;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `translate(${tx}px, ${ty}px) scale(${z})` }}>
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── Spotlight ───────────────────────────────────────────────────────────────
// Ein Element mit riesigem Schlagschatten: Das Loch ist das Element selbst, der
// Schatten deckt den Rest ab. Weil es innerhalb der Kamera liegt, wandert es
// mit dem Inhalt mit.
//
// `ziele` ist eine Liste von { box, ab, bis } in Bildern. Zwischen zwei Zielen
// gleitet der Rahmen — bildgenau berechnet statt über einen CSS-Übergang, der
// bei schwankender Bildrate ruckelte.
export const Spotlight = ({ ziele, ausblenden = 12 }) => {
  const frame = useCurrentFrame();
  if (!ziele.length) return null;

  const start = ziele[0].ab;
  const ende = ziele[ziele.length - 1].bis;
  if (frame < start - 10 || frame > ende + ausblenden) return null;

  // Aktives Ziel und Übergang zum nächsten.
  let box = ziele[0].box;
  for (let i = 0; i < ziele.length; i++) {
    const z = ziele[i];
    if (frame >= z.ab) box = z.box;
    const naechste = ziele[i + 1];
    if (naechste && frame >= z.bis && frame < naechste.ab) {
      const p = fortschritt(frame, naechste.ab - z.bis, z.bis);
      box = {
        x: z.box.x + (naechste.box.x - z.box.x) * p,
        y: z.box.y + (naechste.box.y - z.box.y) * p,
        w: z.box.w + (naechste.box.w - z.box.w) * p,
        h: z.box.h + (naechste.box.h - z.box.h) * p,
      };
    }
  }

  const auf = interpolate(frame, [start - 8, start + 2], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const zu = interpolate(frame, [ende, ende + ausblenden], [1, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const deckung = Math.min(auf, zu);
  const pad = 10;

  return (
    <div
      style={{
        position: "absolute",
        left: box.x - pad, top: box.y - pad,
        width: box.w + pad * 2, height: box.h + pad * 2,
        borderRadius: 12,
        boxShadow: `0 0 0 4000px rgba(8,6,5,${0.7 * deckung})`,
        outline: `2px solid rgba(246,144,24,${0.9 * deckung})`,
        opacity: deckung > 0 ? 1 : 0,
      }}
    />
  );
};

// ── Unterzeile ──────────────────────────────────────────────────────────────
// Liegt über der Kamera. `*Wort*` hebt in Markenfarbe hervor.
export const Unterzeile = ({ text, ab, bis }) => {
  const frame = useCurrentFrame();
  if (frame < ab - 12 || frame > bis + 12) return null;
  const auf = interpolate(frame, [ab, ab + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const zu = interpolate(frame, [bis, bis + 10], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const o = Math.min(auf, zu);
  const hoch = interpolate(frame, [ab, ab + 12], [16, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const teile = text.split(/(\*[^*]+\*)/).filter(Boolean);
  return (
    <div
      style={{
        position: "absolute", left: 0, right: 0, bottom: 0,
        padding: "96px 56px 54px", opacity: o,
        background: "linear-gradient(to top, rgba(8,6,5,.95) 0%, rgba(8,6,5,.86) 40%, rgba(10,8,6,0) 100%)",
        fontFamily: '"Plus Jakarta Sans", sans-serif',
      }}
    >
      <div style={{
        color: "#fff", fontSize: 40, fontWeight: 800, letterSpacing: "-0.02em",
        lineHeight: 1.15, transform: `translateY(${hoch}px)`,
        textShadow: "0 2px 18px rgba(0,0,0,.6)",
      }}>
        {teile.map((t, i) =>
          t.startsWith("*") && t.endsWith("*")
            ? <span key={i} style={{ color: FARBEN.orange }}>{t.slice(1, -1)}</span>
            : <span key={i}>{t}</span>,
        )}
      </div>
    </div>
  );
};

// ── Eine Einstellung ────────────────────────────────────────────────────────
// `kinder` nimmt weitere Ebenen auf, die IN der Kamera liegen sollen (Notizen
// etwa), damit sie mit dem Inhalt mitwandern.
export const Einstellung = ({ clip, ab, dauer, kamera, ziele = [], unterzeile, kinder }) => (
  <AbsoluteFill style={{ backgroundColor: FARBEN.dunkel }}>
    <Kamera von={kamera.von} nach={kamera.nach} dauer={kamera.dauer ?? dauer} verzug={kamera.verzug ?? 0}>
      <OffthreadVideo
        src={staticFile(`clips/${clip}.webm`)}
        trimBefore={Math.round(ab * FPS)}
        style={{ width: BREITE, height: HOEHE, objectFit: "cover" }}
      />
      <Spotlight ziele={ziele} />
      {kinder}
    </Kamera>
    {unterzeile ? <Unterzeile {...unterzeile} /> : null}
  </AbsoluteFill>
);
