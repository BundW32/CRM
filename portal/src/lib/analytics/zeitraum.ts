// Zeitraumauswahl des Analytics-Dashboards (/plattform/analytics).
//
// Der Zeitraum reist in den Suchparametern der URL (`zeitraum=28` oder
// `von=2026-08-01&bis=2026-08-10`), damit Ansichten teil- und bookmarkbar
// sind. Diese Datei ist die EINE Stelle, die daraus ein Datumsfenster samt
// gleichlanger Vorperiode ableitet — jede Analytics-Seite parst denselben Weg.
//
// Alle Daten sind UTC-Mitternacht (die Fact-Tabellen tragen @db.Date, also
// reine Kalendertage). Die Presets enden GESTERN, nicht heute: Der laufende
// Tag ist unvollständig, und ein Vergleich „letzte 7 Tage gegen die 7 davor"
// mit einem halben Tag am Rand verzerrt beide Seiten. Nur „monat" läuft bis
// gestern des laufenden Monats — er ist ausdrücklich der unfertige Zeitraum.

export const ZEITRAUM_PRESETS = ["7", "28", "90", "monat"] as const;
export type ZeitraumPreset = (typeof ZEITRAUM_PRESETS)[number];

export type Zeitraum = {
  /** Erster Tag des Fensters (inklusive), UTC-Mitternacht. */
  von: Date;
  /** Letzter Tag des Fensters (inklusive), UTC-Mitternacht. */
  bis: Date;
  /** Vorperiode gleicher Länge, direkt davor (für den Vergleich). */
  vorVon: Date;
  vorBis: Date;
  /** Anzahl Tage im Fenster (>= 1). */
  tage: number;
  /** Gesetzt, wenn ein Preset gewählt ist; null bei freiem Von/Bis. */
  preset: ZeitraumPreset | null;
};

export type ZeitraumSearchParams = {
  zeitraum?: string | string[];
  von?: string | string[];
  bis?: string | string[];
};

const TAG_MS = 86_400_000;

/** Kalendertag eines Zeitpunkts als UTC-Mitternacht. */
export function utcTag(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function tageVor(d: Date, n: number): Date {
  return new Date(d.getTime() - n * TAG_MS);
}

function erster(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** "2026-08-10" → UTC-Mitternacht; alles andere → null. */
function parseIsoTag(raw: string | undefined): Date | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [y, m, t] = raw.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, t));
  // Date.UTC „repariert" Unsinn wie den 32. still zum Folgemonat — das wäre
  // ein anderer Tag als in der URL steht, also lieber verwerfen.
  if (d.getUTCFullYear() !== y || d.getUTCMonth() !== m - 1 || d.getUTCDate() !== t) return null;
  return d;
}

function mitVorperiode(
  von: Date,
  bis: Date,
  preset: ZeitraumPreset | null,
): Zeitraum {
  const tage = Math.round((bis.getTime() - von.getTime()) / TAG_MS) + 1;
  return {
    von,
    bis,
    vorVon: tageVor(von, tage),
    vorBis: tageVor(von, 1),
    tage,
    preset,
  };
}

/**
 * Zeitraum aus den Suchparametern. Reihenfolge: gültiges freies Von/Bis
 * gewinnt, sonst Preset, sonst der Standard (28 Tage). `heute` ist
 * injizierbar, damit die Ableitung testbar bleibt.
 */
export function parseZeitraum(params: ZeitraumSearchParams, heute: Date = new Date()): Zeitraum {
  const gestern = tageVor(utcTag(heute), 1);

  const von = parseIsoTag(erster(params.von));
  const bis = parseIsoTag(erster(params.bis));
  if (von && bis) {
    // Verdrehte Grenzen sind erkennbar gemeint — stillschweigend richten
    // statt auf den Standard zu fallen.
    return von.getTime() <= bis.getTime()
      ? mitVorperiode(von, bis, null)
      : mitVorperiode(bis, von, null);
  }

  const preset = erster(params.zeitraum);
  if (preset === "monat") {
    const erster_ = new Date(Date.UTC(heute.getUTCFullYear(), heute.getUTCMonth(), 1));
    // Am Monatsersten gibt es noch keinen vollen Tag im Monat — dann eben
    // genau dieser eine (unvollständige gestrige) Tag wäre der Vormonat;
    // wir zeigen den Monatsersten selbst, damit das Fenster nie leer ist.
    const ende = gestern.getTime() >= erster_.getTime() ? gestern : erster_;
    return mitVorperiode(erster_, ende, "monat");
  }
  const tage = preset === "7" || preset === "90" ? Number(preset) : 28;
  const gewaehlt: ZeitraumPreset = preset === "7" || preset === "90" ? preset : "28";
  return mitVorperiode(tageVor(gestern, tage - 1), gestern, gewaehlt);
}

/** Suchparameter eines Zeitraums — für Links, die die Auswahl weitertragen. */
export function zeitraumQuery(z: Zeitraum): URLSearchParams {
  const q = new URLSearchParams();
  if (z.preset) q.set("zeitraum", z.preset);
  else {
    q.set("von", toIsoTag(z.von));
    q.set("bis", toIsoTag(z.bis));
  }
  return q;
}

export function toIsoTag(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const DATUM_DE = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

/** „01.08.2026 – 10.08.2026" bzw. Preset-Beschriftung. */
export function zeitraumLabel(z: Zeitraum): string {
  if (z.preset === "monat") return "Laufender Monat";
  if (z.preset) return `Letzte ${z.tage} Tage`;
  return `${DATUM_DE.format(z.von)} – ${DATUM_DE.format(z.bis)}`;
}

/** Beschriftung der Vorperiode („vs. 05.07. – 01.08.2026"). */
export function vorperiodeLabel(z: Zeitraum): string {
  return `vs. ${DATUM_DE.format(z.vorVon)} – ${DATUM_DE.format(z.vorBis)}`;
}
