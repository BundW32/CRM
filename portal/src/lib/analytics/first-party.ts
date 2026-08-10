// Aggregation der First-Party-Ereignisse für die Analytics-Seiten. Pure
// Funktionen über bereits geladenen Zeilen — bei den heutigen Besuchszahlen
// ist das In-Memory-Aggregieren die einfachste korrekte Lösung; sobald die
// Zeilenzahl das hergibt, übernimmt ein Tagesaggregat-Job dieselben Formen
// (die Signaturen hier bleiben dann stehen).
//
// Zur Sprache: „Besucher" heißt hier IMMER „täglich eindeutige Besucher".
// Der visitorHash rotiert mit dem Tages-Salt — wer an drei Tagen kommt, zählt
// dreimal. Das ist kein Fehler, sondern der Preis der Cookiefreiheit; die
// Beschriftungen im Dashboard sagen es dazu.

import { type Zeitraum, toIsoTag, utcTag } from "@/lib/analytics/zeitraum";

export type PageviewRow = {
  ts: Date;
  visitorHash: string;
  path: string;
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  device: string | null;
  country: string | null;
};

export type TagesPunkt = { tag: string; label: string; pageviews: number; besucher: number };

const TAG_MS = 86_400_000;
const TAG_LABEL = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
});

/** Seitenaufrufe und Besucher je Kalendertag, an allen Tagen des Zeitraums ausgerichtet (Lücken = 0). */
export function tagesReihe(rows: readonly PageviewRow[], zeitraum: Zeitraum): TagesPunkt[] {
  const proTag = new Map<string, { pageviews: number; besucher: Set<string> }>();
  for (const r of rows) {
    const key = toIsoTag(utcTag(r.ts));
    const eintrag = proTag.get(key) ?? { pageviews: 0, besucher: new Set<string>() };
    eintrag.pageviews += 1;
    eintrag.besucher.add(r.visitorHash);
    proTag.set(key, eintrag);
  }
  const punkte: TagesPunkt[] = [];
  for (let t = zeitraum.von.getTime(); t <= zeitraum.bis.getTime(); t += TAG_MS) {
    const tag = new Date(t);
    const key = toIsoTag(tag);
    const e = proTag.get(key);
    punkte.push({
      tag: key,
      label: TAG_LABEL.format(tag),
      pageviews: e?.pageviews ?? 0,
      besucher: e?.besucher.size ?? 0,
    });
  }
  return punkte;
}

/** Gesamtsummen eines Zeitraums. Besucher = täglich eindeutige (s. Kopfkommentar). */
export function summen(rows: readonly PageviewRow[]): { pageviews: number; besucher: number } {
  const besucher = new Set<string>();
  for (const r of rows) besucher.add(r.visitorHash);
  return { pageviews: rows.length, besucher: besucher.size };
}

type Gruppe = { pageviews: number; besucher: Set<string> };

function gruppiere(
  rows: readonly PageviewRow[],
  schluessel: (r: PageviewRow) => string,
): Map<string, Gruppe> {
  const gruppen = new Map<string, Gruppe>();
  for (const r of rows) {
    const key = schluessel(r);
    const g = gruppen.get(key) ?? { pageviews: 0, besucher: new Set<string>() };
    g.pageviews += 1;
    g.besucher.add(r.visitorHash);
    gruppen.set(key, g);
  }
  return gruppen;
}

export type GruppenZeile = { name: string; pageviews: number; besucher: number };

function alsZeilen(gruppen: Map<string, Gruppe>, n: number): GruppenZeile[] {
  return [...gruppen.entries()]
    .map(([name, g]) => ({ name, pageviews: g.pageviews, besucher: g.besucher.size }))
    .sort((a, b) => b.pageviews - a.pageviews || a.name.localeCompare(b.name))
    .slice(0, n);
}

export function topSeiten(rows: readonly PageviewRow[], n = 10): GruppenZeile[] {
  return alsZeilen(gruppiere(rows, (r) => r.path), n);
}

/**
 * Herkunft eines Aufrufs: UTM gewinnt (bezahlte/kampagnengetriebene Klicks
 * tragen ihre Herkunft selbst), sonst der bereinigte Referrer-Host, sonst
 * „direkt". Der Referrer wird auf den Host gekürzt — für die Quellen-Tabelle
 * zählt woher, nicht welche Unterseite.
 */
export function quelleVon(r: Pick<PageviewRow, "referrer" | "utmSource" | "utmMedium">): string {
  if (r.utmSource) return `${r.utmSource} / ${r.utmMedium ?? "–"}`;
  if (r.referrer) return r.referrer.split("/")[0];
  return "direkt";
}

export function quellen(rows: readonly PageviewRow[], n = 10): GruppenZeile[] {
  return alsZeilen(gruppiere(rows, quelleVon), n);
}

export function geraete(rows: readonly PageviewRow[]): GruppenZeile[] {
  return alsZeilen(gruppiere(rows, (r) => r.device ?? "unbekannt"), 10);
}

export function laender(rows: readonly PageviewRow[], n = 10): GruppenZeile[] {
  return alsZeilen(gruppiere(rows, (r) => r.country ?? "unbekannt"), n);
}

/**
 * Vergleichstext gegen die Vorperiode („+12 %", „−8 %", „±0 %"); null, wenn
 * die Vorperiode leer war — „+∞ %" hilft niemandem.
 */
export function vergleichsText(aktuell: number, vorher: number): string | null {
  if (vorher === 0) return null;
  const prozent = Math.round(((aktuell - vorher) / vorher) * 100);
  if (prozent === 0) return "±0 % vs. Vorperiode";
  return `${prozent > 0 ? "+" : "−"}${Math.abs(prozent)} % vs. Vorperiode`;
}
