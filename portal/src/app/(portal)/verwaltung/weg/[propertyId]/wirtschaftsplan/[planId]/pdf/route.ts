import { NextResponse } from "next/server";
import { canVerwalterAccessProperty } from "@/lib/access";
import { getBrandingForOrg } from "@/lib/branding-server";
import { db } from "@/lib/db";
import { distributionKeyLabels } from "@/lib/labels";
import { requireVerwalter } from "@/lib/session";
import { generateWirtschaftsplan, type WirtschaftsplanUnit } from "@/lib/documents/wirtschaftsplan";
import { computeUnitAdvances, monthlyInstallments } from "@/lib/weg/economic-plan";

export const dynamic = "force-dynamic";

// Wirtschaftsplan als PDF (Gesamtplan + Einzelwirtschaftspläne). Verwalter im
// Objekt-Scope. Enthält bei Entwürfen eine ENTWURF-Kennzeichnung.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ propertyId: string; planId: string }> },
) {
  const verwalter = await requireVerwalter();
  const { propertyId, planId } = await params;

  if (!(await canVerwalterAccessProperty(verwalter, propertyId))) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }
  const property = await db.property.findFirst({
    where: { id: propertyId, organizationId: verwalter.organizationId, managementType: "WEG" },
    select: { id: true, name: true, organizationId: true },
  });
  if (!property) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const [plan, units] = await Promise.all([
    db.economicPlan.findFirst({
      where: { id: planId, propertyId: property.id },
      include: { items: { include: { costType: true }, orderBy: { costType: { orderIndex: "asc" } } } },
    }),
    db.unit.findMany({
      where: { propertyId: property.id },
      orderBy: [{ orderIndex: "asc" }, { label: "asc" }],
    }),
  ]);
  if (!plan) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  try {
    const totalCents = plan.items.reduce((sum, i) => sum + i.amountCents, 0);
    const advances = computeUnitAdvances(
      plan.items.map((i) => ({
        costTypeId: i.costTypeId,
        distributionKey: i.costType.distributionKey,
        amountCents: i.amountCents,
      })),
      units,
    );

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

    const branding = await getBrandingForOrg(property.organizationId);
    const pdf = await generateWirtschaftsplan({
      propertyName: property.name,
      issuer: {
        legalName: branding.legalName,
        contactLine: [branding.addressLine, branding.email].filter(Boolean).join(" · "),
      },
      year: plan.year,
      resolved: plan.status === "BESCHLOSSEN" && plan.resolvedAt
        ? { date: plan.resolvedAt, note: plan.resolutionNote }
        : null,
      positions: plan.items.map((i) => ({
        name: i.costType.name,
        keyLabel: distributionKeyLabels[i.costType.distributionKey] ?? i.costType.distributionKey,
        amountCents: i.amountCents,
      })),
      totalCents,
      units: planUnits,
      generatedAt: new Date(),
    });

    const fileName = `Wirtschaftsplan_${plan.year}_${property.name.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("Wirtschaftsplan-PDF fehlgeschlagen", err);
    // Häufigster Fall: unvollständige Stammdaten (z. B. MEA) → 422 statt 500
    const msg = err instanceof Error ? err.message : "Export fehlgeschlagen";
    return NextResponse.json({ error: msg }, { status: 422 });
  }
}
