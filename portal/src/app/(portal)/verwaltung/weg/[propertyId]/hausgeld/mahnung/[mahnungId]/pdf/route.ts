import { NextResponse } from "next/server";
import { canVerwalterAccessProperty } from "@/lib/access";
import { getBrandingForOrg } from "@/lib/branding-server";
import { db } from "@/lib/db";
import { reminderLevelLabel } from "@/lib/dunning";
import { requireVerwalter } from "@/lib/session";
import { generateMahnung } from "@/lib/documents/mahnung";

export const dynamic = "force-dynamic";

// Zahlungserinnerung/Mahnung als druckfertiger DIN-A4-Brief (Fensterumschlag).
// Verwalter im Objekt-Scope.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ propertyId: string; mahnungId: string }> },
) {
  const verwalter = await requireVerwalter();
  const { propertyId, mahnungId } = await params;

  if (!(await canVerwalterAccessProperty(verwalter, propertyId))) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }
  const mahnung = await db.hausgeldMahnung.findFirst({
    where: { id: mahnungId, propertyId, organizationId: verwalter.organizationId },
    include: {
      unit: { select: { label: true } },
      property: { select: { name: true, organizationId: true, city: true } },
    },
  });
  if (!mahnung) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  try {
    // Girokonto der Gemeinschaft für die Bankverbindung im Brief
    const giro = await db.ledgerAccount.findFirst({
      where: { propertyId, kind: "GIRO", active: true },
      select: { iban: true, name: true },
    });
    const branding = await getBrandingForOrg(mahnung.property.organizationId);

    const pdf = await generateMahnung({
      issuer: {
        legalName: branding.legalName,
        contactLine: [branding.addressLine, branding.email].filter(Boolean).join(" · "),
      },
      propertyName: mahnung.property.name,
      unitLabel: mahnung.unit.label,
      level: mahnung.level,
      recipientName: mahnung.recipientName,
      recipientAddress: mahnung.recipientAddress,
      arrearsCents: mahnung.arrearsCents,
      interestCents: mahnung.interestCents,
      feeCents: mahnung.feeCents,
      paymentDeadline: mahnung.paymentDeadline,
      iban: giro?.iban ?? null,
      accountHolder: giro?.iban ? mahnung.property.name : null,
      createdAt: mahnung.createdAt,
      city: branding.city ?? mahnung.property.city ?? null,
    });

    const fileName = `${reminderLevelLabel(mahnung.level).replace(/[^a-zA-Z0-9]/g, "_")}_${mahnung.unit.label.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("Mahnung-PDF fehlgeschlagen", err);
    return NextResponse.json({ error: "Export fehlgeschlagen" }, { status: 500 });
  }
}
