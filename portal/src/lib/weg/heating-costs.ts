// Aufteilung der Heiz- und Warmwasserkosten nach der Heizkostenverordnung.
//
// Die eingebaute Zählerverteilung legte die Gesamtkosten **zu 100 % nach
// Verbrauch** um. Das sieht gerecht aus und ist trotzdem formell fehlerhaft:
// §§ 7 Abs. 1, 8 Abs. 1 HeizkostenV verlangen 50–70 % nach Verbrauch, den Rest
// nach Wohnfläche (Grundkosten). Wer anders abrechnet, gibt jedem Eigentümer
// nach § 12 Abs. 1 HeizkostenV ein **Kürzungsrecht von 15 %** auf seinen
// Anteil — und die Differenz trägt am Ende die Gemeinschaft.
//
// Warum es Grundkosten überhaupt gibt: Ein Teil der Wärme geht unabhängig vom
// eigenen Verhalten verloren (Rohrleitungen, Vorhaltung, Wärmeübertragung
// zwischen Wohnungen). Die Wohnung im Erdgeschoss neben dem Treppenhaus heizt
// sonst für ihre Nachbarn mit.
//
// Vorzuziehen bleibt der Weg über den Messdienst: Er nimmt die Aufteilung
// samt Rohrwärme (§ 9 HeizkostenV) und die Trennung Heizung/Warmwasser bereits
// vor. Diese Funktion ist der Notbehelf für Gemeinschaften, die selbst ablesen.
import { distributeByWeight, type Share } from "./distribution";

/** Zulässiger Verbrauchsanteil nach §§ 7 Abs. 1, 8 Abs. 1 HeizkostenV. */
export const HEATING_CONSUMPTION_MIN = 50;
export const HEATING_CONSUMPTION_MAX = 70;
/** Üblichster Wert in der Praxis und deshalb Vorbelegung. */
export const HEATING_CONSUMPTION_DEFAULT = 70;

export function isValidHeatingPercent(percent: number): boolean {
  return (
    Number.isInteger(percent) &&
    percent >= HEATING_CONSUMPTION_MIN &&
    percent <= HEATING_CONSUMPTION_MAX
  );
}

export type HeatingSplitResult = {
  /** Anteil je Einheit gesamt (Grundkosten + Verbrauchskosten). */
  perUnit: Map<string, number>;
  /** Nach Fläche verteilter Teil — für die Anzeige. */
  baseCents: number;
  /** Nach Verbrauch verteilter Teil — für die Anzeige. */
  consumptionCents: number;
};

/**
 * Teilt `totalCents` in Grundkosten (nach Fläche) und Verbrauchskosten (nach
 * Zählern) und verteilt beide centgenau.
 *
 * Der Verbrauchsanteil muss zwischen 50 und 70 Prozent liegen — außerhalb wird
 * abgelehnt statt gerundet: Die Verordnung lässt hier keinen Spielraum, und
 * eine stillschweigend korrigierte Eingabe wäre nicht das, was der Verwalter
 * beschlossen hat.
 *
 * Die Restcent-Behandlung sitzt bewusst bei den **Grundkosten**: Sie werden aus
 * `totalCents − Verbrauchskosten` gebildet, nicht selbst gerundet. So ist
 * Σ Grundkosten + Σ Verbrauchskosten == totalCents ohne Sonderfall.
 */
export function splitHeatingCosts(args: {
  totalCents: number;
  consumptionPercent: number;
  /** Verbrauch je Einheit (Zählerdifferenz im Wirtschaftsjahr). */
  consumptionWeights: Share[];
  /** Wohnfläche je Einheit — Grundlage der Grundkosten. */
  areaWeights: Share[];
}): HeatingSplitResult {
  const { totalCents, consumptionPercent, consumptionWeights, areaWeights } = args;
  if (!isValidHeatingPercent(consumptionPercent)) {
    throw new Error(
      `Der Verbrauchsanteil muss zwischen ${HEATING_CONSUMPTION_MIN} und ${HEATING_CONSUMPTION_MAX} Prozent liegen (§§ 7, 8 HeizkostenV).`,
    );
  }
  if (!Number.isInteger(totalCents) || totalCents < 0) {
    throw new Error("Der Gesamtbetrag muss eine nicht negative Ganzzahl (Cent) sein.");
  }

  const consumptionCents = Math.round((totalCents * consumptionPercent) / 100);
  const baseCents = totalCents - consumptionCents;

  const verbrauch = distributeByWeight(consumptionCents, consumptionWeights);
  const grund = distributeByWeight(baseCents, areaWeights);

  const perUnit = new Map<string, number>();
  for (const unitId of new Set([...verbrauch.keys(), ...grund.keys()])) {
    perUnit.set(unitId, (verbrauch.get(unitId) ?? 0) + (grund.get(unitId) ?? 0));
  }
  return { perUnit, baseCents, consumptionCents };
}
