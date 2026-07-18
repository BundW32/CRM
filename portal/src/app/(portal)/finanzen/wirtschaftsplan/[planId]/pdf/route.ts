import { NextResponse } from "next/server";
import { ownsProperty } from "@/lib/access";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { buildWirtschaftsplanPdf } from "@/lib/weg/wirtschaftsplan-pdf";

export const dynamic = "force-dynamic";

// Wirtschaftsplan als PDF für einen Eigentümer (Gesamtplan + Einzelwirtschafts-
// pläne). Nur BESCHLOSSENe Pläne — Entwürfe sind Verwalter-Arbeitsstände.
// Analog zur eigenen Einzelabrechnung: Zugriff über die Eigentümerstellung.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  const { planId } = await params;

  const plan = await db.economicPlan.findFirst({
    where: { id: planId, status: "BESCHLOSSEN" },
    include: {
      property: { select: { id: true, name: true, organizationId: true } },
      items: { include: { costType: true }, orderBy: { costType: { orderIndex: "asc" } } },
    },
  });
  if (!plan) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  if (!(await ownsProperty(user.id, plan.property.id, user.organizationId))) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  try {
    const units = await db.unit.findMany({
      where: { propertyId: plan.property.id },
      orderBy: [{ orderIndex: "asc" }, { label: "asc" }],
    });
    const pdf = await buildWirtschaftsplanPdf({
      propertyName: plan.property.name,
      organizationId: plan.property.organizationId,
      plan,
      units,
    });

    const fileName = `Wirtschaftsplan_${plan.year}_${plan.property.name.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("Wirtschaftsplan-PDF (Eigentümer) fehlgeschlagen", err);
    const msg = err instanceof Error ? err.message : "Export fehlgeschlagen";
    return NextResponse.json({ error: msg }, { status: 422 });
  }
}
