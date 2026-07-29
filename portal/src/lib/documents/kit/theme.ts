// Eine Wahrheit für Maße, Farben und Schriftgrößen aller erzeugten Dokumente.
//
// Vorher standen dieselben Konstanten in zehn Generatoren nebeneinander — mit
// Abweichungen, die niemand beabsichtigt hatte: drei verschiedene Ränder und
// elf Schriftgrößen, teils im selben Dokument.
import { rgb } from "pdf-lib";

/** Punkt je Millimeter. A4 ist 210 × 297 mm = 595,28 × 841,89 pt. */
export const mm = (value: number): number => (value * 841.89) / 297;

export const PAGE = { width: mm(210), height: mm(297) } as const;

// DIN 5008 Form B — die Maße, an denen ein Fensterumschlag hängt.
export const DIN = {
  /** Linke Kante von Anschriftfeld UND Satzspiegel. */
  marginLeft: mm(20),
  marginRight: mm(20),
  /** Oberkante des Anschriftfelds. */
  addressFieldTop: mm(45),
  /** Zusatz- und Vermerkzone: 45 mm bis 62,7 mm. */
  noteZoneHeight: mm(17.7),
  /** Hier beginnt die Anschrift selbst. */
  addressZoneTop: mm(45 + 17.7),
  addressZoneHeight: mm(22.3),
  addressFieldWidth: mm(85),
  addressLineHeight: mm(4.23),
  /** Höhe der Betreffzeile. */
  subjectTop: mm(98.4),
  foldMark1: mm(87),
  foldMark2: mm(192),
  holeMark: mm(148.5),
  /** Oberkante der Fußzeile. */
  footerTop: mm(272),
} as const;

export const CONTENT_WIDTH = PAGE.width - DIN.marginLeft - DIN.marginRight; // 170 mm
/** Zeilenlänge für Fließtext. Die vollen 170 mm lesen sich bei 10 pt zu breit. */
export const MEASURE = mm(150);

export const color = {
  /** Vorgabe; je Mandant überschrieben aus branding.primaryColor. */
  brand: rgb(0, 0.21, 0.19),
  ink: rgb(0.11, 0.12, 0.12),
  muted: rgb(0.42, 0.44, 0.44),
  hair: rgb(0.82, 0.82, 0.8),
  panel: rgb(0.957, 0.953, 0.941),
  /** Forderung an den Empfänger. */
  due: rgb(0.55, 0.11, 0.09),
  /** Guthaben zugunsten des Empfängers. */
  credit: rgb(0.05, 0.38, 0.25),
} as const;

/** Fünf Stufen statt der elf, die sich im Bestand angesammelt hatten. */
export const size = {
  foot: 7.5,
  small: 9,
  body: 10,
  section: 13,
  title: 18,
} as const;

export const leading = {
  foot: 10,
  small: 12.5,
  body: 14.5,
} as const;

/** #rrggbb aus dem Branding in eine pdf-lib-Farbe. Ungültiges fällt zurück. */
export function brandColor(hex: string | null | undefined) {
  const match = /^#?([0-9a-f]{6})$/i.exec((hex ?? "").trim());
  if (!match) return color.brand;
  const n = parseInt(match[1], 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}
