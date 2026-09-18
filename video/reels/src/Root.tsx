import React from "react";
import { Composition } from "remotion";
import { FORMAT } from "./marke";
import { Gruesttest } from "./Gruesttest";
import { Reelprobe, probePlan } from "./Reelprobe";
import { reelMetadaten } from "./pruefung";
import { Bildaufbau } from "./Bildaufbau";

/**
 * Je Reel eine Composition. Die beiden Prüfstücke sind keine Reels:
 * `Gruesttest` zeigt Schrift, Text, Ton und Safe-Zone, `Reelprobe` setzt einen
 * echten Schnittplan mit herausgeschnittenen Pausen zusammen.
 */
export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="Gruesttest"
      component={Gruesttest}
      durationInFrames={90}
      fps={FORMAT.fps}
      width={FORMAT.breite}
      height={FORMAT.hoehe}
    />
    {/*
      Die Länge kommt aus dem Plan, und `calculateMetadata` prüft ihn dabei
      gegen das echte Quellmaterial. Ein Segment über das Ende der Quelle
      hinaus bricht den Render ab, statt Bildschnipsel zu erzeugen.
    */}
    <Composition
      id="Reelprobe"
      component={Reelprobe}
      fps={FORMAT.fps}
      width={FORMAT.breite}
      height={FORMAT.hoehe}
      durationInFrames={1}
      calculateMetadata={() => reelMetadaten(probePlan)}
    />
    <Composition
      id="Bildaufbau"
      component={Bildaufbau}
      durationInFrames={1}
      fps={FORMAT.fps}
      width={FORMAT.breite}
      height={FORMAT.hoehe}
      defaultProps={{ hilfslinien: false }}
    />
  </>
);
