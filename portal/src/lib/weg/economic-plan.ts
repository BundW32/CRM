// Wirtschaftsplan-Logik (§ 28 Abs. 1 WEG): Wirtschaftsjahr, Vorschuss-Gewichte,
// Einzelwirtschaftspläne und monatliche Hausgeld-Raten. Pure Funktionen —
// DB/UI übernehmen die Server Actions.
import type { DistributionKey } from "@/generated/prisma/client";
import { distributeByWeight, type Share, type UnitForDistribution } from "./distribution";

// Die 12 Kalendermonate des Wirtschaftsjahres, das im Jahr `year` beginnt
// (startMonth 1–12; bei 1 = Kalenderjahr).
export function fiscalYearMonths(year: number, startMonth: number): { year: number; month: number }[] {
  if (startMonth < 1 || startMonth > 12) throw new Error("Ungültiger Wirtschaftsjahr-Beginn.");
  return Array.from({ length: 12 }, (_, i) => {
    const m = startMonth + i;
    return { year: m > 12 ? year + 1 : year, month: m > 12 ? m - 12 : m };
  });
}

// Zeitraum des Wirtschaftsjahres als [start, endExclusive) in UTC.
export function fiscalYearRange(year: number, startMonth: number): { start: Date; end: Date } {
  if (startMonth < 1 || startMonth > 12) throw new Error("Ungültiger Wirtschaftsjahr-Beginn.");
  return {
    start: new Date(Date.UTC(year, startMonth - 1, 1)),
    end: new Date(Date.UTC(year + 1, startMonth - 1, 1)),
  };
}

/**
 * Vorschuss-Gewichte für den Wirtschaftsplan. Anders als die strikte
 * Abrechnungs-Verteilung (weightsForKey) gilt hier:
 * - VERBRAUCH / FESTBETRAG / INDIVIDUELL → nach MEA (übliche Praxis für
 *   Vorschüsse; die Jahresabrechnung korrigiert später centgenau).
 * - FLAECHE / PERSONEN: fehlende Werte zählen als 0 (z. B. Stellplatz ohne
 *   Wohnfläche trägt solche Kosten nicht mit).
 * - MEA bleibt strikt: ohne vollständige MEA kein Plan.
 */
export function advanceWeightsForKey(units: UnitForDistribution[], key: DistributionKey): Share[] {
  if (units.length === 0) throw new Error("Mindestens eine Einheit erforderlich.");
  const effective: DistributionKey =
    key === "VERBRAUCH" || key === "FESTBETRAG" || key === "INDIVIDUELL" ? "MEA" : key;
  switch (effective) {
    case "MEA":
      return units.map((u) => {
        if (u.mea == null) throw new Error(`Einheit ohne Miteigentumsanteil (MEA): ${u.id}`);
        return { unitId: u.id, weight: u.mea };
      });
    case "FLAECHE":
      return units.map((u) => ({ unitId: u.id, weight: Math.round((u.livingArea ?? 0) * 10000) }));
    case "EINHEITEN":
      return units.map((u) => ({ unitId: u.id, weight: 1 }));
    case "PERSONEN":
      return units.map((u) => ({ unitId: u.id, weight: u.personCount ?? 0 }));
    default:
      throw new Error(`Unerwarteter Umlageschlüssel: ${effective}`);
  }
}

export type PlanItemInput = {
  costTypeId: string;
  distributionKey: DistributionKey;
  amountCents: number; // Jahres-Planwert
};

export type UnitAdvances = {
  // Jahres-Vorschuss je Einheit (Summe über alle Positionen) — centgenau:
  // Σ perUnit == Σ items.amountCents
  perUnit: Map<string, number>;
  // Aufschlüsselung je Position (für den Einzelwirtschaftsplan)
  perItem: Map<string, Map<string, number>>;
  totalCents: number;
};

// Verteilt alle Planpositionen auf die Einheiten (Einzelwirtschaftspläne).
export function computeUnitAdvances(items: PlanItemInput[], units: UnitForDistribution[]): UnitAdvances {
  const perUnit = new Map<string, number>(units.map((u) => [u.id, 0]));
  const perItem = new Map<string, Map<string, number>>();
  let totalCents = 0;
  for (const item of items) {
    if (item.amountCents < 0) throw new Error("Planwerte dürfen nicht negativ sein.");
    if (item.amountCents === 0) continue;
    totalCents += item.amountCents;
    const weights = advanceWeightsForKey(units, item.distributionKey);
    const shares = distributeByWeight(item.amountCents, weights);
    perItem.set(item.costTypeId, shares);
    for (const [unitId, cents] of shares) {
      perUnit.set(unitId, (perUnit.get(unitId) ?? 0) + cents);
    }
  }
  return { perUnit, perItem, totalCents };
}

// 12 Monatsraten, die centgenau den Jahresbetrag ergeben (Restcents auf die
// ersten Monate verteilt — deterministisch).
export function monthlyInstallments(annualCents: number): number[] {
  if (annualCents === 0) return Array(12).fill(0);
  const shares = distributeByWeight(
    annualCents,
    Array.from({ length: 12 }, (_, i) => ({ unitId: String(i), weight: 1 })),
  );
  return Array.from({ length: 12 }, (_, i) => shares.get(String(i)) ?? 0);
}
