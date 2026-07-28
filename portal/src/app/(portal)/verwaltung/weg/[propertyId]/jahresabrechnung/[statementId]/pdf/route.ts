import { NextResponse } from "next/server";
import { getBrandingForOrg } from "@/lib/branding-server";
import { db } from "@/lib/db";
import { distributionKeyLabels } from "@/lib/labels";
import { requireVerwalter } from "@/lib/session";
import { canVerwalterAccessProperty } from "@/lib/access";
import { generateEinzelabrechnungen, type EinzelabrechnungUnit } from "@/lib/documents/einzelabrechnung";
import { computeStatementView, type StatementView } from "@/lib/weg/statement-service";
import { fileNamePart, pdfResponse } from "@/lib/documents/pdf-response";

export const dynamic = "force-dynamic";

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

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

    const units: EinzelabrechnungUnit[] = allUnits.map((u) => {
      const split = view.ownerSplit[u.id];
      const labor = view.labor[u.id];
      return {
        label: u.label,
        owners: (split?.shares ?? []).map((s) => ({ name: s.userName, days: s.days, cents: s.cents })),
        uncoveredCents: split?.uncoveredCents ?? 0,
        costRows: view.rows
          .filter((r) => r.perUnit)
          .map((r) => ({
            name: r.name,
            keyLabel: distributionKeyLabels[r.distributionKey] ?? r.distributionKey,
            totalCents: r.totalCents,
            shareCents: r.perUnit![u.id] ?? 0,
          })),
        kostenanteilCents: view.perUnitTotal[u.id] ?? 0,
        sollCents: view.duePerUnit[u.id] ?? 0,
        peakCents: view.peak[u.id] ?? 0,
        laborHaushaltsnahCents: labor?.haushaltsnah ?? 0,
        laborHandwerkerCents: labor?.handwerker ?? 0,
      };
    });

    const branding = await getBrandingForOrg(property.organizationId);
    const endInclusive = new Date(new Date(view.fyEnd).getTime() - 86400000).toISOString().slice(0, 10);
    const pdf = await generateEinzelabrechnungen({
      propertyName: property.name,
      issuer: {
        legalName: branding.legalName,
        contactLine: [branding.addressLine, branding.email].filter(Boolean).join(" · "),
      },
      year: view.year,
      periodLabel: `${fmtDate(view.fyStart)} – ${fmtDate(endInclusive)}`,
      finalizedAt: statement.finalizedAt,
      units,
      generatedAt: new Date(),
    });

    const suffix = onlyUnitId ? `_${fileNamePart(allUnits[0].label)}` : "";
    const fileName = `Einzelabrechnung_${view.year}_${fileNamePart(property.name)}${suffix}.pdf`;
    return pdfResponse(pdf, fileName, request);
  } catch (err) {
    console.error("Einzelabrechnung-PDF fehlgeschlagen", err);
    return NextResponse.json({ error: "Export fehlgeschlagen" }, { status: 500 });
  }
}
