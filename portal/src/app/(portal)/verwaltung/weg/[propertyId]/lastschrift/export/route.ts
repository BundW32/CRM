import { NextResponse } from "next/server";
import { canVerwalterAccessProperty } from "@/lib/access";
import { AUDIT, logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";
import { buildPain008, isoDate, type SepaPayment } from "@/lib/weg/sepa";

export const dynamic = "force-dynamic";

// Erzeugt die SEPA-Basislastschrift-Datei (pain.008) für den Hausgeldeinzug und
// streamt sie zum Selbst-Upload ins Online-Banking. Verwalter im Objekt-Scope.
// Einzuziehen ist der zum Einzugstermin offene Hausgeld-Betrag je Einheit mit
// aktivem Mandat.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ propertyId: string }> },
) {
  const verwalter = await requireVerwalter();
  const { propertyId } = await params;
  if (!(await canVerwalterAccessProperty(verwalter, propertyId))) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }
  const property = await db.property.findFirst({
    where: { id: propertyId, organizationId: verwalter.organizationId, managementType: "WEG" },
    select: { id: true, name: true, sepaCreditorId: true },
  });
  if (!property) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date");
  const collectionDate = dateParam ? new Date(dateParam) : new Date(Date.now() + 6 * 86400000);
  if (Number.isNaN(collectionDate.getTime())) {
    return NextResponse.json({ error: "Ungültiger Einzugstermin" }, { status: 400 });
  }

  // Gläubigerdaten prüfen: ohne Gläubiger-ID und Girokonto-IBAN kein Export.
  const giro = await db.ledgerAccount.findFirst({
    where: { propertyId: property.id, kind: "GIRO", active: true, iban: { not: null } },
    select: { iban: true },
  });
  if (!property.sepaCreditorId || !giro?.iban) {
    return NextResponse.json(
      { error: "Gläubiger-ID und Girokonto-IBAN müssen hinterlegt sein." },
      { status: 422 },
    );
  }

  // Offene Hausgeld-Beträge je Einheit zum Einzugstermin (Soll − Ist).
  const [mandates, dueSums, paidSums] = await Promise.all([
    db.sepaMandate.findMany({
      where: { propertyId: property.id, active: true },
      include: { unit: { select: { id: true, label: true } } },
    }),
    db.duePosting.groupBy({
      by: ["unitId"],
      where: { propertyId: property.id, dueDate: { lte: collectionDate } },
      _sum: { amountCents: true },
    }),
    db.booking.groupBy({
      by: ["unitId"],
      where: { propertyId: property.id, kind: "EINNAHME", unitId: { not: null } },
      _sum: { amountCents: true },
    }),
  ]);

  const dueByUnit = new Map(dueSums.map((d) => [d.unitId, d._sum.amountCents ?? 0]));
  const paidByUnit = new Map(paidSums.map((p) => [p.unitId as string, p._sum.amountCents ?? 0]));

  const payments: SepaPayment[] = [];
  for (const m of mandates) {
    const open = (dueByUnit.get(m.unitId) ?? 0) - (paidByUnit.get(m.unitId) ?? 0);
    if (open <= 0) continue; // nichts einzuziehen
    payments.push({
      endToEndId: m.mandateRef.slice(0, 35),
      mandateRef: m.mandateRef,
      signedDate: m.signedDate,
      sequence: m.sequence,
      debtorName: m.debtorName,
      debtorIban: m.iban,
      debtorBic: m.bic,
      amountCents: open,
      remittance: `Hausgeld ${m.unit.label}`.slice(0, 140),
    });
  }

  if (payments.length === 0) {
    return NextResponse.json(
      { error: "Keine einziehbaren offenen Beträge (aktive Mandate mit offenem Hausgeld)." },
      { status: 422 },
    );
  }

  const msgId = `HG-${property.id.slice(-6)}-${isoDate(new Date()).replace(/-/g, "")}-${Date.now().toString().slice(-5)}`;
  const xml = buildPain008({
    msgId,
    creationDateTime: new Date(),
    creditorName: property.name,
    creditorIban: giro.iban,
    creditorBic: null,
    creditorId: property.sepaCreditorId,
    collectionDate,
    payments,
  });

  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_SEPA_EXPORT,
    targetType: "Property",
    targetId: property.id,
    meta: { count: payments.length, collectionDate: isoDate(collectionDate) },
  });

  const fileName = `SEPA_Lastschrift_${property.name.replace(/[^a-zA-Z0-9]/g, "_")}_${isoDate(collectionDate)}.xml`;
  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
