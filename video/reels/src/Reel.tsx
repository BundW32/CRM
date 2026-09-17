import React from "react";
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from "remotion";
import { createTikTokStyleCaptions } from "@remotion/captions";
import { FORMAT, LAUTSTAERKE } from "./marke";
import { bauZeitachse, reelDauerMs, untertitelUmrechnen } from "./zeitachse";
import type { ReelPlan } from "./plan";
import { Clip } from "./bausteine/Clip";
import { KineticText } from "./bausteine/KineticText";
import { Mockup } from "./bausteine/Mockup";
import { Untertitel } from "./bausteine/Untertitel";

const frames = (sekunden: number) => Math.round(sekunden * FORMAT.fps);

/**
 * Setzt einen Schnittplan zum Reel zusammen.
 *
 * Reihenfolge der Ebenen, von unten nach oben:
 *   1. die Sprech-Segmente (der eigentliche Schnitt, mit Punch-in)
 *   2. B-Roll, die einzelne Segmente überdeckt
 *   3. große Kinetic-Texte
 *   4. die freigestellte Person, damit der Text hinter ihr liegt
 *   5. Wort-für-Wort-Untertitel
 *   6. Klangakzente
 *
 * Während ein Kinetic-Text steht, bleiben die Untertitel aus — zwei Textebenen
 * gleichzeitig liest niemand.
 */
export const Reel: React.FC<{ plan: ReelPlan }> = ({ plan }) => {
  const achse = bauZeitachse(plan.segmente);
  const untertitel = untertitelUmrechnen(plan.untertitelRoh, achse);
  const { pages } = createTikTokStyleCaptions({
    captions: untertitel,
    combineTokensWithinMilliseconds: 900,
    breakOnSilenceAfterMilliseconds: 400,
  });

  const kinetic = plan.kinetic ?? [];

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {achse.map((a, i) => {
        const kamera = plan.kamera?.[i] ?? {};
        return (
          <Sequence
            key={`segment-${a.reelVonMs}`}
            from={frames(a.reelVonMs / 1000)}
            durationInFrames={frames((a.rohBisMs - a.rohVonMs) / 1000)}
            layout="none"
          >
            <Clip
              datei={a.datei}
              vonSekunde={a.rohVonMs / 1000}
              zoomVon={kamera.zoomVon ?? 1}
              zoomBis={kamera.zoomBis ?? 1}
              versatzY={kamera.versatzY ?? 0}
              lautstaerke={LAUTSTAERKE.stimme}
            />
          </Sequence>
        );
      })}

      {(plan.broll ?? []).map((b) => (
        <Sequence
          key={`broll-${b.abSekunde}-${b.datei}`}
          from={frames(b.abSekunde)}
          durationInFrames={frames(b.dauerSekunden)}
          layout="none"
        >
          <Mockup datei={b.datei} stil={b.stil} ausschnitt={b.ausschnitt} />
        </Sequence>
      ))}

      {kinetic.map((k) => (
        <Sequence
          key={`kinetic-${k.abSekunde}`}
          from={frames(k.abSekunde)}
          durationInFrames={frames(k.dauerSekunden)}
          layout="none"
        >
          <KineticText zeilen={k.zeilen} vonOben={k.vonOben} ausrichtung={k.ausrichtung} />
          {k.freistellung ? (
            <AbsoluteFill>
              <OffthreadVideo
                src={staticFile(k.freistellung)}
                transparent
                muted
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </AbsoluteFill>
          ) : null}
        </Sequence>
      ))}

      <UntertitelSpur seiten={pages} kinetic={kinetic} />

      {(plan.klaenge ?? []).map((k) => (
        <Sequence key={`klang-${k.abSekunde}-${k.klang}`} from={frames(k.abSekunde)} durationInFrames={frames(2)}>
          <Audio src={staticFile(`sfx/${k.klang}.wav`)} volume={k.lautstaerke ?? LAUTSTAERKE.whoosh} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

/** Blendet die Untertitel aus, solange ein großer Kinetic-Text steht. */
const UntertitelSpur: React.FC<{
  seiten: ReturnType<typeof createTikTokStyleCaptions>["pages"];
  kinetic: NonNullable<ReelPlan["kinetic"]>;
}> = ({ seiten, kinetic }) => {
  const frame = useCurrentFrame();
  const aus = kinetic.some(
    (k) => frame >= frames(k.abSekunde) && frame < frames(k.abSekunde + k.dauerSekunden),
  );
  return <Untertitel seiten={seiten} aus={aus} />;
};

/** Die Reellänge steht im Plan, nicht in der Composition. */
export const reelLaengeInFrames = (plan: ReelPlan) =>
  Math.max(1, frames(reelDauerMs(bauZeitachse(plan.segmente)) / 1000));
