import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";
import { canVerwalterAccessProperty } from "@/lib/access";
import { buildSteuerbescheinigungPdf } from "@/lib/weg/steuerbescheinigung-pdf";
import { computeStatementView, type StatementView } from "@/lib/weg/statement-service";
import { fileNamePart, pdfResponse } from "@/lib/documents/pdf-response";

export const dynamic = "force-dynamic";

// Bescheinigung nach § 35a EStG — ein Blatt je Einheit, optional
// ?einheit=<unitId> für nur eine. Gleiche Zugriffsregeln wie die
// Einzelabrechnung: Verwalter im Objekt-Scope; FERTIG aus dem Snapshot,
// ENTWURF live gerechnet und als Entwurf gekennzeichnet.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ propertyId: string; statementId: string }> },
) {
  const verwalter = await requireVerwalter();
  const { propertyId, statementId } = await params;

  if (!(await canVerwalterAccessProperty(verwalter, propertyId))) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }
  const property = await db.property.findFirst({
    where: { id: propertyId, organizationId: verwalter.organizationId, managementType: "WEG" },
    select: { id: true, name: true, organizationId: true, fiscalYearStartMonth: true },
  });
  if (!property) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const statement = await db.annualStatement.findFirst({
    where: { id: statementId, propertyId: property.id },
  });
  if (!statement) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  try {
    const view: StatementView =
      statement.status === "FERTIG" && statement.snapshot
        ? (statement.snapshot as unknown as StatementView)
        : await computeStatementView(property, statement.year, statement.id);

    const onlyUnitId = new URL(request.url).searchParams.get("einheit");
    const units = await db.unit.findMany({
      where: { propertyId: property.id, ...(onlyUnitId ? { id: onlyUnitId } : {}) },
      orderBy: [{ orderIndex: "asc" }, { label: "asc" }],
      select: { id: true, label: true },
    });
    if (units.length === 0) return NextResponse.json({ error: "Keine Einheit" }, { status: 404 });

    const pdf = await buildSteuerbescheinigungPdf({
      propertyName: property.name,
      organizationId: property.organizationId,
      view,
      units,
      finalizedAt: statement.finalizedAt,
    });

    const suffix = onlyUnitId ? `_${fileNamePart(units[0].label)}` : "";
    const fileName = `Bescheinigung_35a_${view.year}_${fileNamePart(property.name)}${suffix}.pdf`;
    return pdfResponse(pdf, fileName, request);
  } catch (err) {
    console.error("Steuerbescheinigung-PDF fehlgeschlagen", err);
    return NextResponse.json({ error: "Export fehlgeschlagen" }, { status: 500 });
  }
}
