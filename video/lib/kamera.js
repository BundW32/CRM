// Kamerafahrten und weiche Übergänge.
//
// Bis Fassung 2 gab es nur zwei Mittel: harter Schnitt und eine Zufahrt, die
// mittig ankommt. Beides zusammen wirkt abgehackt, sobald mehrere Szenen
// aufeinanderfolgen. Hier kommen die zwei fehlenden Werkzeuge dazu:
//
//   fahrt()   — eine Einstellung, in der die Kamera von Bildausschnitt A nach B
//               gleitet (Schwenk UND Zoom zugleich). Das ist der Unterschied
//               zwischen „Standbild mit Zoom" und „Kamera".
//   blende()  — kurze Kreuzblende zwischen zwei Einstellungen.
//
// Umgesetzt mit zoompan, weil crop seine Größe nicht je Bild ändern darf:
// zoompan nimmt z, x und y als Ausdrücke über der Bildnummer `on`.
const { execFileSync } = require("child_process");
const FF = require("ffmpeg-static");

// ease-in-out: langsam los, in der Mitte schnell, weich ankommen. Für eine
// Kamerafahrt ist das richtig — ease-out allein startet zu abrupt.
// ffmpeg kennt kein `? :` — Bedingungen laufen über if(cond, dann, sonst).
// Der Ternär-Operator kostete einen Fehlversuch: „Invalid chars at the end of
// expression".
const EASE = (p) => `(if(lt(${p},0.5), 2*pow(${p},2), 1-pow(-2*${p}+2,2)/2))`;

// von/nach: { z, cx, cy } — Zoomfaktor und Bildmitte in Anteilen der Quelle.
function fahrtFilter(von, nach, frames, W, H, FPS) {
  const p = `min(1,on/${frames})`;
  const e = EASE(p);
  const z = `(${von.z}+(${nach.z}-${von.z})*${e})`;
  const cx = `(${von.cx}+(${nach.cx}-${von.cx})*${e})`;
  const cy = `(${von.cy}+(${nach.cy}-${von.cy})*${e})`;
  // x/y sind die linke obere Ecke des Bildfensters in Quellkoordinaten.
  return (
    `zoompan=z='${z}':d=1:` +
    `x='max(0,min(iw-iw/zoom,${cx}*iw-(iw/zoom)/2))':` +
    `y='max(0,min(ih-ih/zoom,${cy}*ih-(ih/zoom)/2))':` +
    `s=${W}x${H}:fps=${FPS}`
  );
}

module.exports = { fahrtFilter, EASE };
