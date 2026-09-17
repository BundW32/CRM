import React from "react";
import { Composition } from "remotion";
import { FORMAT } from "./marke";
import { Gruesttest } from "./Gruesttest";
import { Reelprobe, probePlan } from "./Reelprobe";
import { reelLaengeInFrames } from "./Reel";

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
    <Composition
      id="Reelprobe"
      component={Reelprobe}
      durationInFrames={reelLaengeInFrames(probePlan)}
      fps={FORMAT.fps}
      width={FORMAT.breite}
      height={FORMAT.hoehe}
    />
  </>
);
