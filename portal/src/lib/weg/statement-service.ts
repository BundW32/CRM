// Server-Service der Jahresabrechnung: lädt Buchhaltung/Sollstellungen/
// Eigentümerschaften aus der DB und rechnet sie über die pure Logik
// (annual-statement.ts) in ein JSON-fähiges View-Model. Dasselbe Model wird
// live gerendert (ENTWURF) und bei FERTIG als Snapshot eingefroren.
import type { DistributionKey, LaborShareType, LedgerAccountKind } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  computeLaborShares,
  computePeakAmounts,
  computeStatement,
  splitByOwnership,
} from "./annual-statement";
import { fiscalYearRange } from "./economic-plan";

export type StatementView = {
  year: number;
  fyStart: string; // ISO-Datum (inklusive)
  fyEnd: string; // ISO-Datum (exklusiv)
  rows: {
    costTypeId: string;
    name: string;
    distributionKey: DistributionKey;
    laborShareType: LaborShareType;
    totalCents: number;
    perUnit: Record<string, number> | null;
    error?: string;
  }[];
  errors: string[];
  perUnitTotal: Record<string, number>;
  duePerUnit: Record<string, number>;
  peak: Record<string, number>; // Abrechnungsspitze: + Nachschuss / − Guthaben
  labor: Record<string, { haushaltsnah: number; handwerker: number }>;
  ownerSplit: Record<
    string,
    { shares: { userName: string; days: number; cents: number }[]; uncoveredCents: number }
  >;
  accounts: {
    id: string;
    name: string;
    kind: LedgerAccountKind;
    startCents: number;
    inCents: number;
    outCents: number;
    transferNetCents: number;
    endCents: number;
  }[];
  incomeCents: number;
  totalExpenseCents: number;
  reserveTransferCents: number;
  receivablesCents: number; // Forderungen (Hausgeldrückstände) zum Stichtag
};

type BookingGroup = {
  accountId: string;
  kind: string;
  transferOut: boolean | null;
  _sum: { amountCents: number | null };
};

// Vorzeichenrichtige Summe der Buchungsgruppen eines Kontos
function signedSum(groups: BookingGroup[], accountId: string): number {
  let sum = 0;
  for (const g of groups) {
    if (g.accountId !== accountId) continue;
    const amount = g._sum.amountCents ?? 0;
    if (g.kind === "EINNAHME") sum += amount;
    else if (g.kind === "AUSGABE") sum -= amount;
    else sum += g.transferOut ? -amount : amount;
  }
  return sum;
}

