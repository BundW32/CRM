// Zeitraumauswahl des Analytics-Dashboards (/plattform/analytics).
//
// Der Zeitraum reist in den Suchparametern der URL (`zeitraum=28` oder
// `von=2026-08-01&bis=2026-08-10`), damit Ansichten teil- und bookmarkbar
// sind. Diese Datei ist die EINE Stelle, die daraus ein Datumsfenster samt
// gleichlanger Vorperiode ableitet — jede Analytics-Seite parst denselben Weg.
//
// Alle Daten sind UTC-Mitternacht (die Fact-Tabellen tragen @db.Date, also
// reine Kalendertage). Die Zeitfenster enden GESTERN, nicht heute: Der laufende
// Tag ist unvollständig, und ein Vergleich „letzte 7 Tage gegen die 7 davor"
// mit einem halben Tag am Rand verzerrt beide Seiten. Nur „monat" läuft bis
// gestern des laufenden Monats — er ist ausdrücklich der unfertige Zeitraum.
//
// Ausnahme mit Ansage ist „heute": ein einzelner Tag, der Puls des laufenden
// Tages. Er verzerrt nichts, weil er kein Trendfenster ist und die Oberfläche
// ihn als laufend kennzeichnet (`istLaufenderTag`). Deshalb ist er auch NICHT
// die Vorauswahl — ein Dashboard, das morgens um acht auf einem angebrochenen
// Tag steht, zeigt einen Anfangsstand statt einer Entwicklung.

export const ZEITRAUM_PRESETS = ["heute", "7", "28", "90", "monat"] as const;
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

/** Der laufende Tag — die einzige Auswahl, die nicht gestern endet. */
export function istLaufenderTag(z: Zeitraum): boolean {
  return z.preset === "heute";
}

/**
 * Zeitraum aus den Suchparametern. Reihenfolge: gültiges freies Von/Bis
 * gewinnt, sonst Preset, sonst der Standard (7 Tage). `heute` ist
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
  if (preset === "heute") {
    const tag = utcTag(heute);
    return mitVorperiode(tag, tag, "heute");
  }
  if (preset === "monat") {
    const erster_ = new Date(Date.UTC(heute.getUTCFullYear(), heute.getUTCMonth(), 1));
    // Am Monatsersten gibt es noch keinen vollen Tag im Monat — dann eben
    // genau dieser eine (unvollständige gestrige) Tag wäre der Vormonat;
    // wir zeigen den Monatsersten selbst, damit das Fenster nie leer ist.
    const ende = gestern.getTime() >= erster_.getTime() ? gestern : erster_;
    return mitVorperiode(erster_, ende, "monat");
  }
  const gewaehlt: ZeitraumPreset =
    preset === "28" || preset === "90" ? preset : "7";
  return mitVorperiode(tageVor(gestern, Number(gewaehlt) - 1), gestern, gewaehlt);
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

/**
 * Die tatsächlich gezeigte Spanne als Datum — „10.08.2026 – 16.08.2026",
 * bei einem einzelnen Tag nur dieser.
 *
 * Diese Zeichenkette ist der Kern der Anzeige: Vorher nannte die Oberfläche
 * bei einem Preset ausschließlich die Vorperiode („vs. 03.08. – 09.08."), und
 * die wurde zwangsläufig als der eigene Zeitraum gelesen.
 */
export function zeitraumSpanne(z: Zeitraum): string {
  const von = DATUM_DE.format(z.von);
  if (z.tage === 1) return von;
  return `${von} – ${DATUM_DE.format(z.bis)}`;
}

/** Name der Auswahl („Heute", „Letzte 7 Tage", „Freier Zeitraum"). */
export function zeitraumLabel(z: Zeitraum): string {
  if (z.preset === "heute") return "Heute";
  if (z.preset === "monat") return "Laufender Monat";
  if (z.preset) return `Letzte ${z.tage} Tage`;
  return "Freier Zeitraum";
}

/** Beschriftung der Vorperiode („vs. 05.07. – 01.08.2026"). */
export function vorperiodeLabel(z: Zeitraum): string {
  const vorVon = DATUM_DE.format(z.vorVon);
  // Ein einzelner Vergleichstag wird nicht als „16.08. – 16.08." ausgeschrieben.
  if (z.tage === 1) return `vs. ${vorVon}`;
  return `vs. ${vorVon} – ${DATUM_DE.format(z.vorBis)}`;
}
