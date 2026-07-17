import { NextResponse } from "next/server";
import { ownedUnitIdsInProperty, ownsProperty } from "@/lib/access";
import { getBrandingForOrg } from "@/lib/branding-server";
import { db } from "@/lib/db";
import { distributionKeyLabels } from "@/lib/labels";
import { getUser } from "@/lib/session";
import { generateEinzelabrechnungen, type EinzelabrechnungUnit } from "@/lib/documents/einzelabrechnung";
import type { StatementView } from "@/lib/weg/statement-service";

export const dynamic = "force-dynamic";

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

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

    const units: EinzelabrechnungUnit[] = myUnits.map((u) => {
      const split = view.ownerSplit?.[u.id];
      const labor = view.labor?.[u.id];
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
        kostenanteilCents: view.perUnitTotal?.[u.id] ?? 0,
        sollCents: view.duePerUnit?.[u.id] ?? 0,
        peakCents: view.peak?.[u.id] ?? 0,
        laborHaushaltsnahCents: labor?.haushaltsnah ?? 0,
        laborHandwerkerCents: labor?.handwerker ?? 0,
      };
    });

    const branding = await getBrandingForOrg(statement.property.organizationId);
    const endInclusive = new Date(new Date(view.fyEnd).getTime() - 86400000).toISOString().slice(0, 10);
    const pdf = await generateEinzelabrechnungen({
      propertyName: statement.property.name,
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

    const fileName = `Meine_Einzelabrechnung_${view.year}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("Eigentümer-Einzelabrechnung-PDF fehlgeschlagen", err);
    return NextResponse.json({ error: "Export fehlgeschlagen" }, { status: 500 });
  }
}
