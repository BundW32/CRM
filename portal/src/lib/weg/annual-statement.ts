// Jahresabrechnungs-Logik (§ 28 Abs. 2 WEG): Verteilung der Ist-Kosten auf die
// Einheiten (strikte Schlüssel; VERBRAUCH/INDIVIDUELL/FESTBETRAG aus manueller
// Erfassung, z. B. Messdienst), Abrechnungsspitze gegen die Soll-Vorschüsse,
// §35a-Ausweis und tagesgenaue Aufteilung bei Eigentümerwechsel.
// Pure Funktionen — DB/UI übernehmen die Server Actions.
import type { DistributionKey, LaborShareType } from "@/generated/prisma/client";
import { distributeByWeight, weightsForKey, type UnitForDistribution } from "./distribution";

// Schlüssel, die in der Abrechnung eine manuelle Verteilung je Einheit brauchen
export const MANUAL_KEYS: DistributionKey[] = ["VERBRAUCH", "FESTBETRAG", "INDIVIDUELL"];

export type StatementCostTypeInput = {
  id: string;
  name: string;
  distributionKey: DistributionKey;
  laborShareType: LaborShareType;
};

export type StatementInput = {
  costTypes: StatementCostTypeInput[];
  units: UnitForDistribution[];
  // Ist-Ausgaben je Kostenart im Wirtschaftsjahr (Cent, positiv)
  expenseByCostType: Map<string, number>;
  // Ausgaben ohne Kostenart (nicht umlegbar → Prüffehler)
  otherExpenseCents: number;
  // manuelle Verteilung je Kostenart → Einheit (für MANUAL_KEYS)
  manualAmounts: Map<string, Map<string, number>>;
  // tatsächliche Umbuchungen Giro → Rücklage im Jahr (werden nach MEA verteilt)
  reserveTransferCents: number;
};

export type StatementCostRow = {
  costTypeId: string;
  name: string;
  distributionKey: DistributionKey;
  laborShareType: LaborShareType;
  totalCents: number;
  perUnit: Map<string, number> | null; // null, wenn Verteilung (noch) nicht möglich
  error?: string;
};

export type StatementResult = {
  rows: StatementCostRow[];
  perUnitTotal: Map<string, number>; // Kostenanteil je Einheit (inkl. Rücklagen-Ist)
  totalExpenseCents: number; // Σ verteilte Kosten (ohne Rücklage)
  reserveTransferCents: number;
  errors: string[]; // Prüfliste — leer = verteilungsplausibel
};

export const RESERVE_ROW_ID = "__ruecklage__";

// Verteilt alle Ist-Kosten des Jahres auf die Einheiten.
export function computeStatement(input: StatementInput): StatementResult {
  const rows: StatementCostRow[] = [];
  const errors: string[] = [];
  const perUnitTotal = new Map<string, number>(input.units.map((u) => [u.id, 0]));
  let totalExpenseCents = 0;

  const addToUnits = (shares: Map<string, number>) => {
    for (const [unitId, cents] of shares) {
      perUnitTotal.set(unitId, (perUnitTotal.get(unitId) ?? 0) + cents);
    }
  };

  for (const ct of input.costTypes) {
    const totalCents = input.expenseByCostType.get(ct.id) ?? 0;
    const manual = input.manualAmounts.get(ct.id);
    if (totalCents === 0 && (!manual || manual.size === 0)) continue;
    totalExpenseCents += totalCents;

    const row: StatementCostRow = {
      costTypeId: ct.id,
      name: ct.name,
      distributionKey: ct.distributionKey,
      laborShareType: ct.laborShareType,
      totalCents,
      perUnit: null,
    };

    if (MANUAL_KEYS.includes(ct.distributionKey)) {
      const manualSum = manual ? [...manual.values()].reduce((a, b) => a + b, 0) : 0;
      if (manualSum !== totalCents) {
        row.error = `Manuelle Verteilung unvollständig: erfasst ${manualSum} von ${totalCents} Cent.`;
        errors.push(`${ct.name}: ${row.error}`);
      } else {
        row.perUnit = new Map(manual);
      }
    } else {
      try {
        row.perUnit = distributeByWeight(totalCents, weightsForKey(input.units, ct.distributionKey));
      } catch (e) {
        row.error = e instanceof Error ? e.message : "Verteilung nicht möglich.";
        errors.push(`${ct.name}: ${row.error}`);
      }
    }
    if (row.perUnit) addToUnits(row.perUnit);
    rows.push(row);
  }

  // Tatsächliche Rücklagenzuführung (Umbuchungen) als eigene Position nach MEA
  if (input.reserveTransferCents > 0) {
    const row: StatementCostRow = {
      costTypeId: RESERVE_ROW_ID,
      name: "Zuführung Erhaltungsrücklage (Ist)",
      distributionKey: "MEA",
      laborShareType: "KEINE",
      totalCents: input.reserveTransferCents,
      perUnit: null,
    };
    try {
      row.perUnit = distributeByWeight(input.reserveTransferCents, weightsForKey(input.units, "MEA"));
      addToUnits(row.perUnit);
    } catch (e) {
      row.error = e instanceof Error ? e.message : "Verteilung nicht möglich.";
      errors.push(`Rücklagenzuführung: ${row.error}`);
    }
    rows.push(row);
  }

  if (input.otherExpenseCents > 0) {
    errors.push(
      `Ausgaben ohne Kostenart: ${input.otherExpenseCents} Cent sind keiner Kostenart zugeordnet und können nicht umgelegt werden.`,
    );
  }

  return {
    rows,
    perUnitTotal,
    totalExpenseCents,
    reserveTransferCents: input.reserveTransferCents,
    errors,
  };
}

