// Der Umlageschlüssel, wie er im Dokument stehen muss.
//
// `distributionKeyLabels` benennt den technischen Schlüssel. Für Heiz- und
// Warmwasserkosten genügt das nicht: Dort steht in der Abrechnung sonst nur
// „Verbrauch", und das liest sich wie eine Verteilung zu 100 % nach Verbrauch —
// also wie ein Verstoß gegen §§ 7, 8 HeizkostenV, obwohl das Portal korrekt
// zwischen Grundkosten (Fläche) und Verbrauchskosten aufteilt. Ein Mieter, der
// das so liest, hätte allen Grund, das Kürzungsrecht von 15 % nach § 12 Abs. 1
// HeizkostenV geltend zu machen.
import type { DistributionKey } from "@/generated/prisma/client";
import { distributionKeyLabels } from "@/lib/labels";

export function umlageschluesselText(row: {
  distributionKey: DistributionKey;
  heatingCost?: boolean | null;
  heatingConsumptionPercent?: number | null;
}): string {
  const basis = distributionKeyLabels[row.distributionKey] ?? row.distributionKey;
  if (!row.heatingCost) return basis;

  const anteil = row.heatingConsumptionPercent;
  if (anteil == null) {
    // Vor Einführung der Erfassung: die Aufteilung benennen, ohne eine Zahl zu
    // behaupten, die nicht festgehalten wurde.
    return "Verbrauch und Wohnfläche (HeizkostenV)";
  }
  return `${anteil} % Verbrauch, ${100 - anteil} % Wohnfläche`;
}

/** Fußnote, die die Aufteilung erklärt — nur nötig, wenn Heizkosten vorkommen. */
export const HEIZKOSTEN_HINWEIS =
  "Heiz- und Warmwasserkosten werden nach der Heizkostenverordnung aufgeteilt: " +
  "der überwiegende Teil nach erfasstem Verbrauch, der Rest als Grundkosten nach " +
  "Wohnfläche (§§ 7, 8 HeizkostenV). Die Grundkosten decken den Wärmebedarf ab, " +
  "der unabhängig vom eigenen Verbrauch entsteht.";
