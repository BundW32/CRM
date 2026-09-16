import React from "react";
import { Composition } from "remotion";
import { FORMAT } from "./marke";
import { Gruesttest } from "./Gruesttest";

/**
 * Je Reel eine Composition. `Gruesttest` ist kein Reel, sondern der Nachweis,
 * dass die Kette steht: Schrift, Kinetic-Text, Untertitel, Klang, Safe-Zone.
 */
export const RemotionRoot: React.FC = () => (
  <Composition
    id="Gruesttest"
    component={Gruesttest}
    durationInFrames={90}
    fps={FORMAT.fps}
    width={FORMAT.breite}
    height={FORMAT.hoehe}
  />
);
