// Erzeugt `public/lottie/haus-aufbau.json` – das Comic-Haus der Startseite als
// Lottie-Animation (Bodymovin-Format, Version 5.7.4).
//
// Warum ein Generator und keine handgezeichnete Datei aus einem Grafikprogramm:
// Das Haus trägt Markenfarben und eine feste Geometrie, die auch die statische
// SVG-Fassung in `components/marketing/scrolly-build.tsx` verwendet. Beide aus
// derselben Zahlenquelle zu speisen ist der einzige Weg, sie deckungsgleich zu
// halten. Wer die Marke umfärbt oder das Haus umbaut, ändert es hier und lässt
//     node scripts/build-haus-lottie.mjs
// neu laufen. Die erzeugte JSON-Datei liegt im Repo (kein fremder CDN, keine
// Datenübertragung an Dritte beim Seitenaufruf).
//
// Zeitachse: 6 Bauphasen à 100 Bilder, 60 fps, also 600 Bilder. Die Animation
// läuft NICHT von selbst – die Seite setzt das Bild aus dem Scroll-Fortschritt
// (`progress * 600`). Phase s liegt damit auf den Bildern [s·100, (s+1)·100],
// genau wie `appear(s)` in der SVG-Fassung.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HIER = dirname(fileURLToPath(import.meta.url));
const ZIEL = join(HIER, "..", "public", "lottie", "haus-aufbau.json");

const FPS = 60;
const PHASEN = 6;
const PRO_PHASE = 100;
const ENDE = PHASEN * PRO_PHASE; // 600
const DACH_AB = 4 * PRO_PHASE; // Bewohner ziehen ein
const FERTIG_AB = 5 * PRO_PHASE; // Fahne, Rauch, Katze, Funkeln

// ── Farben ───────────────────────────────────────────────────────────────
// Dieselben vier Grundtöne wie die SVG-Fassung. Sie stehen als feste Werte da
// und nicht als CSS-Variablen: Lottie kennt keine Variablen, die Datei muss die
// Farbe mitbringen.
const OUTLINE = "#00241f"; // wp-ink
const FACADE = "#fbf3e0";
const GLAS_AUS = "#cfe0dd";
const GLAS_AN = "#ffd489";
const TRIM = "#003630"; // wp-primary – Kran, Tür, Blumenkasten
const ACCENT = "#f69018"; // wp-accent – Dach, Fahne
const ACCENT_DUNKEL = "#dd7d0c";
const LAUB_HELL = "#3c9a6e";
const LAUB_DUNKEL = "#2e7d5b";
const STAMM = "#8a5a33";
const SOCKEL = "#e5dcc8";
const SOCKEL_TIEF = "#b7ad97";
const HAUT = "#f2c9a0";
const ZIEGEL = "#b34a19";
const ZIEGEL_TIEF = "#8a3a14";
const RAUCH = "#94a3b8";
const KATZE = "#143b34";

const farbe = (hex) => [
  parseInt(hex.slice(1, 3), 16) / 255,
  parseInt(hex.slice(3, 5), 16) / 255,
  parseInt(hex.slice(5, 7), 16) / 255,
  1,
];

// ── Bausteine des Lottie-Formats ─────────────────────────────────────────
// Innerhalb einer Gruppe malt Lottie von hinten nach vorn: Der LETZTE Eintrag
// liegt unten. Deshalb steht die Reihenfolge [Form, Kontur, Füllung, Transform]
// – die Kontur liegt über der Füllung, so wie im Comic-Stil gewollt.

const rechteck = (x, y, w, h, r = 0) => ({
  ty: "rc",
  p: { a: 0, k: [x + w / 2, y + h / 2] },
  s: { a: 0, k: [w, h] },
  r: { a: 0, k: r },
  d: 1,
});

const ellipse = (cx, cy, rx, ry = rx) => ({
  ty: "el",
  p: { a: 0, k: [cx, cy] },
  s: { a: 0, k: [rx * 2, ry * 2] },
  d: 1,
});

/**
 * Pfad aus Stützpunkten. Jeder Punkt ist [x, y] oder
 * [x, y, [einX, einY], [ausX, ausY]] für gebogene Übergänge (Tangenten
 * relativ zum Punkt, wie im Bodymovin-Format).
 */