export async function computeStatementView(
  property: { id: string; fiscalYearStartMonth: number },
  year: number,
  statementId: string,
): Promise<StatementView> {
  const { start, end } = fiscalYearRange(year, property.fiscalYearStartMonth);
  const inYear = { gte: start, lt: end };

  const [costTypes, units, expenseGroups, otherAgg, incomeAgg, accounts, beforeGroups, yearGroups, manualRows, dueGroups, ownerships, paidGroups] =
    await Promise.all([
      db.costType.findMany({
        where: { propertyId: property.id },
        orderBy: [{ orderIndex: "asc" }, { name: "asc" }],
        select: { id: true, name: true, distributionKey: true, laborShareType: true },
      }),
      db.unit.findMany({
        where: { propertyId: property.id },
        orderBy: [{ orderIndex: "asc" }, { label: "asc" }],
        select: { id: true, mea: true, livingArea: true, personCount: true },
      }),
      db.booking.groupBy({
        by: ["costTypeId"],
        where: { propertyId: property.id, kind: "AUSGABE", costTypeId: { not: null }, bookingDate: inYear },
        _sum: { amountCents: true },
      }),
      db.booking.aggregate({
        where: { propertyId: property.id, kind: "AUSGABE", costTypeId: null, bookingDate: inYear },
        _sum: { amountCents: true },
      }),
      db.booking.aggregate({
        where: { propertyId: property.id, kind: "EINNAHME", bookingDate: inYear },
        _sum: { amountCents: true },
      }),
      db.ledgerAccount.findMany({
        where: { propertyId: property.id, active: true },
        orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
      }),
      db.booking.groupBy({
        by: ["accountId", "kind", "transferOut"],
        where: { propertyId: property.id, bookingDate: { lt: start } },
        _sum: { amountCents: true },
      }),
      db.booking.groupBy({
        by: ["accountId", "kind", "transferOut"],
        where: { propertyId: property.id, bookingDate: inYear },
        _sum: { amountCents: true },
      }),
      db.statementUnitAmount.findMany({ where: { statementId } }),
      db.duePosting.groupBy({
        by: ["unitId"],
        where: { propertyId: property.id, dueDate: inYear },
        _sum: { amountCents: true },
      }),
      db.unitOwnership.findMany({
        where: { unit: { propertyId: property.id } },
        include: { user: { select: { name: true } } },
      }),
      db.booking.groupBy({
        by: ["unitId"],
        where: { propertyId: property.id, kind: "EINNAHME", unitId: { not: null }, bookingDate: { lt: end } },
        _sum: { amountCents: true },
      }),
    ]);

  // Rücklagenzuführung (Ist): Umbuchungen, die auf Rücklagenkonten eingehen
  const reserveIds = new Set(accounts.filter((a) => a.kind === "RUECKLAGE").map((a) => a.id));
  let reserveTransferCents = 0;
  for (const g of yearGroups) {
    if (g.kind === "UMBUCHUNG" && g.transferOut === false && reserveIds.has(g.accountId)) {
      reserveTransferCents += g._sum.amountCents ?? 0;
    }
  }

  const manualAmounts = new Map<string, Map<string, number>>();
  for (const row of manualRows) {
    const inner = manualAmounts.get(row.costTypeId) ?? new Map<string, number>();
    inner.set(row.unitId, row.amountCents);
    manualAmounts.set(row.costTypeId, inner);
  }

  const result = computeStatement({
    costTypes,
    units,
    expenseByCostType: new Map(expenseGroups.map((g) => [g.costTypeId as string, g._sum.amountCents ?? 0])),
    otherExpenseCents: otherAgg._sum.amountCents ?? 0,
    manualAmounts,
    reserveTransferCents,
  });

  const duePerUnit = new Map(dueGroups.map((g) => [g.unitId, g._sum.amountCents ?? 0]));
  const peak = computePeakAmounts(result.perUnitTotal, duePerUnit);
  const labor = computeLaborShares(result.rows);

  // Tagesgenaue Eigentümer-Aufteilung des Kostenanteils je Einheit
  const ownershipsByUnit = new Map<string, typeof ownerships>();
  for (const o of ownerships) {
    const list = ownershipsByUnit.get(o.unitId) ?? [];
    list.push(o);
    ownershipsByUnit.set(o.unitId, list);
  }
  const ownerSplit: StatementView["ownerSplit"] = {};
  for (const [unitId, cents] of result.perUnitTotal) {
    const periods = (ownershipsByUnit.get(unitId) ?? []).map((o) => ({
      userId: o.userId,
      userName: o.user.name,
      validFrom: o.validFrom,
      validTo: o.validTo,
      sharePercent: o.sharePercent,
    }));
    const split = splitByOwnership(cents, periods, start, end);
    ownerSplit[unitId] = {
      shares: split.shares.map((s) => ({ userName: s.userName, days: s.days, cents: s.cents })),
      uncoveredCents: split.uncoveredCents,
    };
  }

  // Kontenblock der Gesamtabrechnung
  const accountViews = accounts.map((a) => {
    const startCents = a.openingBalanceCents + signedSum(beforeGroups, a.id);
    let inCents = 0;
    let outCents = 0;
    let transferNetCents = 0;
    for (const g of yearGroups) {
      if (g.accountId !== a.id) continue;
      const amount = g._sum.amountCents ?? 0;
      if (g.kind === "EINNAHME") inCents += amount;
      else if (g.kind === "AUSGABE") outCents += amount;
      else transferNetCents += g.transferOut ? -amount : amount;
    }
    return {
      id: a.id,
      name: a.name,
      kind: a.kind,
      startCents,
      inCents,
      outCents,
      transferNetCents,
      endCents: startCents + inCents - outCents + transferNetCents,
    };
  });

  // Forderungen zum Stichtag: Σ fällige Sollstellungen (< Ende) − zugeordnete
  // Zahlungen je Einheit, nur positive Salden (Rückstände)
  const dueAllGroups = await db.duePosting.groupBy({
    by: ["unitId"],
    where: { propertyId: property.id, dueDate: { lt: end } },
    _sum: { amountCents: true },
  });
  const paidByUnit = new Map(paidGroups.map((g) => [g.unitId as string, g._sum.amountCents ?? 0]));
  let receivablesCents = 0;
  for (const g of dueAllGroups) {
    const open = (g._sum.amountCents ?? 0) - (paidByUnit.get(g.unitId) ?? 0);
    if (open > 0) receivablesCents += open;
  }

  return {
    year,
    fyStart: start.toISOString().slice(0, 10),
    fyEnd: end.toISOString().slice(0, 10),
    rows: result.rows.map((r) => ({
      costTypeId: r.costTypeId,
      name: r.name,
      distributionKey: r.distributionKey,
      laborShareType: r.laborShareType,
      totalCents: r.totalCents,
      perUnit: r.perUnit ? Object.fromEntries(r.perUnit) : null,
      error: r.error,
    })),
    errors: result.errors,
    perUnitTotal: Object.fromEntries(result.perUnitTotal),
    duePerUnit: Object.fromEntries(duePerUnit),
    peak: Object.fromEntries(peak),
    labor: Object.fromEntries(labor.entries()),
    ownerSplit,
    accounts: accountViews,
    incomeCents: incomeAgg._sum.amountCents ?? 0,
    totalExpenseCents: result.totalExpenseCents,
    reserveTransferCents,
    receivablesCents,
  };
}
