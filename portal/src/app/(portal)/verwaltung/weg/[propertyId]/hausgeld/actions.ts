"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AUDIT, logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";
import { loadWegProperty } from "@/lib/weg/scope";

function back(propertyId: string, param?: string): never {
  redirect(`/verwaltung/weg/${propertyId}/hausgeld${param ? `?${param}` : ""}`);
}

// Ordnet einen Zahlungseingang (EINNAHME-Buchung) einer Einheit zu — oder hebt
// die Zuordnung auf (unitId leer). Grundlage der Offene-Posten-Rechnung.
export async function assignPayment(formData: FormData) {
  const verwalter = await requireVerwalter();
  const propertyId = String(formData.get("propertyId") ?? "");
  const bookingId = String(formData.get("bookingId") ?? "");
  const unitId = String(formData.get("unitId") ?? "");
  const property = await loadWegProperty(verwalter, propertyId);
  if (!property) redirect("/verwaltung/weg");

  const booking = await db.booking.findFirst({
    where: { id: bookingId, propertyId: property.id, kind: "EINNAHME" },
    select: { id: true },
  });
  if (!booking) back(property.id, "fehler=buchung");

  if (unitId) {
    const unit = await db.unit.findFirst({
      where: { id: unitId, propertyId: property.id },
      select: { id: true },
    });
    if (!unit) back(property.id, "fehler=einheit");
  }

  await db.booking.update({
    where: { id: booking.id },
    data: { unitId: unitId || null },
  });
  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_PAYMENT_ASSIGNED,
    targetType: "Booking",
    targetId: booking.id,
    meta: { unitId: unitId || null },
  });
  revalidatePath(`/verwaltung/weg/${property.id}/hausgeld`);
  back(property.id, unitId ? "zugeordnet=1" : "geloest=1");
}
