import React from "react";
import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";
import { SCHRIFT } from "./marke";

/**
 * Lädt beide Schriften einmal pro Bundle. `loadFont` hält den Render über
 * `delayRender` an, bis die Datei steht — der erste Frame erscheint also nie in
 * der Ersatzschrift.
 */
export const schriftenGeladen = Promise.all(
  Object.values(SCHRIFT).map((s) =>
    loadFont({
      family: s.family,
      url: staticFile(`schriften/${s.datei}`),
      weight: s.gewicht,
      format: "woff2",
    }),
  ),
);

/**
 * true, sobald beide Schriften stehen. Komponenten, die Textbreiten MESSEN
 * (fitText), müssen darauf warten: mit Ersatzschrift gemessene Größen sitzen
 * daneben.
 */
export const useSchriften = () => {
  const [bereit, setBereit] = React.useState(false);
  React.useEffect(() => {
    let aktiv = true;
    schriftenGeladen.then(() => {
      if (aktiv) setBereit(true);
    });
    return () => {
      aktiv = false;
    };
  }, []);
  return bereit;
};