const pfad = (punkte, geschlossen = true) => ({
  ty: "sh",
  ks: {
    a: 0,
    k: {
      v: punkte.map((p) => [p[0], p[1]]),
      i: punkte.map((p) => p[2] ?? [0, 0]),
      o: punkte.map((p) => p[3] ?? [0, 0]),
      c: geschlossen,
    },
  },
});

const fuellung = (hex, deckkraft = 100) => ({
  ty: "fl",
  c: { a: 0, k: farbe(hex) },
  o: { a: 0, k: deckkraft },
  r: 1,
});

const kontur = (hex, breite, rund = true) => ({
  ty: "st",
  c: { a: 0, k: farbe(hex) },
  o: { a: 0, k: 100 },
  w: { a: 0, k: breite },
  lc: rund ? 2 : 1,
  lj: rund ? 2 : 1,
});

const EINHEITS_TRANSFORM = {
  ty: "tr",
  p: { a: 0, k: [0, 0] },
  a: { a: 0, k: [0, 0] },
  s: { a: 0, k: [100, 100] },
  r: { a: 0, k: 0 },
  o: { a: 0, k: 100 },
  sk: { a: 0, k: 0 },
  sa: { a: 0, k: 0 },
};

/** Gruppe: Formen plus Stil, in Malreihenfolge. */
const gruppe = (...eintraege) => ({
  ty: "gr",
  it: [...eintraege, { ...EINHEITS_TRANSFORM }],
  nm: "gr",
});

/** Fläche mit Kontur – der Regelfall dieser Zeichnung. */
const flaeche = (form, fuellHex, konturBreite = 3, konturHex = OUTLINE) =>
  konturBreite > 0
    ? gruppe(form, kontur(konturHex, konturBreite), fuellung(fuellHex))
    : gruppe(form, fuellung(fuellHex));

/** Reine Linie ohne Füllung. */
const linie = (punkte, hex, breite) =>
  gruppe(pfad(punkte, false), kontur(hex, breite));

// ── Zeitachse ────────────────────────────────────────────────────────────
// `--ease-mk-out` = cubic-bezier(0.16, 1, 0.3, 1). In Lottie beschreibt `o` den
// Ausgang des ersten und `i` den Eingang des zweiten Stützpunkts.
const AUS = { x: [0.16], y: [1] };
const EIN = { x: [0.3], y: [1] };
const AUS_LINEAR = { x: [0.5], y: [0] };
const EIN_LINEAR = { x: [0.5], y: [1] };

/** Skalarer Verlauf (Deckkraft, Drehung) über Stützpunkte [Bild, Wert]. */
const verlauf = (punkte, weich = true) => ({
  a: 1,
  k: punkte.map(([t, wert], i) =>
    i === punkte.length - 1
      ? { t, s: [wert] }
      : { t, s: [wert], o: weich ? AUS : AUS_LINEAR, i: weich ? EIN : EIN_LINEAR },
  ),
});

/** Verlauf einer Position über Stützpunkte [Bild, [x, y]]. */
const posVerlauf = (punkte) => ({
  a: 1,
  k: punkte.map(([t, wert], i) =>
    i === punkte.length - 1
      ? { t, s: wert }
      : { t, s: wert, o: AUS, i: EIN },
  ),
});

/** Farbverlauf einer Füllung über Stützpunkte [Bild, hex]. */
const farbVerlauf = (punkte) => ({
  a: 1,
  k: punkte.map(([t, hex], i) =>
    i === punkte.length - 1
      ? { t, s: farbe(hex) }
      : { t, s: farbe(hex), o: AUS_LINEAR, i: EIN_LINEAR },
  ),
});

let indexZaehler = 0;

/**
 * Eine Bauphase als eigene Ebene. Sie gleitet um 46 px von unten herein und
 * blendet dabei auf – dieselbe Bewegung wie `rise(s)` in der SVG-Fassung.
 */
