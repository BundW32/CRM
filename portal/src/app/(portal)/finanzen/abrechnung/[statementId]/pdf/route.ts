import { NextResponse } from "next/server";
import { ownedUnitIdsInProperty, ownsProperty } from "@/lib/access";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { buildEinzelabrechnungPdf } from "@/lib/weg/einzelabrechnung-pdf";
import type { StatementView } from "@/lib/weg/statement-service";
import { pdfResponse } from "@/lib/documents/pdf-response";

export const dynamic = "force-dynamic";


// Eigene Einzelabrechnung eines Eigentümers als PDF (nur die Einheiten, die ihm
// gehören). Nur FERTIGe Abrechnungen (eingefrorener Snapshot) – Entwürfe sind
// Verwalter-Arbeitsstände.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ statementId: string }> },
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  const { statementId } = await params;

  const statement = await db.annualStatement.findFirst({
    where: { id: statementId, status: "FERTIG" },
    include: { property: { select: { id: true, name: true, organizationId: true } } },
  });
  if (!statement || !statement.snapshot) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
  if (!(await ownsProperty(user.id, statement.property.id, user.organizationId))) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  const myUnitIds = await ownedUnitIdsInProperty(user.id, statement.property.id);
  if (myUnitIds.length === 0) {
    return NextResponse.json({ error: "Keine Einheit zugeordnet" }, { status: 404 });
  }

  try {
    const view = statement.snapshot as unknown as StatementView;
    const myUnits = await db.unit.findMany({
      where: { id: { in: myUnitIds } },
      orderBy: [{ orderIndex: "asc" }, { label: "asc" }],
      select: { id: true, label: true },
    });

    const pdf = await buildEinzelabrechnungPdf({
      propertyName: statement.property.name,
      organizationId: statement.property.organizationId,
      view,
      units: myUnits,
      finalizedAt: statement.finalizedAt,
    });

    const fileName = `Meine_Einzelabrechnung_${view.year}.pdf`;
    return pdfResponse(pdf, fileName, request);
  } catch (err) {
    console.error("Eigentümer-Einzelabrechnung-PDF fehlgeschlagen", err);
    return NextResponse.json({ error: "Export fehlgeschlagen" }, { status: 500 });
  }
}
