import type { Caption } from "@remotion/captions";

/** Ein behaltener Abschnitt des Rohmaterials, in Sekunden. */
export type Segment = {
  /** Datei unter public/, meist das normalisierte Rohvideo. */
  datei: string;
  vonSekunde: number;
  bisSekunde: number;
};

export type Abschnitt = {
  datei: string;
  rohVonMs: number;
  rohBisMs: number;
  /** Beginn im fertigen Reel. */
  reelVonMs: number;
};

/**
 * Rechnet die Rohzeit in die Reelzeit um.
 *
 * Das ist die Stelle, an der ein Schnittprogramm von Hand scheitert: Sobald
 * eine Denkpause bei Sekunde 4 herausfliegt, sitzt alles dahinter um deren
 * Länge früher. Untertitel, Kinetic-Texte und Klänge tragen aber Rohzeiten aus
 * dem Transkript. Ohne diese Umrechnung läuft der ganze Rest aus dem Takt —
 * und zwar wachsend, also am Ende am stärksten.
 */
export const bauZeitachse = (segmente: Segment[]): Abschnitt[] => {
  let gelaufen = 0;
  return segmente.map((s) => {
    const rohVonMs = Math.round(s.vonSekunde * 1000);
    const rohBisMs = Math.round(s.bisSekunde * 1000);
    const abschnitt = { datei: s.datei, rohVonMs, rohBisMs, reelVonMs: gelaufen };
    gelaufen += rohBisMs - rohVonMs;
    return abschnitt;
  });
};

export const reelDauerMs = (achse: Abschnitt[]) =>
  achse.reduce((s, a) => s + (a.rohBisMs - a.rohVonMs), 0);

/** Rohzeit → Reelzeit. `null`, wenn die Stelle weggeschnitten wurde. */
export const rohZuReel = (achse: Abschnitt[], rohMs: number): number | null => {
  for (const a of achse) {
    if (rohMs >= a.rohVonMs && rohMs <= a.rohBisMs) {
      return a.reelVonMs + (rohMs - a.rohVonMs);
    }
  }
  return null;
};

/**
 * Verschiebt die Untertitel auf die Reelzeit.
 *
 * Wörter, die komplett im weggeschnittenen Teil liegen, verschwinden. Wörter,
 * die in einen Schnitt hineinragen, werden auf den Abschnitt beschnitten —
 * sonst stünde ein Wort noch da, während der Ton schon weiter ist.
 */
export const untertitelUmrechnen = (captions: Caption[], achse: Abschnitt[]): Caption[] => {
  const raus: Caption[] = [];

  for (const c of captions) {
    for (const a of achse) {
      const von = Math.max(c.startMs, a.rohVonMs);
      const bis = Math.min(c.endMs, a.rohBisMs);
      if (bis <= von) continue;

      const versatz = a.reelVonMs - a.rohVonMs;
      raus.push({
        ...c,
        startMs: von + versatz,
        endMs: bis + versatz,
        timestampMs: c.timestampMs === null ? null : Math.min(Math.max(c.timestampMs, von), bis) + versatz,
      });
      break;
    }
  }

  return raus.sort((a, b) => a.startMs - b.startMs);
};

/**
 * Dreht die Fundstellen aus werkzeuge/pausen.mjs in Segmente um: Was nicht
 * weggeschnitten wird, bleibt.
 *
 * `luftMs` lässt an jedem Schnitt etwas Atem stehen. Ohne das klebt das nächste
 * Wort am vorigen und der Schnitt klingt gehetzt statt schnell — und bei harten
 * Konsonanten schneidet man Wortanfänge ab.
 */
export const segmenteAusPausen = ({
  datei,
  gesamtSekunden,
  pausen,
  luftMs = 60,
  mindestSegmentMs = 200,
}: {
  datei: string;
  gesamtSekunden: number;
  pausen: { von: number; bis: number }[];
  luftMs?: number;
  mindestSegmentMs?: number;
}): Segment[] => {
  const luft = luftMs / 1000;
  const segmente: Segment[] = [];
  let cursor = 0;

  for (const p of [...pausen].sort((a, b) => a.von - b.von)) {
    const schnittVon = Math.max(cursor, p.von + luft);
    const schnittBis = Math.min(gesamtSekunden, p.bis - luft);
    if (schnittBis <= schnittVon) continue;
    if (schnittVon - cursor >= mindestSegmentMs / 1000) {
      segmente.push({ datei, vonSekunde: cursor, bisSekunde: schnittVon });
    }
    cursor = schnittBis;
  }

  if (gesamtSekunden - cursor >= mindestSegmentMs / 1000) {
    segmente.push({ datei, vonSekunde: cursor, bisSekunde: gesamtSekunden });
  }

  return segmente;
};

/**
 * Findet Sprechpausen im Transkript.
 *
 * Whisper legt die Zeitstempel lückenlos aneinander — eine Pause steckt
 * deshalb nicht zwischen zwei Wörtern, sondern IN einem Token: Das Komma nach
 * „Ganz ehrlich" läuft von 890 bis 1300 ms, also 410 ms, in denen niemand
 * spricht. Wer nach Lücken sucht, findet an echtem Token-Material nichts.
 *
 * Zwei Fälle liefern also die Pausen:
 *   * Satzzeichen-Token, die länger als die Schwelle dauern
 *   * ungewöhnlich lange Wort-Token — dort liegt die Pause am Ende des Wortes,
 *     weshalb nur der Überhang geschnitten wird
 *
 * Bleibt trotzdem nur der halbe Beleg: Ein „äh" verschluckt Whisper oft ganz.
 * Die zweite Quelle ist und bleibt `silencedetect` auf dem Ton.
 */
export const pausenAusTranskript = (
  captions: { text: string; startMs: number; endMs: number }[],
  mindestMs = 300,
): { von: number; bis: number; grund: string }[] => {
  const pausen: { von: number; bis: number; grund: string }[] = [];

  for (const c of captions) {
    const dauer = c.endMs - c.startMs;
    const text = c.text.trim();
    const nurSatzzeichen = text.length > 0 && /^[.,!?;:…»«"'\-–—]+$/.test(text);

    if (nurSatzzeichen && dauer >= mindestMs) {
      pausen.push({ von: c.startMs / 1000, bis: c.endMs / 1000, grund: `Pause bei „${text}"` });
      continue;
    }

    // Ein Wort braucht selten mehr als ~90 ms je Zeichen. Was darüber liegt,
    // ist nachgehaltene Stille am Wortende.
    const erwartet = Math.max(400, text.length * 90);
    if (!nurSatzzeichen && dauer > erwartet + mindestMs) {
      pausen.push({ von: (c.startMs + erwartet) / 1000, bis: c.endMs / 1000, grund: `Hänger nach „${text}"` });
    }
  }

  return pausen;
};
