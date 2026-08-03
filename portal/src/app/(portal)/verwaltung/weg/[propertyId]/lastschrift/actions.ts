"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AUDIT, logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";
import { loadWegProperty } from "@/lib/weg/scope";

function back(propertyId: string, param?: string): never {
  redirect(`/verwaltung/weg/${propertyId}/lastschrift${param ? `?${param}` : ""}`);
}

// Gläubiger-Identifikationsnummer der Gemeinschaft speichern.
export async function saveCreditorId(formData: FormData) {
  const verwalter = await requireVerwalter();
  const propertyId = String(formData.get("propertyId") ?? "");
  const creditorId = String(formData.get("sepaCreditorId") ?? "").trim().toUpperCase() || null;
  const property = await loadWegProperty(verwalter, propertyId);
  if (!property) redirect("/verwaltung/weg");

  await db.property.update({ where: { id: property.id }, data: { sepaCreditorId: creditorId } });
  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_SEPA_MANDATE_SAVED,
    targetType: "Property",
    targetId: property.id,
    meta: { creditorId: Boolean(creditorId) },
  });
  revalidatePath(`/verwaltung/weg/${property.id}/lastschrift`);
  back(property.id, "gespeichert=glaeubiger");
}

const mandateSchema = z.object({
  propertyId: z.string().min(1),
  unitId: z.string().min(1),
  debtorName: z.string().trim().min(2).max(140),
  iban: z.string().trim().min(15).max(40),
  bic: z.string().trim().max(11).optional(),
  mandateRef: z.string().trim().max(35).optional(),
  signedDate: z.string().min(1),
  sequence: z.enum(["FRST", "RCUR", "OOFF"]),
});

export async function saveMandate(formData: FormData) {
  const verwalter = await requireVerwalter();
  const parsed = mandateSchema.safeParse({
    propertyId: formData.get("propertyId"),
    unitId: formData.get("unitId"),
    debtorName: formData.get("debtorName"),
    iban: formData.get("iban"),
    bic: String(formData.get("bic") ?? "") || undefined,
    mandateRef: String(formData.get("mandateRef") ?? "") || undefined,
    signedDate: formData.get("signedDate"),
    sequence: formData.get("sequence"),
  });
  if (!parsed.success) redirect("/verwaltung/weg");
  const property = await loadWegProperty(verwalter, parsed.data.propertyId);
  if (!property) redirect("/verwaltung/weg");

  // Einheit muss zu diesem Objekt gehören (IDOR-Schutz).
  const unit = await db.unit.findFirst({
    where: { id: parsed.data.unitId, propertyId: property.id },
    select: { id: true, label: true, orderIndex: true },
  });
  if (!unit) back(property.id, "fehler=einheit");

  const signed = new Date(parsed.data.signedDate);
  if (Number.isNaN(signed.getTime())) back(property.id, "fehler=datum");

  const iban = parsed.data.iban.replace(/\s+/g, "").toUpperCase();
  // Mandatsreferenz: falls leer, aus Objekt+Einheit ableiten (stabil, eindeutig).
  const mandateRef =
    parsed.data.mandateRef?.trim() ||
    `HG-${property.id.slice(-6)}-${String(unit.orderIndex).padStart(3, "0")}`.toUpperCase();

  await db.sepaMandate.upsert({
    where: { propertyId_unitId: { propertyId: property.id, unitId: unit.id } },
    create: {
      organizationId: verwalter.organizationId,
      propertyId: property.id,
      unitId: unit.id,
      mandateRef,
      debtorName: parsed.data.debtorName,
      iban,
      bic: parsed.data.bic?.toUpperCase() || null,
      signedDate: signed,
      sequence: parsed.data.sequence,
      createdById: verwalter.id,
    },
    update: {
      mandateRef,
      debtorName: parsed.data.debtorName,
      iban,
      bic: parsed.data.bic?.toUpperCase() || null,
      signedDate: signed,
      sequence: parsed.data.sequence,
    },
  });

  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_SEPA_MANDATE_SAVED,
    targetType: "Unit",
    targetId: unit.id,
  });
  revalidatePath(`/verwaltung/weg/${property.id}/lastschrift`);
  back(property.id, "gespeichert=mandat");
}

export async function deleteMandate(formData: FormData) {
  const verwalter = await requireVerwalter();
  const propertyId = String(formData.get("propertyId") ?? "");
  const id = String(formData.get("id") ?? "");
  const property = await loadWegProperty(verwalter, propertyId);
  if (!property) redirect("/verwaltung/weg");

  const mandate = await db.sepaMandate.findFirst({
    where: { id, propertyId: property.id },
    select: { id: true },
  });
  if (mandate) {
    await db.sepaMandate.delete({ where: { id: mandate.id } }).catch(() => {});
    await logAudit({
      actorId: verwalter.id,
      action: AUDIT.WEG_SEPA_MANDATE_DELETED,
      targetType: "SepaMandate",
      targetId: mandate.id,
    });
  }
  revalidatePath(`/verwaltung/weg/${property.id}/lastschrift`);
  back(property.id, "gespeichert=geloescht");
}
