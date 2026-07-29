import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";
import { canVerwalterAccessProperty } from "@/lib/access";
import { buildEinzelabrechnungPdf } from "@/lib/weg/einzelabrechnung-pdf";
import { computeStatementView, type StatementView } from "@/lib/weg/statement-service";
import { fileNamePart, pdfResponse } from "@/lib/documents/pdf-response";

export const dynamic = "force-dynamic";


// Einzelabrechnungen eines Jahres als PDF (eine Seite je Einheit). Optional
// ?einheit=<unitId> für nur eine Einheit (Einzelversand/-druck). Verwalter im
// Objekt-Scope. FERTIG: eingefrorener Snapshot; ENTWURF: live gerechnet (mit
// ENTWURF-Kennzeichnung im PDF).
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
    const allUnits = await db.unit.findMany({
      where: { propertyId: property.id, ...(onlyUnitId ? { id: onlyUnitId } : {}) },
      orderBy: [{ orderIndex: "asc" }, { label: "asc" }],
      select: { id: true, label: true },
    });
    if (allUnits.length === 0) return NextResponse.json({ error: "Keine Einheit" }, { status: 404 });

    const pdf = await buildEinzelabrechnungPdf({
      propertyName: property.name,
      organizationId: property.organizationId,
      view,
      units: allUnits,
      finalizedAt: statement.finalizedAt,
    });

    const suffix = onlyUnitId ? `_${fileNamePart(allUnits[0].label)}` : "";
    const fileName = `Einzelabrechnung_${view.year}_${fileNamePart(property.name)}${suffix}.pdf`;
    return pdfResponse(pdf, fileName, request);
  } catch (err) {
    console.error("Einzelabrechnung-PDF fehlgeschlagen", err);
    return NextResponse.json({ error: "Export fehlgeschlagen" }, { status: 500 });
  }
}