// Abrechnungsspitze je Einheit (§ 28 Abs. 2 WEG): Kostenanteil − Soll-Vorschüsse.
// Positiv = Nachschuss, negativ = Guthaben. Gerechnet gegen das SOLL —
// Zahlungsrückstände bleiben davon unberührt offene Forderungen.
export function computePeakAmounts(
  perUnitTotal: Map<string, number>,
  duePerUnit: Map<string, number>,
): Map<string, number> {
  const result = new Map<string, number>();
  const unitIds = new Set([...perUnitTotal.keys(), ...duePerUnit.keys()]);
  for (const unitId of unitIds) {
    result.set(unitId, (perUnitTotal.get(unitId) ?? 0) - (duePerUnit.get(unitId) ?? 0));
  }
  return result;
}

// §35a-EStG-Ausweis je Einheit: begünstigte Aufwendungen aus den geflaggten
// Kostenarten (Hinweis in der UI: maßgeblich ist der Lohn-/Fahrtkostenanteil
// laut Rechnung — Muster, ersetzt keine Steuerberatung).
export function computeLaborShares(
  rows: StatementCostRow[],
): Map<string, { haushaltsnah: number; handwerker: number }> {
  const result = new Map<string, { haushaltsnah: number; handwerker: number }>();
  for (const row of rows) {
    if (row.laborShareType === "KEINE" || !row.perUnit) continue;
    for (const [unitId, cents] of row.perUnit) {
      const entry = result.get(unitId) ?? { haushaltsnah: 0, handwerker: 0 };
      if (row.laborShareType === "HAUSHALTSNAHE_DIENSTLEISTUNG") entry.haushaltsnah += cents;
      else entry.handwerker += cents;
      result.set(unitId, entry);
    }
  }
  return result;
}

// ── Tagesgenaue Aufteilung bei Eigentümerwechsel ─────────────────────────────

export type OwnershipPeriod = {
  userId: string;
  userName: string;
  validFrom: Date;
  validTo: Date | null; // null = offen
  sharePercent: number; // Anteil bei Miteigentum derselben Einheit
};

export type OwnerShare = { userId: string; userName: string; days: number; cents: number };

const DAY_MS = 24 * 60 * 60 * 1000;

// Teilt einen Einheiten-Betrag tagesgenau auf die Eigentümer des
// Wirtschaftsjahres [fyStart, fyEnd) auf. Nicht abgedeckte Tage landen in
// uncoveredCents (Hinweis in der UI, z. B. Eigentümer noch nicht erfasst).
export function splitByOwnership(
  amountCents: number,
  periods: OwnershipPeriod[],
  fyStart: Date,
  fyEnd: Date,
): { shares: OwnerShare[]; uncoveredCents: number } {
  if (amountCents === 0 || periods.length === 0) {
    return { shares: [], uncoveredCents: amountCents };
  }
  const totalDays = Math.round((fyEnd.getTime() - fyStart.getTime()) / DAY_MS);
  const weighted = periods
    .map((p, index) => {
      const from = Math.max(p.validFrom.getTime(), fyStart.getTime());
      const to = Math.min((p.validTo ?? fyEnd).getTime(), fyEnd.getTime());
      const days = Math.max(0, Math.round((to - from) / DAY_MS));
      return { ...p, days, weight: days * p.sharePercent, key: `${p.userId}#${index}` };
    })
    .filter((p) => p.weight > 0);
  if (weighted.length === 0) return { shares: [], uncoveredCents: amountCents };

  const coveredWeight = weighted.reduce((sum, p) => sum + p.weight, 0);
  const fullWeight = totalDays * 100;
  const uncoveredWeight = Math.max(0, fullWeight - coveredWeight);

  const UNCOVERED = "__uncovered__";
  const shares = distributeByWeight(amountCents, [
    ...weighted.map((p) => ({ unitId: p.key, weight: p.weight })),
    ...(uncoveredWeight > 0 ? [{ unitId: UNCOVERED, weight: uncoveredWeight }] : []),
  ]);

  return {
    shares: weighted.map((p) => ({
      userId: p.userId,
      userName: p.userName,
      days: p.days,
      cents: shares.get(p.key) ?? 0,
    })),
    uncoveredCents: shares.get(UNCOVERED) ?? 0,
  };
}
