import { NextResponse } from "next/server";
import { canVerwalterAccessProperty } from "@/lib/access";
import { AUDIT, logAudit } from "@/lib/audit";
import { getBrandingForOrg } from "@/lib/branding-server";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";
import { generateBetriebskosten } from "@/lib/documents/betriebskosten";
import { briefkopfAus } from "@/lib/documents/briefkopf";
import { deriveOperatingCostStatement } from "@/lib/weg/operating-cost-service";
import { fileNamePart, pdfResponse } from "@/lib/documents/pdf-response";

export const dynamic = "force-dynamic";

// Betriebskostenabrechnung einer vermieteten Einheit als DIN-A4-PDF. Verwalter im
// Objekt-Scope; leitet aus der FERTIGen WEG-Jahresabrechnung ab.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ propertyId: string }> },
) {
  const verwalter = await requireVerwalter();
  const { propertyId } = await params;
  if (!(await canVerwalterAccessProperty(verwalter, propertyId))) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }
  const property = await db.property.findFirst({
    where: { id: propertyId, organizationId: verwalter.organizationId, managementType: "WEG" },
    select: { id: true, name: true, city: true, organizationId: true },
  });
  if (!property) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const url = new URL(request.url);
  const statementId = url.searchParams.get("statement") ?? "";
  const unitId = url.searchParams.get("unit") ?? "";

  const data = await deriveOperatingCostStatement({
    organizationId: property.organizationId,
    propertyId: property.id,
    statementId,
    unitId,
  });
  if (!data) return NextResponse.json({ error: "Keine Abrechnungsdaten" }, { status: 404 });

  try {
    const branding = await getBrandingForOrg(property.organizationId);
    const kopf = await briefkopfAus(branding);
    const pdf = await generateBetriebskosten({
      issuer: kopf.issuer,
      brand: kopf.brand,
      logo: kopf.logo,
      propertyName: property.name,
      unitLabel: data.unitLabel,
      tenant: data.tenant,
      tenantAddress: data.tenant?.address ?? null,
      year: data.year,
      recoverableRows: data.result.recoverableRows,
      nonRecoverableRows: data.result.nonRecoverableRows,
      recoverableSumCents: data.result.recoverableSumCents,
      co2LandlordDeductionCents: data.result.co2LandlordDeductionCents,
      tenantCostsCents: data.result.tenantCostsCents,
      heatingPresent: data.heatingPresent,
      months: data.months,
      prepaymentMonthlyCents: data.prepaymentMonthlyCents,
      prepaymentCents: data.result.prepaymentCents,
      balanceCents: data.result.balanceCents,
      city: kopf.city ?? property.city ?? null,
      createdAt: new Date(),
    });

    await logAudit({
      actorId: verwalter.id,
      action: AUDIT.WEG_BK_STATEMENT_EXPORTED,
      targetType: "Unit",
      targetId: unitId,
      meta: { year: data.year },
    });

    const fileName = `Betriebskosten_${data.year}_${fileNamePart(data.unitLabel)}.pdf`;
    return pdfResponse(pdf, fileName, request);
  } catch (err) {
    console.error("Betriebskosten-PDF fehlgeschlagen", err);
    return NextResponse.json({ error: "Export fehlgeschlagen" }, { status: 500 });
  }
}