const bauEbene = (name, phase, formen, extras = {}) => {
  const start = phase * PRO_PHASE;
  const fertig = start + PRO_PHASE;
  return {
    ddd: 0,
    ind: ++indexZaehler,
    ty: 4,
    nm: name,
    sr: 1,
    ao: 0,
    ks: {
      o: extras.o ?? verlauf([[start, 0], [fertig, 100]]),
      r: { a: 0, k: 0 },
      p: posVerlauf([[start, [0, 46]], [fertig, [0, 0]]]),
      a: { a: 0, k: [0, 0] },
      s: { a: 0, k: [100, 100] },
    },
    shapes: formen,
    ip: 0,
    op: ENDE + 1,
    st: 0,
    bm: 0,
  };
};

/** Ebene ohne Einschwebe-Bewegung – nur Deckkraft (Fahne, Rauch, Funkeln). */
const stilleEbene = (name, formen, deckkraft) => ({
  ddd: 0,
  ind: ++indexZaehler,
  ty: 4,
  nm: name,
  sr: 1,
  ao: 0,
  ks: {
    o: deckkraft,
    r: { a: 0, k: 0 },
    p: { a: 0, k: [0, 0] },
    a: { a: 0, k: [0, 0] },
    s: { a: 0, k: [100, 100] },
  },
  shapes: formen,
  ip: 0,
  op: ENDE + 1,
  st: 0,
  bm: 0,
});

// ── Fenster ──────────────────────────────────────────────────────────────
// `appear(s)` läuft mit easeOut(t) = 1 − (1 − t)³ durch die Phase. Ein Fenster
// geht an, sobald round(appear · anzahl) > index, also bei
// appear = (index + 0.5) / anzahl. Umgekehrt aufgelöst ergibt das das Bild, auf
// dem das Licht angeht – so gehen die Lichter über den Scroll gleichmäßig an
// und nicht alle am Phasenende auf einmal.
const lichtBild = (phase, anzahl, index) => {
  const ziel = (index + 0.5) / anzahl;
  const t = 1 - Math.cbrt(1 - ziel);
  return Math.round(phase * PRO_PHASE + t * PRO_PHASE);
};

/**
 * Comic-Fenster mit Kreuzsprosse. `an` ist das Bild, ab dem warmes Licht
 * brennt; davor liegt kaltes Glas. Der Schein ist eine größere, weiche
 * Akzentfläche dahinter – Lottie-Ebeneneffekte (Schlagschatten) kennt der
 * schlanke Player nicht, im flachen Comic-Stil liest sich die Fläche ohnehin
 * besser als ein Weichzeichner.
 */
const fenster = (x, y, an, w = 30, h = 42) => {
  const schein = gruppe(
    rechteck(x - 7, y - 7, w + 14, h + 14, 11),
    { ...fuellung(ACCENT), o: verlauf([[an - 1, 0], [an + 14, 34]]) },
  );
  const glas = gruppe(
    rechteck(x + 3.5, y + 3.5, w - 7, h - 7, 2),
    { ...fuellung(GLAS_AUS), c: farbVerlauf([[an - 1, GLAS_AUS], [an + 12, GLAS_AN]]) },
  );
  return [
    // Kreuzsprosse zuletzt anlegen heißt: sie liegt vorn.
    linie([[x + w / 2, y + 3], [x + w / 2, y + h - 3]], OUTLINE, 2.5),
    linie([[x + 3, y + h / 2], [x + w - 3, y + h / 2]], OUTLINE, 2.5),
    glas,
    flaeche(rechteck(x, y, w, h, 4), OUTLINE, 0),
    schein,
  ];
};

/** Blumenkasten unter einem Fenster. */
const blumenkasten = (x, y, w = 34) => [
  ...[0.2, 0.5, 0.8].map((f) => flaeche(ellipse(x + w * f, y - 2, 3.2), ACCENT, 0)),
  flaeche(rechteck(x, y, w, 7, 2.5), TRIM, 2),
];

