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
 * Dreht die Fundstellen aus werkzeuge/pausen.ts in Segmente um: Was nicht
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
  luftMs = 100,
  mindestSegmentMs = 200,
}: {
  datei: string;
  gesamtSekunden: number;
  pausen: { von: number; bis: number }[];
  luftMs?: number;
  mindestSegmentMs?: number;
}): Segment[] => {
  const segmente: Segment[] = [];
  let cursor = 0;

  for (const p of [...pausen].sort((a, b) => a.von - b.von)) {
    // Luft anteilig: Bei fester Luft bliebe von einer 0,4-Sekunden-Pause nach
    // Abzug an beiden Seiten fast nichts übrig — die Pause bliebe stehen,
    // obwohl sie erkannt wurde. Höchstens ein Viertel je Seite.
    const luft = Math.min(luftMs / 1000, (p.bis - p.von) / 4);
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

const NUR_SATZZEICHEN = /^[.,!?;:…»«"'\-–—]+$/;

const istSatzzeichen = (text: string) => {
  const t = text.trim();
  return t.length > 0 && NUR_SATZZEICHEN.test(t);
};

/**
 * Findet Sprechpausen im Transkript.
 *
 * Whisper legt die Zeitstempel lückenlos aneinander — eine Pause steckt
 * deshalb nicht zwischen zwei Wörtern, sondern IN einem Token: Das Komma nach
 * „Ganz ehrlich" läuft von 890 bis 1300 ms, also 410 ms, in denen niemand
 * spricht. Wer nach Lücken sucht, findet an echtem Token-Material nichts.
 *
 * Gewertet werden nur Satzzeichen-Token, denn die liegen sicher ZWISCHEN zwei
 * Wörtern. Eine frühere Fassung hat zusätzlich lange Wort-Token hinten
 * beschnitten, in der Annahme, dort hänge Stille. Das hat im ersten echten
 * Reel ganze Wörter gekostet — Whispers Zeitstempel sitzen nicht genau genug,
 * um innerhalb eines Wortes zu schneiden. Diese Regel ist deshalb raus, und
 * `schnittstellen()` sorgt zusätzlich dafür, dass kein Schnitt je in einem
 * Wort landet.
 *
 * Das bleibt der halbe Beleg: Ein „äh" verschluckt Whisper oft ganz. Die
 * zweite Quelle ist und bleibt `silencedetect` auf dem Ton.
 */
export const pausenAusTranskript = (
  captions: { text: string; startMs: number; endMs: number }[],
  mindestMs = 300,
): { von: number; bis: number; grund: string }[] =>
  captions
    .filter((c) => istSatzzeichen(c.text) && c.endMs - c.startMs >= mindestMs)
    .map((c) => ({ von: c.startMs / 1000, bis: c.endMs / 1000, grund: `Pause bei „${c.text.trim()}"` }));

/**
 * Macht aus gemessenen Stillen die Stellen, an denen wirklich geschnitten
 * werden darf.
 *
 * Der Grund steht im ersten echten Reel: Dort fehlte mitten im Satz das Wort
 * „gehört". Eine gemessene Stille darf sich nämlich mit einem Wort
 * überschneiden — leise Wortenden, ausklingende Vokale, ein „t" am Schluss
 * liegen unter der Schwelle. Wer die Stille dann roh herausschneidet, nimmt
 * das Wortende mit, und bei kurzen Wörtern das ganze Wort.
 *
 * Deshalb wird jede Stille gegen die Sprech-Bereiche des Transkripts
 * verrechnet: Übrig bleibt nur, was zwischen zwei Wörtern liegt. Was danach
 * kürzer als `mindestMs` ist, lohnt den Schnitt nicht.
 */
export const schnittstellen = ({
  stillen,
  captions,
  mindestMs = 250,
  toleranzMs = 120,
}: {
  stillen: { von: number; bis: number; grund?: string }[];
  captions: { text: string; startMs: number; endMs: number }[];
  mindestMs?: number;
  /**
   * Wie weit eine Stille in ein Wort hineinreichen darf. Whisper setzt die
   * Wortgrenzen gepolstert — es hängt die folgende Stille mit an das Wort. Mit
   * `0` bliebe fast keine Schnittstelle übrig und die Pausen blieben im Video
   * stehen; mit zu viel verliert man Wortenden. Geschützt bleibt immer der
   * Kern des Wortes.
   */
  toleranzMs?: number;
}): { von: number; bis: number; grund: string }[] => {
  const sprich = captions
    .filter((c) => !istSatzzeichen(c.text))
    .map((c) => {
      const kern = c.endMs - c.startMs - 2 * toleranzMs;
      // Kurze Wörter werden ganz geschützt, sonst bliebe von ihnen nichts.
      return kern <= 0
        ? ([c.startMs, c.endMs] as const)
        : ([c.startMs + toleranzMs, c.endMs - toleranzMs] as const);
    })
    .sort((a, b) => a[0] - b[0]);

  const raus: { von: number; bis: number; grund: string }[] = [];

  for (const stille of stillen) {
    // Kann in mehrere Stücke zerfallen, wenn ein Wort mitten hineinragt.
    let stuecke: [number, number][] = [[stille.von * 1000, stille.bis * 1000]];

    for (const [wortVon, wortBis] of sprich) {
      const naechste: [number, number][] = [];
      for (const [von, bis] of stuecke) {
        if (wortBis <= von || wortVon >= bis) {
          naechste.push([von, bis]);
          continue;
        }
        if (wortVon > von) naechste.push([von, wortVon]);
        if (wortBis < bis) naechste.push([wortBis, bis]);
      }
      stuecke = naechste;
    }

    for (const [von, bis] of stuecke) {
      if (bis - von >= mindestMs) {
        raus.push({ von: von / 1000, bis: bis / 1000, grund: stille.grund ?? "Stille" });
      }
    }
  }

  return raus.sort((a, b) => a.von - b.von);
};
