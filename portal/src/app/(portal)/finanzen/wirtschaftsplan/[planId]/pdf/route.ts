import { NextResponse } from "next/server";
import { ownedUnitIdsInProperty, ownsProperty } from "@/lib/access";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import {
  buildEinzelwirtschaftsplanPdf,
  buildWirtschaftsplanPdf,
  ownerNamesByUnit,
} from "@/lib/weg/wirtschaftsplan-pdf";
import { fileNamePart, pdfResponse } from "@/lib/documents/pdf-response";
import { rundungFuerPlan } from "@/lib/weg/economic-plan";

export const dynamic = "force-dynamic";

// Wirtschaftsplan als PDF für einen Eigentümer. Nur BESCHLOSSENe Pläne —
// Entwürfe sind Verwalter-Arbeitsstände.
//
// `?dokument=einzelplan` liefert den **eigenen** Einzelwirtschaftsplan. Anders
// als beim Verwalter ist die Einheit nicht frei wählbar: Gefiltert wird auf die
// Einheiten, die dem Anmelder gehören. Ohne eigene Einheit im Objekt gibt es
// den Einzelplan nicht — der Gesamtplan bleibt zugänglich, er ist ohnehin
// Beschlussgegenstand der Gemeinschaft.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  const { planId } = await params;

  const plan = await db.economicPlan.findFirst({
    where: { id: planId, status: "BESCHLOSSEN" },
    include: {
      property: { select: { id: true, name: true, organizationId: true, hausgeldRounding: true } },
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
    const einzelplan = new URL(request.url).searchParams.get("dokument") === "einzelplan";
    // Nur beschlossene Pläne kommen hier an — die Rundung steht also am Plan
    // fest und bleibt es, auch wenn das Objekt später umgestellt wird.
    const rounding = rundungFuerPlan(plan, plan.property);
    if (!einzelplan) {
      const pdf = await buildWirtschaftsplanPdf({
        propertyName: plan.property.name,
        organizationId: plan.property.organizationId,
        plan,
        units,
        rounding,
      });
      return pdfResponse(
        pdf,
        `Wirtschaftsplan_${plan.year}_${fileNamePart(plan.property.name)}.pdf`,
        request,
      );
    }

    // Eigene Einheiten — die Verteilung braucht trotzdem ALLE Einheiten, sonst
    // stimmten die Gewichte nicht. Gefiltert wird erst bei der Ausgabe.
    const eigene = new Set(await ownedUnitIdsInProperty(user.id, plan.property.id));
    if (eigene.size === 0) {
      return NextResponse.json({ error: "Keine eigene Einheit in diesem Objekt" }, { status: 404 });
    }
    const pdf = await buildEinzelwirtschaftsplanPdf({
      propertyName: plan.property.name,
      organizationId: plan.property.organizationId,
      plan,
      units,
      rounding,
      ownerNamesByUnit: await ownerNamesByUnit([...eigene]),
      onlyUnitIds: [...eigene],
    });
    return pdfResponse(pdf, `Einzelwirtschaftsplan_${plan.year}.pdf`, request);
  } catch (err) {
    console.error("Wirtschaftsplan-PDF (Eigentümer) fehlgeschlagen", err);
    const msg = err instanceof Error ? err.message : "Export fehlgeschlagen";
    return NextResponse.json({ error: msg }, { status: 422 });
  }
}