// ── Phase 0: Grundstück, Fundament, Kran ─────────────────────────────────
const grundstueck = [
  // Fundament liegt vorn, Bewuchs dahinter, Bodenschatten ganz hinten.
  flaeche(rechteck(226, 422, 16, 8, 2), SOCKEL_TIEF, 0),
  flaeche(rechteck(78, 422, 16, 8, 2), SOCKEL_TIEF, 0),
  flaeche(rechteck(56, 412, 208, 30, 4), SOCKEL, 3),
  // Baum rechts
  flaeche(ellipse(290, 386, 11), LAUB_DUNKEL, 2.5),
  flaeche(ellipse(262, 388, 12), LAUB_DUNKEL, 2.5),
  flaeche(ellipse(276, 396, 19), LAUB_HELL, 2.5),
  flaeche(rechteck(272, 408, 8, 36), STAMM, 2),
  // Busch links
  flaeche(ellipse(26, 437, 10), LAUB_DUNKEL, 2.5),
  flaeche(ellipse(40, 430, 15), LAUB_HELL, 2.5),
  // Geländelinie und Bodenschatten
  linie([[14, 444], [306, 444]], OUTLINE, 3),
  gruppe(ellipse(160, 448, 150, 11), { ...fuellung(TRIM), o: { a: 0, k: 10 } }),
];

const kran = [
  // Seil und Haken
  flaeche(pfad([[204, 148], [216, 148], [214, 158], [206, 158]]), ACCENT, 2),
  linie([[210, 105], [210, 148]], OUTLINE, 2),
  // Abspannung, Gegengewicht, Ausleger
  linie([[301, 98], [252, 80], [196, 98]], TRIM, 3),
  flaeche(rechteck(306, 105, 12, 14), ACCENT, 2),
  flaeche(rechteck(190, 98, 128, 7), TRIM, 0),
  // Turm mit Kreuzstreben
  ...[150, 230, 320].flatMap((y) => [
    linie([[297, y], [305, y + 30]], FACADE, 2),
    linie([[305, y], [297, y + 30]], FACADE, 2),
  ]),
  flaeche(rechteck(297, 104, 8, 330), TRIM, 0),
];

// ── Phase 1: Erdgeschoss ─────────────────────────────────────────────────
const erdgeschoss = [
  ...fenster(208, 344, lichtBild(1, 2, 1), 34, 46),
  ...fenster(78, 344, lichtBild(1, 2, 0), 34, 46),
  flaeche(ellipse(160, 419, 24, 4), "#d8cfba", 2),
  // Hausnummer 12 – Gruß an die WEG Musterstraße 12. Die Ziffern sind als
  // Pfad gezeichnet und nicht als Textebene: So braucht die Datei keine
  // Schrift mitzuliefern.
  linie([[190, 357], [192, 356], [192, 364]], OUTLINE, 2),
  linie([[195, 357], [199, 357], [199, 360], [195, 360], [195, 364], [199, 364]], OUTLINE, 2),
  flaeche(rechteck(184, 352, 20, 15, 3), "#ffffff", 2),
  // Tür mit Rundbogen (Radius 16 um 160,366 – Bezier-Näherung k = 0.5523·16)
  flaeche(ellipse(170, 386, 2.8), ACCENT, 0),
  flaeche(
    pfad([
      [144, 414],
      [144, 366, [0, 0], [0, -8.84]],
      [160, 350, [-8.84, 0], [8.84, 0]],
      [176, 366, [0, -8.84], [0, 0]],
      [176, 414],
    ]),
    TRIM,
    3,
  ),
  flaeche(rechteck(60, 322, 200, 94, 6), FACADE, 3),
];

// ── Phase 2: 1. Obergeschoss ─────────────────────────────────────────────
const obergeschoss1 = [
  ...blumenkasten(143, 299),
  ...fenster(212, 256, lichtBild(2, 3, 2)),
  ...fenster(145, 256, lichtBild(2, 3, 1)),
  ...fenster(78, 256, lichtBild(2, 3, 0)),
  flaeche(rechteck(60, 234, 200, 92, 6), FACADE, 3),
];

// ── Phase 3: 2. Obergeschoss samt Katze ──────────────────────────────────
const katze = gruppe(
  ...[
    pfad([[153, 206], [156.5, 199], [160, 206]]),
    pfad([[162, 206], [165.5, 199], [169, 206]]),
    ellipse(161, 209, 5.5),
  ],
  fuellung(KATZE),
);

