// Leitet die Betriebskostenabrechnung einer vermieteten Einheit aus einer FERTIGen
// WEG-Jahresabrechnung ab (M-K). Gemeinsame Grundlage für Seite und PDF-Route.
import { db } from "@/lib/db";
import { co2PerUnit } from "@/lib/weg/co2-allocation";
import { umlageschluesselText } from "@/lib/weg/umlageschluessel-text";
import {
  baueUmlagebasis,
  schluesselMitAnteil,
  umlagebasisZeilen,
  type UmlagebasisZeile,
} from "@/lib/weg/umlagebasis";
import { computeOperatingCosts, type OperatingCostResult } from "@/lib/weg/operating-costs";
import type { StatementView } from "@/lib/weg/statement-service";

export type OperatingCostStatement = {
  year: number;
  unitLabel: string;
  tenantName: string | null;
  /**
   * Der Mieter mit Anrede und Anschrift — für den Brief. Ohne diese Angaben
   * stand im Anschriftfeld nur „An den Mieter" und die Einheit; damit war die
   * Abrechnung in keinem Fensterumschlag versendbar.
   */
  tenant: {
    name: string;
    salutation: string | null;
    lastName: string | null;
    /** „Straße\nPLZ Ort", sofern vollständig hinterlegt. */
    address: string | null;
  } | null;
  months: number;
  prepaymentMonthlyCents: number;
  co2Present: boolean;
  co2LandlordCents: number;
  /** Enthält die Abrechnung Heiz-/Warmwasserkosten? Dann braucht sie den Hinweis nach HeizkostenV. */
  heatingPresent: boolean;
  /** Bezugsgrößen der Einheit (MEA, Fläche, …) gegenüber dem Haus — für Kopf und Anlage. */
  umlagebasis: UmlagebasisZeile[];
  result: OperatingCostResult;
};

export async function deriveOperatingCostStatement(params: {
  organizationId: string;
  propertyId: string;
  statementId: string;
  unitId: string;
}): Promise<OperatingCostStatement | null> {
  const statement = await db.annualStatement.findFirst({
    where: { id: params.statementId, propertyId: params.propertyId, status: "FERTIG" },
    select: { year: true, snapshot: true },
  });
  if (!statement || !statement.snapshot) return null;
  const view = statement.snapshot as unknown as StatementView;

  const [unit, costTypes, allUnits, tenancy, allocation] = await Promise.all([
    db.unit.findFirst({ where: { id: params.unitId, propertyId: params.propertyId }, select: { label: true } }),
    db.costType.findMany({ where: { propertyId: params.propertyId }, select: { id: true, recoverableBetrKV: true } }),
    db.unit.findMany({
      where: { propertyId: params.propertyId },
      select: { id: true, label: true, mea: true, livingArea: true, personCount: true, unitType: true },
    }),
    db.tenancy.findFirst({
      where: { unitId: params.unitId, active: true },
      select: {
        bkPrepaymentMonthlyCents: true,
        user: {
          select: {
            name: true,
            salutation: true,
            lastName: true,
            street: true,
            zip: true,
            city: true,
          },
        },
      },
    }),
    db.co2Allocation.findFirst({ where: { propertyId: params.propertyId, year: statement.year } }),
  ]);
  if (!unit) return null;

  const recoverable = new Map(costTypes.map((c) => [c.id, c.recoverableBetrKV]));
  // Die Bezugsgrößen aus dem Snapshot — so, wie beim Rechnen gegolten. Ältere
  // Snapshots tragen sie nicht; dann die Stammdaten von heute.
  const basis = view.umlagebasis ?? baueUmlagebasis(allUnits);
  const verteilt = view.rows.filter((r) => r.perUnit && (r.perUnit[params.unitId] ?? 0) !== 0);
  const rows = verteilt.map((r) => ({
    name: r.name,
    unitShareCents: r.perUnit![params.unitId] ?? 0,
    recoverable: recoverable.get(r.costTypeId) ?? false,
    totalCents: r.totalCents,
    keyLabel: schluesselMitAnteil(umlageschluesselText(r), r, basis, params.unitId),
    heatingCost: Boolean(r.heatingCost),
  }));

  // Vermieter-CO2-Anteil dieser Einheit (falls für das Jahr erfasst).
  let co2LandlordCents = 0;
  if (allocation) {
    const alloc = co2PerUnit({
      totalCo2Cents: allocation.totalCo2Cents,
      emissionsKg: allocation.emissionsKg,
      units: allUnits,
    });
    co2LandlordCents = alloc.perUnit.get(params.unitId)?.landlord ?? 0;
  }

  const months = 12;
  const prepaymentMonthlyCents = tenancy?.bkPrepaymentMonthlyCents ?? 0;
  const result = computeOperatingCosts({
    rows,
    co2LandlordDeductionCents: co2LandlordCents,
    prepaymentCents: prepaymentMonthlyCents * months,
  });

  return {
    year: statement.year,
    unitLabel: unit.label,
    tenantName: tenancy?.user.name ?? null,
    tenant: tenancy
      ? {
          name: tenancy.user.name,
          salutation: tenancy.user.salutation,
          lastName: tenancy.user.lastName,
          address:
            tenancy.user.street && tenancy.user.zip && tenancy.user.city
              ? `${tenancy.user.street}\n${tenancy.user.zip} ${tenancy.user.city}`
              : null,
        }
      : null,
    months,
    prepaymentMonthlyCents,
    co2Present: Boolean(allocation),
    heatingPresent: rows.some((r) => r.heatingCost),
    umlagebasis: umlagebasisZeilen(verteilt, basis, params.unitId),
    co2LandlordCents,
    result,
  };
}
