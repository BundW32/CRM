// Verteilt die CO2-Kosten einer Co2Allocation gebäudeweit (Stufe/Split nach M-I)
// und centgenau je Einheit nach Wohnfläche. Gemeinsame Grundlage für die
// CO2-Seite (M-I) und die Betriebskostenabrechnung des Vermieters (M-K).
import { splitCo2Cost, type Co2Split } from "./co2";
import { distributeByWeight, weightsForKey, type UnitForDistribution } from "./distribution";

export type Co2PerUnit = { landlord: number; tenant: number; area: number };

export function co2PerUnit(params: {
  totalCo2Cents: number;
  emissionsKg: number;
  units: UnitForDistribution[];
}): { totalArea: number; split: Co2Split | null; perUnit: Map<string, Co2PerUnit> } {
  const totalArea =
    Math.round(params.units.reduce((s, u) => s + (u.livingArea ?? 0), 0) * 100) / 100;
  const perUnit = new Map<string, Co2PerUnit>();
  for (const u of params.units) perUnit.set(u.id, { landlord: 0, tenant: 0, area: u.livingArea ?? 0 });

  if (totalArea <= 0) return { totalArea, split: null, perUnit };

  const split = splitCo2Cost({
    totalCo2Cents: params.totalCo2Cents,
    emissionsKg: params.emissionsKg,
    livingAreaSqm: totalArea,
  });
  // Nur Einheiten mit Wohnfläche tragen CO2-Heizkosten (z. B. Stellplätze nicht).
  const heated = params.units.filter((u) => (u.livingArea ?? 0) > 0);
  const weights = weightsForKey(heated, "FLAECHE");
  const landlordByUnit = distributeByWeight(split.landlordCents, weights);
  const tenantByUnit = distributeByWeight(split.tenantCents, weights);
  for (const u of params.units) {
    perUnit.set(u.id, {
      landlord: landlordByUnit.get(u.id) ?? 0,
      tenant: tenantByUnit.get(u.id) ?? 0,
      area: u.livingArea ?? 0,
    });
  }
  return { totalArea, split, perUnit };
}
