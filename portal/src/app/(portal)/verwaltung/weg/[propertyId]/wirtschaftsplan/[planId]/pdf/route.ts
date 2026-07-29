import { NextResponse } from "next/server";
import { canVerwalterAccessProperty } from "@/lib/access";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";
import {
  buildEinzelwirtschaftsplanPdf,
  buildWirtschaftsplanPdf,
  ownerNamesByUnit,
} from "@/lib/weg/wirtschaftsplan-pdf";
import { fileNamePart, pdfResponse } from "@/lib/documents/pdf-response";

export const dynamic = "force-dynamic";

// Wirtschaftsplan als PDF. Verwalter im Objekt-Scope; Entwürfe tragen eine
// ENTWURF-Kennzeichnung.
//
// Zwei Dokumente, wie § 28 Abs. 1 WEG sie verlangt:
//   ohne Parameter               → Gesamtplan mit Übersicht aller Einheiten
//   ?dokument=einzelplan         → Einzelwirtschaftspläne, eine Seite je Einheit
//   ?dokument=einzelplan&einheit → nur diese Einheit (Einzelversand)
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

  const url = new URL(request.url);
  const einzelplan = url.searchParams.get("dokument") === "einzelplan";
  const einheitId = url.searchParams.get("einheit") ?? undefined;
  if (einheitId && !units.some((u) => u.id === einheitId)) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  try {
    const pdf = einzelplan
      ? await buildEinzelwirtschaftsplanPdf({
          propertyName: property.name,
          organizationId: property.organizationId,
          plan,
          units,
          ownerNamesByUnit: await ownerNamesByUnit(units.map((u) => u.id)),
          onlyUnitIds: einheitId ? [einheitId] : undefined,
        })
      : await buildWirtschaftsplanPdf({
          propertyName: property.name,
          organizationId: property.organizationId,
          plan,
          units,
        });

    const einheitLabel = einheitId ? units.find((u) => u.id === einheitId)?.label : undefined;
    const fileName = einzelplan
      ? `Einzelwirtschaftsplan_${plan.year}_${fileNamePart(einheitLabel ?? property.name)}.pdf`
      : `Wirtschaftsplan_${plan.year}_${fileNamePart(property.name)}.pdf`;
    return pdfResponse(pdf, fileName, request);
  } catch (err) {
    console.error("Wirtschaftsplan-PDF fehlgeschlagen", err);
    // Häufigster Fall: unvollständige Stammdaten (z. B. MEA) → 422 statt 500
    const msg = err instanceof Error ? err.message : "Export fehlgeschlagen";
    return NextResponse.json({ error: msg }, { status: 422 });
  }
}
