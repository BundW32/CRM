import type { Caption } from "@remotion/captions";
import type { Segment } from "./zeitachse";
import type { Zeile } from "./bausteine/KineticText";

/** Ein Klang aus public/sfx. Meme-Sounds gehören nicht zur Marke. */
export type Klang = "whoosh" | "whip" | "mouse-click" | "switch" | "ding" | "page-turn";

export type KineticMoment = {
  /** Beginn im fertigen Reel, in Sekunden. */
  abSekunde: number;
  dauerSekunden: number;
  zeilen: Zeile[];
  /**
   * Freigestelltes Video (VP9 mit Alpha) desselben Abschnitts. Liegt es vor,
   * wird es über den Text gelegt und die Person verdeckt Teile der Buchstaben.
   */
  freistellung?: string;
  vonOben?: number;
  ausrichtung?: "links" | "mitte";
};

export type BRollMoment = {
  abSekunde: number;
  dauerSekunden: number;
  datei: string;
  stil?: "rahmen" | "vollbild";
  ausschnitt?: { skalierung: number; versatzX?: number; versatzY?: number };
};

export type KlangMoment = {
  abSekunde: number;
  klang: Klang;
  lautstaerke?: number;
};

/**
 * Der komplette Schnitt eines Reels als Daten.
 *
 * Damit ist der Schnitt nachvollziehbar und wiederholbar: Wer eine Aussage
 * anders setzen will, ändert eine Zahl — nicht das Video. Und wenn neues
 * Rohmaterial kommt, bleibt der Plan lesbar, statt in einer Zeitleiste zu
 * verschwinden.
 */
export type ReelPlan = {
  titel: string;
  /** Die behaltenen Abschnitte des Rohmaterials, in Reihenfolge. */
  segmente: Segment[];
  /** Untertitel mit ROHZEITEN aus dem Transkript. Die Umrechnung macht das Reel. */
  untertitelRoh: Caption[];
  kinetic?: KineticMoment[];
  broll?: BRollMoment[];
  klaenge?: KlangMoment[];
  /** Punch-in je Segment, gleiche Reihenfolge wie `segmente`. */
  kamera?: { zoomVon?: number; zoomBis?: number; versatzY?: number }[];
  /**
   * „buehne": Sprecher als 4:5-Fläche unten, darüber freies Band für
   * Untertitel und Einblendungen. „vollbild": formatfüllend wie bisher.
   */
  bildaufbau?: "buehne" | "vollbild";
  /**
   * Bild hinter der Bühne, stark unscharf gezeichnet — eine Datei unter
   * public/. Ohne Angabe bleibt es beim dunklen Markenverlauf.
   */
  hintergrund?: string;
};
