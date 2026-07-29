import { NextResponse } from "next/server";
import { canVerwalterAccessProperty } from "@/lib/access";
import { getBrandingForOrg } from "@/lib/branding-server";
import { db } from "@/lib/db";
import { reminderLevelLabel } from "@/lib/dunning";
import { requireVerwalter } from "@/lib/session";
import { generateMahnung } from "@/lib/documents/mahnung";
import { briefkopfAus } from "@/lib/documents/briefkopf";
import { fileNamePart, pdfResponse } from "@/lib/documents/pdf-response";

export const dynamic = "force-dynamic";

// Zahlungserinnerung/Mahnung als druckfertiger DIN-A4-Brief (Fensterumschlag).
// Verwalter im Objekt-Scope.
export async function GET(
  request: Request,
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
    const kopf = briefkopfAus(branding);

    // Vorstufe, auf die sich der Text beziehen kann („unsere Zahlungserinnerung
    // vom …"): die zuletzt versendete Mahnung derselben Einheit.
    const vorstufe =
      mahnung.level > 1
        ? await db.hausgeldMahnung.findFirst({
            where: { unitId: mahnung.unitId, level: { lt: mahnung.level }, sentAt: { not: null } },
            orderBy: { sentAt: "desc" },
            select: { sentAt: true },
          })
        : null;

    const pdf = await generateMahnung({
      issuer: kopf.issuer,
      brand: kopf.brand,
      logoPath: kopf.logoPath,
      propertyName: mahnung.property.name,
      unitLabel: mahnung.unit.label,
      level: mahnung.level,
      recipient: {
        name: mahnung.recipientName,
        salutation: mahnung.recipientSalutation,
        lastName: mahnung.recipientLastName,
      },
      recipientAddress: mahnung.recipientAddress,
      // Ab der letzten Stufe ist der Zugang nachweisbar zu dokumentieren.
      versandVermerk: mahnung.level >= 3 ? "Einschreiben mit Rückschein" : null,
      arrearsCents: mahnung.arrearsCents,
      interestCents: mahnung.interestCents,
      feeCents: mahnung.feeCents,
      paymentDeadline: mahnung.paymentDeadline,
      previousReminderAt: vorstufe?.sentAt ?? null,
      iban: giro?.iban ?? null,
      accountHolder: giro?.iban ? mahnung.property.name : null,
      createdAt: mahnung.createdAt,
      city: kopf.city ?? mahnung.property.city ?? null,
    });

    const fileName = `${fileNamePart(reminderLevelLabel(mahnung.level))}_${fileNamePart(mahnung.unit.label)}.pdf`;
    return pdfResponse(pdf, fileName, request);
  } catch (err) {
    console.error("Mahnung-PDF fehlgeschlagen", err);
    return NextResponse.json({ error: "Export fehlgeschlagen" }, { status: 500 });
  }
}
