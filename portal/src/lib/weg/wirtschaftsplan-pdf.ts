// Gemeinsamer Bauer für das Wirtschaftsplan-PDF (§ 28 Abs. 1 WEG): Gesamtplan +
// Einzelwirtschaftspläne. Wird sowohl von der Verwalter-Route als auch von der
// eigentümer-gescopten Route auf /finanzen genutzt, damit beide exakt dasselbe
// Dokument erzeugen.
import type { EconomicPlan, EconomicPlanItem, CostType, Unit } from "@/generated/prisma/client";
import { getBrandingForOrg } from "@/lib/branding-server";
import { distributionKeyLabels } from "@/lib/labels";
import { generateWirtschaftsplan, type WirtschaftsplanUnit } from "@/lib/documents/wirtschaftsplan";
import { computeUnitAdvances, monthlyInstallments } from "@/lib/weg/economic-plan";

type PlanWithItems = EconomicPlan & {
  items: (EconomicPlanItem & { costType: CostType })[];
};

export async function buildWirtschaftsplanPdf(args: {
  propertyName: string;
  organizationId: string;
  plan: PlanWithItems;
  units: Unit[];
}): Promise<Buffer> {
  const { propertyName, organizationId, plan, units } = args;

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

  const planUnits: WirtschaftsplanUnit[] = units.map((u) => {
    const annual = advances.perUnit.get(u.id) ?? 0;
    const rates = monthlyInstallments(annual);
    return {
      label: u.label,
      annualCents: annual,
      monthlyMinCents: Math.min(...rates),
      monthlyMaxCents: Math.max(...rates),
    };
  });

  const branding = await getBrandingForOrg(organizationId);
  return generateWirtschaftsplan({
    propertyName,
    issuer: {
      legalName: branding.legalName,
      contactLine: [branding.addressLine, branding.email].filter(Boolean).join(" · "),
    },
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
    generatedAt: new Date(),
  });
}