const katzenSchwanz = {
  ...linie(
    [
      [167, 208, [0, 0], [4, -1.3]],
      [173, 200, [0, 5.3], [0, 0]],
    ],
    KATZE,
    2.5,
  ),
};

const obergeschoss2 = [
  // Die Katze setzt sich erst bei Fertigstellung ins Fenster. Sie sitzt in
  // dieser Ebene, damit sie mit dem Stockwerk mitschwebt; ihre Deckkraft
  // steuert eine eigene Gruppe.
  gruppe(
    { ty: "gr", it: [katze, katzenSchwanz, { ...EINHEITS_TRANSFORM }], nm: "katze" },
    {
      ...EINHEITS_TRANSFORM,
      o: verlauf([[FERTIG_AB, 0], [FERTIG_AB + 36, 100]]),
    },
  ),
  ...blumenkasten(210, 211),
  ...blumenkasten(76, 211),
  ...fenster(212, 168, lichtBild(3, 3, 2)),
  ...fenster(145, 168, lichtBild(3, 3, 1)),
  ...fenster(78, 168, lichtBild(3, 3, 0)),
  flaeche(rechteck(60, 146, 200, 92, 6), FACADE, 3),
];

// ── Phase 4: Dach, Schornstein, Dachfenster, Bewohner ────────────────────
const bewohner = gruppe(
  {
    ty: "gr",
    nm: "bewohner",
    it: [
      flaeche(ellipse(130.5, 390, 5.5), HAUT, 2),
      flaeche(rechteck(124, 396, 13, 18, 6), ACCENT, 2),
      flaeche(ellipse(111.5, 383, 7), HAUT, 2),
      flaeche(rechteck(104, 390, 15, 24, 7), TRIM, 2),
      { ...EINHEITS_TRANSFORM },
    ],
  },
  {
    ...EINHEITS_TRANSFORM,
    o: verlauf([[DACH_AB, 0], [DACH_AB + 40, 100]]),
    // Leichtes Aufsetzen statt hartem Einblenden – die Gemeinschaft zieht ein.
    p: posVerlauf([[DACH_AB, [0, 10]], [DACH_AB + 40, [0, 0]]]),
  },
);

const dachfensterSchein = gruppe(ellipse(160, 116, 21), {
  ...fuellung(ACCENT),
  o: verlauf([[FERTIG_AB, 0], [FERTIG_AB + 30, 38]]),
});

const dach = [
  bewohner,
  // Dachfenster mit Kreuzsprosse
  linie([[151, 116], [169, 116]], OUTLINE, 2.5),
  linie([[160, 107], [160, 125]], OUTLINE, 2.5),
  gruppe(ellipse(160, 116, 10), {
    ...fuellung(GLAS_AUS),
    c: farbVerlauf([[FERTIG_AB, GLAS_AUS], [FERTIG_AB + 30, GLAS_AN]]),
  }),
  flaeche(ellipse(160, 116, 14), OUTLINE, 0),
  dachfensterSchein,
  // Traufe und Satteldach
  flaeche(rechteck(48, 144, 224, 11, 4), ACCENT_DUNKEL, 3),
  flaeche(pfad([[44, 150], [160, 62], [276, 150]]), ACCENT, 3.5),
  // Schornstein
  flaeche(rechteck(211, 66, 36, 11, 3), ZIEGEL_TIEF, 3),
  flaeche(rechteck(216, 74, 26, 52), ZIEGEL, 3),
];

