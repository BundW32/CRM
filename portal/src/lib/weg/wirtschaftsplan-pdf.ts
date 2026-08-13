// Gemeinsamer Bauer für das Wirtschaftsplan-PDF (§ 28 Abs. 1 WEG): Gesamtplan +
// Einzelwirtschaftspläne. Wird sowohl von der Verwalter-Route als auch von der
// eigentümer-gescopten Route auf /finanzen genutzt, damit beide exakt dasselbe
// Dokument erzeugen.
import type {
  EconomicPlan,
  EconomicPlanItem,
  CostType,
  HausgeldRounding,
  Unit,
} from "@/generated/prisma/client";
import { getBrandingForOrg } from "@/lib/branding-server";
import { briefkopfAus } from "@/lib/documents/briefkopf";
import { db } from "@/lib/db";
import { distributionKeyLabels } from "@/lib/labels";
import { generateEinzelwirtschaftsplaene } from "@/lib/documents/einzelwirtschaftsplan";
import { generateWirtschaftsplan, type WirtschaftsplanUnit } from "@/lib/documents/wirtschaftsplan";
import { computeUnitAdvances, monthlyInstallmentPlan } from "@/lib/weg/economic-plan";

type PlanWithItems = EconomicPlan & {
  items: (EconomicPlanItem & { costType: CostType })[];
};

// Rundung der Monatsraten. Aufrufer reichen `rundungFuerPlan(plan, property)`
// durch; fehlt sie, bleibt es beim centgenauen Altverhalten.
type MitRundung = { rounding?: HausgeldRounding };

export async function buildWirtschaftsplanPdf(args: {
  propertyName: string;
  organizationId: string;
  plan: PlanWithItems;
  units: Unit[];
} & MitRundung): Promise<Buffer> {
  const { propertyName, organizationId, plan, units } = args;
  const rounding = args.rounding ?? "CENT";

  const advances = computeUnitAdvances(
    plan.items.map((i) => ({
      costTypeId: i.costTypeId,
      distributionKey: i.costType.distributionKey,
      amountCents: i.amountCents,
      category: i.costType.category,
    })),
    units,
  );
  // Vorschussbedarf = Ausgaben − Einnahmen (§ 28 Abs. 1 WEG).
  const totalCents = advances.totalCents;

  const planUnits: WirtschaftsplanUnit[] = units.map((u) => ({
    label: u.label,
    raten: monthlyInstallmentPlan(advances.perUnit.get(u.id) ?? 0, rounding),
  }));

  const kopf = await briefkopfAus(await getBrandingForOrg(organizationId));
  return generateWirtschaftsplan({
    propertyName,
    issuer: kopf.issuer,
    brand: kopf.brand,
    logo: kopf.logo,
    year: plan.year,
    resolved:
      plan.status === "BESCHLOSSEN" && plan.resolvedAt
        ? { date: plan.resolvedAt, note: plan.resolutionNote }
        : null,
    positions: plan.items.map((i) => ({
      name: i.costType.category === "ERTRAG" ? `${i.costType.name} (Einnahme)` : i.costType.name,
      keyLabel: distributionKeyLabels[i.costType.distributionKey] ?? i.costType.distributionKey,
      amountCents: i.costType.category === "ERTRAG" ? -i.amountCents : i.amountCents,
    })),
    totalCents,
    units: planUnits,
    rounding,
    generatedAt: new Date(),
  });
}

// ── Einzelwirtschaftspläne (§ 28 Abs. 1 WEG) ────────────────────────────────
// Je Einheit eine Seite mit der Aufschlüsselung nach Kostenposition. Die
// Rechenarbeit dafür liegt in `computeUnitAdvances().perItem` und wurde bisher
// nirgends verwendet — das Plan-PDF zeigte nur Summen je Einheit.
//
// `onlyUnitIds` grenzt die Ausgabe ein (Einzelversand beim Verwalter, eigene
// Einheiten beim Eigentümer). Gerechnet wird immer über **alle** Einheiten —
// sonst stimmten die Verteilungsgewichte nicht.
export async function buildEinzelwirtschaftsplanPdf(args: {
  propertyName: string;
  organizationId: string;
  plan: PlanWithItems;
  units: Unit[];
  ownerNamesByUnit?: Map<string, string[]>;
  onlyUnitIds?: string[];
} & MitRundung): Promise<Buffer> {
  const { propertyName, organizationId, plan, units, ownerNamesByUnit, onlyUnitIds } = args;
  const rounding = args.rounding ?? "CENT";

  const advances = computeUnitAdvances(
    plan.items.map((i) => ({
      costTypeId: i.costTypeId,
      distributionKey: i.costType.distributionKey,
      amountCents: i.amountCents,
      category: i.costType.category,
    })),
    units,
  );

  const auswahl = onlyUnitIds ? new Set(onlyUnitIds) : null;
  const gewaehlt = auswahl ? units.filter((u) => auswahl.has(u.id)) : units;

  const kopf = await briefkopfAus(await getBrandingForOrg(organizationId));
  return generateEinzelwirtschaftsplaene({
    propertyName,
    issuer: kopf.issuer,
    brand: kopf.brand,
    logo: kopf.logo,
    year: plan.year,
    resolved:
      plan.status === "BESCHLOSSEN" && plan.resolvedAt
        ? { date: plan.resolvedAt, note: plan.resolutionNote }
        : null,
    units: gewaehlt.map((u) => {
      const raten = monthlyInstallmentPlan(advances.perUnit.get(u.id) ?? 0, rounding);
      return {
        label: u.label,
        ownerNames: ownerNamesByUnit?.get(u.id) ?? [],
        positions: plan.items
          .map((i) => ({
            name: i.costType.category === "ERTRAG" ? `${i.costType.name} (Einnahme)` : i.costType.name,
            keyLabel:
              distributionKeyLabels[i.costType.distributionKey] ?? i.costType.distributionKey,
            totalCents: i.amountCents,
            shareCents: advances.perItem.get(i.costTypeId)?.get(u.id) ?? 0,
          }))
          // Positionen ohne Planwert würden die Seite mit Nullzeilen füllen.
          .filter((p) => p.totalCents > 0),
        raten,
      };
    }),
    generatedAt: new Date(),
  });
}

/** Aktuelle Eigentümer je Einheit — für die Anrede im Einzelwirtschaftsplan. */
export async function ownerNamesByUnit(unitIds: string[]): Promise<Map<string, string[]>> {
  const now = new Date();
  const rows = await db.unitOwnership.findMany({
    where: {
      unitId: { in: unitIds },
      validFrom: { lte: now },
      OR: [{ validTo: null }, { validTo: { gt: now } }],
    },
    select: { unitId: true, user: { select: { name: true } } },
    orderBy: { validFrom: "asc" },
  });
  const map = new Map<string, string[]>();
  for (const r of rows) {
    map.set(r.unitId, [...(map.get(r.unitId) ?? []), r.user.name]);
  }
  return map;
}
