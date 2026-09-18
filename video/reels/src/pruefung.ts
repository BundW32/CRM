import { bauZeitachse, reelDauerMs } from "./zeitachse.ts";
import type { ReelPlan } from "./plan.ts";

export type Befund = { schwere: "fehler" | "warnung"; text: string };

/**
 * Prüft einen Schnittplan gegen die Wirklichkeit des Quellmaterials.
 *
 * Der Anlass: Im ersten echten Reel zerfiel das Bild gegen Ende in Schnipsel.
 * Das passiert, wenn ein Segment über das Ende der Quelldatei hinausreicht —
 * der Decoder bekommt dann keine Bilder mehr und wiederholt oder zerlegt das
 * letzte. Sichtbar wird das erst am fertigen Video, und zwar am Schluss, wo
 * beim Prüfen am wenigsten hingesehen wird.
 *
 * Deshalb wird es hier zur harten Bedingung: Wer über das Material
 * hinausschneidet, bekommt keinen kaputten Render, sondern eine Fehlermeldung.
 */
export const pruefePlan = (
  plan: ReelPlan,
  quellen: Record<string, number>,
): Befund[] => {
  const befunde: Befund[] = [];
  const achse = bauZeitachse(plan.segmente);
  const reelSekunden = reelDauerMs(achse) / 1000;

  plan.segmente.forEach((s, i) => {
    const dauer = s.bisSekunde - s.vonSekunde;
    if (dauer <= 0) {
      befunde.push({ schwere: "fehler", text: `Segment ${i + 1} hat keine Länge (${s.vonSekunde}–${s.bisSekunde} s)` });
      return;
    }

    const quelle = quellen[s.datei];
    if (quelle === undefined) {
      befunde.push({ schwere: "warnung", text: `Segment ${i + 1}: Länge von „${s.datei}" unbekannt, nicht prüfbar` });
      return;
    }

    if (s.bisSekunde > quelle + 0.001) {
      befunde.push({
        schwere: "fehler",
        text: `Segment ${i + 1} reicht bis ${s.bisSekunde.toFixed(2)} s, „${s.datei}" ist aber nur ${quelle.toFixed(2)} s lang — genau so entstehen die Bildschnipsel am Ende`,
      });
    }

    if (dauer < 0.2) {
      befunde.push({ schwere: "warnung", text: `Segment ${i + 1} ist nur ${dauer.toFixed(2)} s lang und flackert eher, als dass es schneidet` });
    }
  });

  const ueberDasEnde = (was: string, ab: number, dauer: number) => {
    if (ab + dauer > reelSekunden + 0.001) {
      befunde.push({
        schwere: "warnung",
        text: `${was} läuft bis ${(ab + dauer).toFixed(2)} s, das Reel endet aber bei ${reelSekunden.toFixed(2)} s`,
      });
    }
    if (ab < 0) {
      befunde.push({ schwere: "fehler", text: `${was} beginnt bei ${ab.toFixed(2)} s, also vor dem Anfang` });
    }
  };

  (plan.kinetic ?? []).forEach((k, i) => ueberDasEnde(`Kinetic-Text ${i + 1} („${k.zeilen[0]?.text ?? ""}")`, k.abSekunde, k.dauerSekunden));
  (plan.broll ?? []).forEach((b, i) => ueberDasEnde(`B-Roll ${i + 1} („${b.datei}")`, b.abSekunde, b.dauerSekunden));
  (plan.klaenge ?? []).forEach((k, i) => ueberDasEnde(`Klang ${i + 1} („${k.klang}")`, k.abSekunde, 0));

  if (plan.kamera && plan.kamera.length !== plan.segmente.length) {
    befunde.push({
      schwere: "warnung",
      text: `kamera hat ${plan.kamera.length} Einträge, es gibt aber ${plan.segmente.length} Segmente — die Fahrten sitzen dann an den falschen Stellen`,
    });
  }

  return befunde;
};

/** Wirft, sobald ein Fehler dabei ist. Ein abgebrochener Render ist besser als ein kaputter. */
export const planMussStimmen = (plan: ReelPlan, quellen: Record<string, number>) => {
  const befunde = pruefePlan(plan, quellen);
  const fehler = befunde.filter((b) => b.schwere === "fehler");
  for (const w of befunde.filter((b) => b.schwere === "warnung")) {
    console.warn(`Warnung im Schnittplan „${plan.titel}": ${w.text}`);
  }
  if (fehler.length) {
    throw new Error(
      `Schnittplan „${plan.titel}" ist nicht renderbar:\n` + fehler.map((f) => `  • ${f.text}`).join("\n"),
    );
  }
};

import { parseMedia } from "@remotion/media-parser";
import { staticFile } from "remotion";
import { FORMAT } from "./marke.ts";

/**
 * Für `calculateMetadata` einer Composition: rechnet die Länge aus dem Plan
 * und prüft ihn dabei gegen das echte Quellmaterial.
 *
 * Hier zu prüfen und nicht in einem eigenen Befehl ist Absicht — eine Prüfung,
 * die man vergessen kann, wird vergessen. Stimmt der Plan nicht, bricht der
 * Render mit Klartext ab, statt am Ende Bildschnipsel zu zeigen.
 */
export const reelMetadaten = async (plan: ReelPlan) => {
  const dateien = [...new Set(plan.segmente.map((s) => s.datei))];
  const quellen: Record<string, number> = {};

  for (const datei of dateien) {
    try {
      // Nicht `getVideoMetadata`: Das liest die Länge über ein <video>-Element,
      // und der Render-Browser bringt für H.264 keinen Decoder mit — die Länge
      // bliebe „unbekannt" und die Prüfung liefe ins Leere. `parseMedia` liest
      // den Container selbst und braucht keinen Codec.
      const { durationInSeconds } = await parseMedia({
        src: staticFile(datei),
        fields: { durationInSeconds: true },
      });
      if (durationInSeconds !== null) quellen[datei] = durationInSeconds;
    } catch (fehler) {
      // Lieber ungeprüft rendern als gar nicht — die Warnung steht im Protokoll.
      console.warn(`Länge von „${datei}" nicht lesbar, Plan wird ungeprüft gerendert:`, fehler);
    }
  }

  planMussStimmen(plan, quellen);

  return {
    durationInFrames: Math.max(1, Math.round((reelDauerMs(bauZeitachse(plan.segmente)) / 1000) * FORMAT.fps)),
  };
};