// ── Fertigstellung: Fahne, Rauch, Funkeln ────────────────────────────────
// Die Fahne weht und der Rauch steigt, solange die letzte Phase durchlaufen
// wird. Weil das Bild am Scroll hängt, ist das keine Endlosschleife, sondern
// Bewegung, die der Leser selbst auslöst – gewollt: Sie hört auf, wenn er
// stehen bleibt, und lenkt nicht vom Text daneben ab.
const fahne = stilleEbene(
  "fahne",
  [
    {
      ty: "gr",
      nm: "tuch",
      it: [
        pfad([[160, 32], [188, 40], [160, 48]]),
        kontur(OUTLINE, 2.5),
        fuellung(ACCENT),
        {
          ...EINHEITS_TRANSFORM,
          a: { a: 0, k: [160, 40] },
          p: { a: 0, k: [160, 40] },
          // Drei Wellen über die letzte Phase – Drehung um den Mast.
          r: verlauf(
            [
              [FERTIG_AB, 0],
              [FERTIG_AB + 25, -7],
              [FERTIG_AB + 50, 5],
              [FERTIG_AB + 75, -5],
              [ENDE, 0],
            ],
            false,
          ),
        },
      ],
    },
    linie([[160, 62], [160, 30]], OUTLINE, 3),
  ],
  verlauf([[FERTIG_AB, 0], [FERTIG_AB + 30, 100]]),
);

// Rauchfahne: fünf Wölkchen, alle 20 Bilder eines. Sie starten dicht über der
// Schornsteinkrone (y = 66) und werden beim Aufsteigen größer und blasser. Der
// Versatz ist so gewählt, dass am Ende der Zeitachse noch zwei unterwegs sind –
// das Standbild bei 100 % zeigt also eine lebende Fahne und keinen toten Kamin.
const rauch = stilleEbene(
  "rauch",
  [0, 20, 40, 60, 80].map((ab) => ({
    ty: "gr",
    nm: "puff",
    it: [
      ellipse(229, 58, 5),
      { ...fuellung(RAUCH), o: { a: 0, k: 55 } },
      {
        ...EINHEITS_TRANSFORM,
        a: { a: 0, k: [229, 58] },
        p: posVerlauf([
          [FERTIG_AB + ab, [229, 62]],
          [FERTIG_AB + ab + 70, [221, 14]],
        ]),
        s: {
          a: 1,
          k: [
            { t: FERTIG_AB + ab, s: [40, 40], o: AUS_LINEAR, i: EIN_LINEAR },
            { t: FERTIG_AB + ab + 70, s: [165, 165] },
          ],
        },
        o: verlauf(
          [
            [FERTIG_AB + ab, 0],
            [FERTIG_AB + ab + 18, 100],
            [FERTIG_AB + ab + 70, 0],
          ],
          false,
        ),
      },
    ],
  })),
  verlauf([[FERTIG_AB - 10, 0], [FERTIG_AB + 10, 100]]),
);

// Funkeln, Erfolgs-Schein, Info-Chip und die „Fertig"-Plakette stecken NICHT in
// dieser Datei: Sie liegen als HTML über der Zeichnung (siehe `HausAufbau` in
// `scrolly-build.tsx`). Die Trennung ist bewusst und die Regel für diese Datei:
// Lottie ersetzt genau die Zeichnung, nichts darüber hinaus. Alles, was Text
// trägt, bleibt im Dokument – lesbar für Suchmaschinen und Screenreader.

// ── Ebenen in Malreihenfolge (Index 1 liegt vorn) ────────────────────────
const ebenen = [
  fahne,
  rauch,
  bauEbene("dach", 4, dach),
  bauEbene("obergeschoss-2", 3, obergeschoss2),
  bauEbene("obergeschoss-1", 2, obergeschoss1),
  bauEbene("erdgeschoss", 1, erdgeschoss),
  bauEbene("grundstueck", 0, grundstueck),
  // Der Kran steht hinter dem Haus und verschwindet, sobald es fertig ist.
  bauEbene("kran", 0, kran, {
    o: verlauf([[0, 0], [PRO_PHASE, 100], [FERTIG_AB, 100], [FERTIG_AB + 40, 0]], false),
  }),
];

const animation = {
  v: "5.7.4",
  fr: FPS,
  ip: 0,
  op: ENDE + 1,
  w: 320,
  h: 470,
  nm: "wegportal24 – Haus baut sich auf",
  ddd: 0,
  assets: [],
  layers: ebenen,
};

mkdirSync(dirname(ZIEL), { recursive: true });
writeFileSync(ZIEL, JSON.stringify(animation));
const groesse = JSON.stringify(animation).length;
console.log(`geschrieben: ${ZIEL} (${ebenen.length} Ebenen, ${(groesse / 1024).toFixed(1)} kB)`);
