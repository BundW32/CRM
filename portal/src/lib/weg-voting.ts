// WEG-Abstimmungslogik: berechnet das voraussichtliche Beschlussergebnis nach
// Stimmprinzip (Gewichtung kommt vom Aufrufer) UND erforderlicher Mehrheit.
// Bewusst eine reine Funktion (testbar). Das Ergebnis ist ein VORSCHLAG –
// die rechtsverbindliche Feststellung trifft der (interne) Verwalter.
//
// Rechtsgrundlagen: §25 WEG (Stimmprinzip), §20/§21 WEG (Mehrheiten);
// Enthaltungen und Abwesende zählen bei der Mehrheit NICHT mit.

export type VoteChoice = "JA" | "NEIN" | "ENTHALTUNG";
export type MajorityType = "EINFACH" | "DREIVIERTEL" | "DOPPELT_QUALIFIZIERT" | "ALLSTIMMIG";
export type ResolutionOutcome = "ANGENOMMEN" | "ABGELEHNT";

// Eine Stimme mit dem nach Stimmprinzip ermittelten Gewicht (Kopf=1, Wert=MEA,
// Objekt=Einheiten). `missingWeight` markiert Stimmen ohne hinterlegtes Gewicht.
export type WeightedVote = { choice: VoteChoice; weight: number; missingWeight?: boolean };

export type OutcomeInput = {
  votes: WeightedVote[];
  majority: MajorityType;
  // Für DOPPELT_QUALIFIZIERT: MEA der Ja-Stimmen und Summe ALLER MEA.
  meaJa?: number;
  meaTotal?: number;
  // Für ALLSTIMMIG: wie viele Eigentümer es gibt und wie viele abgestimmt haben.
  eligibleCount?: number;
  ballotsCast?: number;
};

export type OutcomeResult = {
  suggestion: ResolutionOutcome;
  ja: number;
  nein: number;
  enthaltung: number;
  cast: number; // ja + nein (Enthaltungen ausgenommen)
  warnings: string[];
  rule: string; // Kurzbeschreibung der angewandten Regel
};

export const MAJORITY_LABELS: Record<MajorityType, string> = {
  EINFACH: "Einfache Mehrheit",
  DREIVIERTEL: "Qualifizierte 3/4-Mehrheit",
  DOPPELT_QUALIFIZIERT: "Doppelt qualifizierte Mehrheit (§21 II WEG)",
  ALLSTIMMIG: "Allstimmigkeit (alle Eigentümer)",
};

export const MAJORITY_HINTS: Record<MajorityType, string> = {
  EINFACH: "Mehrheit der abgegebenen Stimmen (Enthaltungen zählen nicht).",
  DREIVIERTEL: "Mindestens 3/4 der abgegebenen Stimmen.",
  DOPPELT_QUALIFIZIERT:
    "Über 2/3 der abgegebenen Stimmen UND über die Hälfte aller Miteigentumsanteile.",
  ALLSTIMMIG: "Zustimmung aller Eigentümer (z. B. für Vereinbarungen).",
};

export function computeOutcome(input: OutcomeInput): OutcomeResult {
  const warnings: string[] = [];
  const sum = (c: VoteChoice) =>
    input.votes.filter((v) => v.choice === c).reduce((s, v) => s + v.weight, 0);
  const ja = sum("JA");
  const nein = sum("NEIN");
  const enthaltung = sum("ENTHALTUNG");
  const cast = ja + nein; // Basis: nur abgegebene Ja/Nein

  if (input.votes.some((v) => v.choice !== "ENTHALTUNG" && v.missingWeight)) {
    warnings.push("Für einzelne Stimmen ist kein Stimmgewicht hinterlegt – Ergebnis prüfen.");
  }

  let accepted = false;
  let rule = MAJORITY_HINTS[input.majority];

  switch (input.majority) {
    case "EINFACH":
      accepted = ja > nein;
      break;
    case "DREIVIERTEL":
      accepted = cast > 0 && ja >= 0.75 * cast;
      break;
    case "DOPPELT_QUALIFIZIERT": {
      const stimmenOk = cast > 0 && ja > (2 / 3) * cast;
      const meaTotal = input.meaTotal ?? 0;
      const meaJa = input.meaJa ?? 0;
      const meaOk = meaTotal > 0 && meaJa > 0.5 * meaTotal;
      if (meaTotal <= 0) {
        warnings.push("Keine Miteigentumsanteile hinterlegt – MEA-Hälfte nicht prüfbar.");
      }
      accepted = stimmenOk && meaOk;
      rule += ` (Ja-Stimmen ${ja}/${cast}, Ja-MEA ${meaJa}/${meaTotal}).`;
      break;
    }
    case "ALLSTIMMIG": {
      const fullTurnout =
        input.eligibleCount != null &&
        input.ballotsCast != null &&
        input.ballotsCast === input.eligibleCount;
      if (!fullTurnout) {
        warnings.push("Nicht alle Eigentümer haben abgestimmt – Allstimmigkeit unsicher.");
      }
      accepted = nein === 0 && enthaltung === 0 && ja > 0 && fullTurnout;
      break;
    }
  }

  return {
    suggestion: accepted ? "ANGENOMMEN" : "ABGELEHNT",
    ja,
    nein,
    enthaltung,
    cast,
    warnings,
    rule,
  };
}

// Stimmgewicht eines Eigentümers nach Stimmprinzip.
export function weightFor(
  principle: string,
  owner: { mea: number | null; voteUnits: number | null },
): { weight: number; missing: boolean } {
  if (principle === "MEA") return { weight: owner.mea ?? 0, missing: owner.mea == null };
  if (principle === "OBJEKT") return { weight: owner.voteUnits ?? 0, missing: owner.voteUnits == null };
  return { weight: 1, missing: false }; // KOPF
}
