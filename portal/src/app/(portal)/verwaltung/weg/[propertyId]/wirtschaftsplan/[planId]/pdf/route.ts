import { NextResponse } from "next/server";
import { canVerwalterAccessProperty } from "@/lib/access";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";
import { buildWirtschaftsplanPdf } from "@/lib/weg/wirtschaftsplan-pdf";
import { fileNamePart, pdfResponse } from "@/lib/documents/pdf-response";

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
    const pdf = await buildWirtschaftsplanPdf({
      propertyName: property.name,
      organizationId: property.organizationId,
      plan,
      units,
    });

    const fileName = `Wirtschaftsplan_${plan.year}_${fileNamePart(property.name)}.pdf`;
    return pdfResponse(pdf, fileName, request);
  } catch (err) {
    console.error("Wirtschaftsplan-PDF fehlgeschlagen", err);
    // Häufigster Fall: unvollständige Stammdaten (z. B. MEA) → 422 statt 500
    const msg = err instanceof Error ? err.message : "Export fehlgeschlagen";
    return NextResponse.json({ error: msg }, { status: 422 });
  }
}
