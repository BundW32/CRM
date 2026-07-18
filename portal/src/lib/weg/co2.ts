// CO2-Kostenaufteilung nach dem Kohlendioxidkostenaufteilungsgesetz (CO2KostAufG,
// seit 2023). Für Wohngebäude gilt ein 10-Stufen-Modell (§ 5 Abs. 1): je höher der
// spezifische CO2-Ausstoß des Gebäudes (kg CO2 je m² Wohnfläche und Jahr), desto
// größer der vom Vermieter zu tragende Anteil der CO2-Kosten. Reine Rechenlogik als
// Datenbasis für vermietende Eigentümer — Beträge in Integer-Cent.

export type Co2Step = {
  // untere Grenze (einschließlich) des spezifischen Ausstoßes in kg CO2/m²/a
  minInclusive: number;
  maxExclusive: number | null; // obere Grenze (ausschließlich); null = offen
  tenantPct: number; // Mieteranteil in %
  landlordPct: number; // Vermieteranteil in %
  label: string;
};

// 10-Stufen-Modell für Wohngebäude (CO2KostAufG, Anlage zu § 5 Abs. 1).
export const CO2_STEPS_RESIDENTIAL: Co2Step[] = [
  { minInclusive: 0, maxExclusive: 12, tenantPct: 100, landlordPct: 0, label: "< 12 kg CO₂/m²/a" },
  { minInclusive: 12, maxExclusive: 17, tenantPct: 90, landlordPct: 10, label: "12 bis < 17" },
  { minInclusive: 17, maxExclusive: 22, tenantPct: 80, landlordPct: 20, label: "17 bis < 22" },
  { minInclusive: 22, maxExclusive: 27, tenantPct: 70, landlordPct: 30, label: "22 bis < 27" },
  { minInclusive: 27, maxExclusive: 32, tenantPct: 60, landlordPct: 40, label: "27 bis < 32" },
  { minInclusive: 32, maxExclusive: 37, tenantPct: 50, landlordPct: 50, label: "32 bis < 37" },
  { minInclusive: 37, maxExclusive: 42, tenantPct: 40, landlordPct: 60, label: "37 bis < 42" },
  { minInclusive: 42, maxExclusive: 47, tenantPct: 30, landlordPct: 70, label: "42 bis < 47" },
  { minInclusive: 47, maxExclusive: 52, tenantPct: 20, landlordPct: 80, label: "47 bis < 52" },
  { minInclusive: 52, maxExclusive: null, tenantPct: 5, landlordPct: 95, label: "≥ 52" },
];

// Spezifischer Jahresausstoß (kg CO2 je m² Wohnfläche und Jahr).
export function emissionsPerSqm(emissionsKg: number, livingAreaSqm: number): number {
  if (livingAreaSqm <= 0) return 0;
  return emissionsKg / livingAreaSqm;
}

// Ordnet den spezifischen Ausstoß der zutreffenden Stufe zu.
export function co2StepFor(perSqm: number): Co2Step {
  for (const step of CO2_STEPS_RESIDENTIAL) {
    if (perSqm >= step.minInclusive && (step.maxExclusive === null || perSqm < step.maxExclusive)) {
      return step;
    }
  }
  // Fallback (perSqm < 0 o. ä.): niedrigste Stufe.
  return CO2_STEPS_RESIDENTIAL[0];
}

export type Co2Split = {
  perSqm: number;
  step: Co2Step;
  tenantCents: number;
  landlordCents: number;
};

// Teilt die gesamten CO2-Kosten (Cent) centgenau in Mieter- und Vermieteranteil.
// Der Vermieteranteil wird gerundet, der Mieteranteil ergibt sich als Rest — so
// stimmt die Summe immer exakt.
export function splitCo2Cost(params: {
  totalCo2Cents: number;
  emissionsKg: number;
  livingAreaSqm: number;
}): Co2Split {
  const perSqm = emissionsPerSqm(params.emissionsKg, params.livingAreaSqm);
  const step = co2StepFor(perSqm);
  const landlordCents = Math.round((params.totalCo2Cents * step.landlordPct) / 100);
  const tenantCents = params.totalCo2Cents - landlordCents;
  return { perSqm, step, tenantCents, landlordCents };
}
