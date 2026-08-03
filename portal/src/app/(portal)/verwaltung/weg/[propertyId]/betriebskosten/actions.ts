"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AUDIT, logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { parseEuroToCents } from "@/lib/money";
import { requireVerwalter } from "@/lib/session";
import { loadWegProperty } from "@/lib/weg/scope";

function back(propertyId: string, query: string): never {
  redirect(`/verwaltung/weg/${propertyId}/betriebskosten${query}`);
}

// Monatliche Betriebskosten-Vorauszahlung des aktuellen Mieters einer Einheit
// speichern (Basis der Abrechnung).
export async function savePrepayment(formData: FormData) {
  const verwalter = await requireVerwalter();
  const propertyId = String(formData.get("propertyId") ?? "");
  const unitId = String(formData.get("unitId") ?? "");
  const statementId = String(formData.get("statementId") ?? "");
  const amountRaw = String(formData.get("amount") ?? "");
  const property = await loadWegProperty(verwalter, propertyId);
  if (!property) redirect("/verwaltung/weg");

  // Einheit muss zum Objekt gehören (IDOR-Schutz).
  const tenancy = await db.tenancy.findFirst({
    where: { unitId, active: true, unit: { propertyId: property.id } },
    select: { id: true },
  });
  const query = `?statement=${statementId}&unit=${unitId}`;
  if (!tenancy) back(property.id, `${query}&fehler=mieter`);

  const cents = amountRaw.trim() === "" ? null : parseEuroToCents(amountRaw);
  if (cents !== null && (cents < 0 || Number.isNaN(cents))) back(property.id, `${query}&fehler=betrag`);

  await db.tenancy.update({
    where: { id: tenancy.id },
    data: { bkPrepaymentMonthlyCents: cents },
  });
  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_BK_PREPAYMENT_SAVED,
    targetType: "Tenancy",
    targetId: tenancy.id,
  });
  revalidatePath(`/verwaltung/weg/${property.id}/betriebskosten`);
  back(property.id, `${query}&gespeichert=1`);
}
