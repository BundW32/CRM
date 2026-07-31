// Kompositionen: Vollversion und Loop.
//
// Übergänge sind Kreuzblenden von 8 Bildern (~0,27 s). Bewusst kurz: Lange
// Blenden über alles hinweg ergäben eine Diashow. Umgesetzt, indem die
// Einstellungen sich überlappen und die obere aufblendet.
import React from "react";
import { AbsoluteFill, Composition, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { BREITE, FARBEN, FPS, HOEHE, Einstellung, Unterzeile } from "./bausteine";
import { EINSTELLUNGEN, Endtafel, Titel } from "./schnitt";
import { Karte, Nebeneinander, Notiz } from "./stilmittel";

// 5 Bilder (~0,17 s). Länger erzeugt zwischen zwei FAHRENDEN Einstellungen ein
// sichtbares Doppelbild — beide Bilder bewegen sich, und das Auge nimmt die
// Überlagerung als Unschärfe wahr statt als weichen Übergang.
export const BLENDE = 5;

const Schriften = () => (
  <style>{`
    @font-face { font-family:"Inter"; font-weight:400; src:url("${staticFile("fonts/inter-400.woff2")}") format("woff2"); }
    @font-face { font-family:"Inter"; font-weight:600; src:url("${staticFile("fonts/inter-600.woff2")}") format("woff2"); }
    @font-face { font-family:"Plus Jakarta Sans"; font-weight:800; src:url("${staticFile("fonts/jakarta-800.woff2")}") format("woff2"); }
  `}</style>
);

// Blendet die Einstellung in ihren ersten Bildern auf. Weil spätere Sequenzen
// über früheren liegen, ergibt das eine Kreuzblende.
const Aufblenden = ({ children, aktiv }) => {
  const frame = useCurrentFrame();
  const o = aktiv
    ? interpolate(frame, [0, BLENDE], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 1;
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
};

const Inhalt = ({ liste }) => {
  let von = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: FARBEN.dunkel }}>
      <Schriften />
      {liste.map((e, i) => {
        const start = i === 0 ? 0 : von - BLENDE;
        von = start + e.dauer;
        return (
          <Sequence key={i} from={start} durationInFrames={e.dauer}>
            <Aufblenden aktiv={i > 0}>
              {e.art === "titel" ? <Titel zeilen={e.zeilen} dauer={e.dauer} />
                : e.art === "ende" ? <Endtafel dauer={e.dauer} />
                : e.art === "karte" ? (
                  <AbsoluteFill>
                    <Karte clip={e.clip} ab={e.ab} dauer={e.dauer} />
                    {e.unterzeile ? <Unterzeile {...e.unterzeile} /> : null}
                  </AbsoluteFill>
                )
                : e.art === "nebeneinander" ? (
                  <AbsoluteFill>
                    <Nebeneinander links={e.links} rechts={e.rechts} dauer={e.dauer} />
                    {e.unterzeile ? <Unterzeile {...e.unterzeile} /> : null}
                  </AbsoluteFill>
                )
                : <Einstellung {...e} kinder={e.notiz ? <Notiz {...e.notiz} /> : null} />}
            </Aufblenden>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

const gesamt = (liste) => liste.reduce((n, e, i) => n + e.dauer - (i > 0 ? BLENDE : 0), 0);

// Loop fürs Autoplay: Hook, die beiden Momente mit Tippen, Plakat.
const LOOP = [EINSTELLUNGEN[0], ...EINSTELLUNGEN.filter((e) => e.clip === "04-palette"),
  ...EINSTELLUNGEN.filter((e) => e.clip === "09-ki").slice(1),
  EINSTELLUNGEN[EINSTELLUNGEN.length - 1]];

export const Root = () => (
  <>
    <Composition id="hero-full" component={Inhalt} defaultProps={{ liste: EINSTELLUNGEN }}
      durationInFrames={gesamt(EINSTELLUNGEN)} fps={FPS} width={BREITE} height={HOEHE} />
    <Composition id="hero-loop" component={Inhalt} defaultProps={{ liste: LOOP }}
      durationInFrames={gesamt(LOOP)} fps={FPS} width={BREITE} height={HOEHE} />
  </>
);
