// Betriebskostenabrechnung für eine vermietete Einheit (M-K). Leitet aus der
// WEG-Jahresabrechnung den auf den Mieter umlagefähigen Anteil ab: nur nach BetrKV
// umlagefähige Kostenarten werden weitergegeben; der vom Vermieter zu tragende
// CO2-Anteil (CO2KostAufG, M-I) wird beim Mieter abgezogen. Beträge in Integer-Cent.

export type OperatingCostInput = {
  name: string;
  unitShareCents: number; // Anteil dieser Einheit aus der WEG-Abrechnung
  recoverable: boolean; // nach BetrKV auf den Mieter umlagefähig?
  totalCents: number; // Gesamtkosten der Liegenschaft für diese Kostenart
  keyLabel: string; // Umlageschlüssel im Klartext, z. B. "Wohnfläche"
};

// Eine Abrechnung muss die Gesamtkosten, den Verteilerschlüssel und den daraus
// abgeleiteten Anteil zeigen — sonst kann der Mieter sie nicht nachvollziehen.
export type OperatingCostLine = {
  name: string;
  cents: number;
  totalCents: number;
  keyLabel: string;
};

export type OperatingCostResult = {
  recoverableRows: OperatingCostLine[];
  nonRecoverableRows: OperatingCostLine[];
  recoverableSumCents: number; // Summe umlagefähig (vor CO2-Abzug)
  co2LandlordDeductionCents: number; // vom Mieter abgezogener Vermieter-CO2-Anteil
  tenantCostsCents: number; // tatsächlich auf den Mieter entfallende Kosten
  prepaymentCents: number; // geleistete Vorauszahlungen
  balanceCents: number; // + Nachzahlung / − Guthaben
};

export function computeOperatingCosts(params: {
  rows: OperatingCostInput[];
  co2LandlordDeductionCents?: number;
  prepaymentCents: number;
}): OperatingCostResult {
  const recoverableRows: OperatingCostLine[] = [];
  const nonRecoverableRows: OperatingCostLine[] = [];
  for (const r of params.rows) {
    const line = {
      name: r.name,
      cents: r.unitShareCents,
      totalCents: r.totalCents,
      keyLabel: r.keyLabel,
    };
    if (r.recoverable) recoverableRows.push(line);
    else nonRecoverableRows.push(line);
  }
  const recoverableSumCents = recoverableRows.reduce((s, r) => s + r.cents, 0);
  // Der Vermieter-CO2-Anteil ist nach oben durch die umlagefähige Summe begrenzt
  // (nie negativer Mieteranteil).
  const co2LandlordDeductionCents = Math.min(
    Math.max(0, params.co2LandlordDeductionCents ?? 0),
    recoverableSumCents,
  );
  const tenantCostsCents = recoverableSumCents - co2LandlordDeductionCents;
  const balanceCents = tenantCostsCents - params.prepaymentCents;
  return {
    recoverableRows,
    nonRecoverableRows,
    recoverableSumCents,
    co2LandlordDeductionCents,
    tenantCostsCents,
    prepaymentCents: params.prepaymentCents,
    balanceCents,
  };
}
