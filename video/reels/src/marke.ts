/**
 * Marken- und Formatvorgaben für die Instagram-Reels.
 *
 * Farben stammen aus portal/src/app/globals.css (Tokens --color-wp-*). Wer dort
 * umfärbt, ändert hier mit — die Werte sind bewusst kopiert und nicht verlinkt,
 * damit ein Renderlauf nicht vom Portal-Build abhängt.
 */

export const FARBEN = {
  gruen: "#003630",
  gruenHell: "#0c534a",
  tinte: "#00241f",
  orange: "#f69018",
  orangeDunkel: "#dd7d0c",
  orangeHell: "#fef1e0",
  /** Orange als Text auf HELLEN Flächen – das Markenorange schafft dort keine 4,5:1. */
  orangeAufHell: "#8f5407",
  weiss: "#ffffff",
  /** Nur für Warnungen, Fristen, Fehler – sparsam. */
  warnung: "#c23b2e",
} as const;

export const FORMAT = {
  breite: 1080,
  hoehe: 1920,
  fps: 30,
} as const;

/**
 * Instagram legt eigene Bedienelemente über das Video. Innerhalb dieser Ränder
 * steht kein wichtiger Text.
 */
export const SAFE_ZONE = {
  oben: 250,
  unten: 380,
  rechts: 140,
  links: 60,
} as const;

/**
 * Schriften liegen lokal unter public/schriften. Sie werden NICHT zur Renderzeit
 * aus dem Netz geladen: der Render-Browser kennt die Proxy-CA dieser Umgebung
 * nicht, fonts.gstatic.com scheitert dort mit ERR_CERT_AUTHORITY_INVALID.
 * Nachladen erledigt werkzeuge/material-laden.mjs vor dem Rendern.
 *
 * Family-Namen bleiben einwortig: "Source Sans 3 Black" wäre als unquotierter
 * CSS-Bezeichner ungültig (Ziffer als eigenes Wort) und fällt still auf eine
 * Serifenschrift zurück.
 */
export const SCHRIFT = {
  /** Große Kinetic-Texte und Untertitel. */
  display: { family: "MontserratBlack", datei: "montserrat-900.woff2", gewicht: "900" },
  /** Kleine Beischriften, Inserts, Quellenangaben. */
  text: { family: "SourceSansSemibold", datei: "sourcesans3-600.woff2", gewicht: "600" },
} as const;

/**
 * Der Sprecher füllt NICHT das ganze Bild.
 *
 * Alex' Beobachtung am zweiten Reel: Die Untertitel standen entweder direkt vor
 * seinem Gesicht oder waren ganz verdeckt, und für Einblendungen blieb kein
 * Platz. Ursache ist der Bildaufbau — ein formatfüllendes Hochkant-Porträt
 * lässt oben nichts frei.
 *
 * Bloßes Verkleinern reicht dafür nicht: Ein 9:16-Bild in einem 9:16-Rahmen
 * schrumpft in beide Richtungen, das Band oben bliebe schmal. Das Sprecherbild
 * wird deshalb auf 4:5 BESCHNITTEN und sitzt als Fläche unten — so werden aus
 * dem Rest 425 px freies Band, genug für zwei Zeilen großer Untertitel.
 */
export const BUEHNE = {
  breite: 900,
  hoehe: 1125,
  /** Abstand der Unterkante vom unteren Bildrand. */
  vonUnten: 120,
  /** Abgerundete Ecken, damit die Fläche als Gestaltung gelesen wird. */
  radius: 44,
  /**
   * Welcher senkrechte Ausschnitt des Rohbildes gezeigt wird, von oben gerechnet
   * (0 = Bildoberkante). 0.06 lässt etwas Luft über dem Kopf und schneidet unten
   * den Tisch weg. Je nach Aufnahme im Schnittplan nachjustieren.
   */
  ausschnittVonOben: 0.06,
} as const;

/** Das freie Band über der Bühne — hier stehen Untertitel und Einblendungen. */
export const TEXTBAND = {
  oben: SAFE_ZONE.oben,
  unten: FORMAT.hoehe - BUEHNE.vonUnten - BUEHNE.hoehe,
} as const;

/** Tonhöhen relativ zur Stimme – die Stimme bleibt immer vorn. */
export const LAUTSTAERKE = {
  stimme: 1,
  whoosh: 0.28,
  klick: 0.22,
  ding: 0.25,
} as const;
