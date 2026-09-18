import React from "react";
import { AbsoluteFill, Easing, OffthreadVideo, interpolate, staticFile, useCurrentFrame } from "remotion";
import { BUEHNE, FARBEN, FORMAT } from "../marke";
import { MAX_ZOOM } from "../kamera";

/**
 * Ein Sprech-Segment aus dem normalisierten Rohvideo.
 *
 * `vonSekunde` schneidet im Quellmaterial, die Länge gibt die umgebende
 * <Sequence> vor. Der Punch-in ist kein Dauerzoom: er fährt an und steht dann —
 * er kaschiert den Jump Cut am Schnitt und erzeugt Tempo, ohne zu wabern.
 */
export const Clip: React.FC<{
  datei: string;
  vonSekunde: number;
  /** Zoom am Anfang / am Ende der Fahrt. 1 = keine Bewegung. */
  zoomVon?: number;
  zoomBis?: number;
  /** Frames, die die Fahrt dauert. Danach steht das Bild. */
  fahrtFrames?: number;
  /** Bildausschnitt verschieben, z. B. wenn der Kopf zu weit unten sitzt. */
  versatzY?: number;
  lautstaerke?: number;
  /**
   * Zeigt das Sprecherbild als 4:5-Fläche im unteren Bildteil statt
   * formatfüllend. Darüber bleibt das Textband frei — siehe BUEHNE in marke.ts.
   */
  alsBuehne?: boolean;
}> = ({
  datei,
  vonSekunde,
  zoomVon = 1,
  zoomBis = 1,
  fahrtFrames = 45,
  versatzY = 0,
  lautstaerke = 1,
  alsBuehne = false,
}) => {
  const frame = useCurrentFrame();
  // Gedeckelt, damit ein Tippfehler im Schnittplan nicht in einem Close-up
  // endet. Im ersten echten Reel war genau das der Fehler.
  const von = Math.min(zoomVon, MAX_ZOOM);
  const bis = Math.min(zoomBis, MAX_ZOOM);
  const zoom =
    von === bis
      ? von
      : interpolate(frame, [0, fahrtFrames], [von, bis], {
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        });

  const video = (
    <OffthreadVideo
      src={staticFile(datei)}
      trimBefore={Math.round(vonSekunde * FORMAT.fps)}
      volume={lautstaerke}
      style={{ width: "100%", height: "100%", objectFit: "cover" }}
    />
  );

  if (!alsBuehne) {
    return (
      <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "black" }}>
        <AbsoluteFill style={{ transform: `scale(${zoom}) translateY(${versatzY}px)` }}>{video}</AbsoluteFill>
      </AbsoluteFill>
    );
  }

  // Der Ausschnitt wird über die Höhe gesteuert: Das Rohbild ist 9:16, die
  // Fläche 4:5 — das Video ist darin also höher als der Rahmen und wird oben
  // angesetzt, damit der Kopf drin bleibt und der Tisch unten wegfällt.
  const ueberhoehung = (FORMAT.hoehe / FORMAT.breite) / (BUEHNE.hoehe / BUEHNE.breite);

  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: BUEHNE.vonUnten }}>
      <div
        style={{
          width: BUEHNE.breite,
          height: BUEHNE.hoehe,
          borderRadius: BUEHNE.radius,
          overflow: "hidden",
          backgroundColor: FARBEN.tinte,
          boxShadow: "0 40px 90px -30px rgba(0,0,0,0.75)",
        }}
      >
        <div
          style={{
            width: "100%",
            height: `${ueberhoehung * 100}%`,
            transform: `scale(${zoom}) translateY(${versatzY - BUEHNE.ausschnittVonOben * BUEHNE.hoehe * ueberhoehung}px)`,
          }}
        >
          {video}
        </div>
      </div>
    </AbsoluteFill>
  );
};
