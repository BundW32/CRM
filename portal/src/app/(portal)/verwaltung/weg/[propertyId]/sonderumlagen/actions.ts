"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AUDIT, logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { parseEuroToCents } from "@/lib/money";
import { requireVerwalter } from "@/lib/session";
import { distributeByWeight, weightsForKey } from "@/lib/weg/distribution";
import { loadWegProperty } from "@/lib/weg/scope";

// Sonderumlagen nutzen die strikten Verteilungsschlüssel (die manuellen
// VERBRAUCH/FESTBETRAG/INDIVIDUELL sind hier nicht sinnvoll).
const SONDERUMLAGE_KEYS = ["MEA", "FLAECHE", "EINHEITEN", "PERSONEN"] as const;

function back(propertyId: string, param?: string): never {
  redirect(`/verwaltung/weg/${propertyId}/sonderumlagen${param ? `?${param}` : ""}`);
}

const createSchema = z.object({
  propertyId: z.string().min(1),
  title: z.string().trim().min(2).max(160),
  purpose: z.string().trim().max(500).optional(),
  amount: z.string().min(1),
  distributionKey: z.enum(SONDERUMLAGE_KEYS),
  dueDate: z.string().min(1),
  resolutionNote: z.string().trim().max(300).optional(),
});

// Legt eine (beschlossene) Sonderumlage an und verteilt den Gesamtbetrag
// centgenau auf die Einheiten → erzeugt je Einheit eine Sollstellung.
export async function createSonderumlage(formData: FormData) {
  const verwalter = await requireVerwalter();
  const parsed = createSchema.safeParse({
    propertyId: formData.get("propertyId"),
    title: formData.get("title"),
    purpose: String(formData.get("purpose") ?? "") || undefined,
    amount: formData.get("amount"),
    distributionKey: formData.get("distributionKey"),
    dueDate: formData.get("dueDate"),
    resolutionNote: String(formData.get("resolutionNote") ?? "") || undefined,
  });
  if (!parsed.success) redirect("/verwaltung/weg");
  const property = await loadWegProperty(verwalter, parsed.data.propertyId);
  if (!property) redirect("/verwaltung/weg");

  const totalCents = parseEuroToCents(parsed.data.amount);
  if (totalCents === null || totalCents <= 0) back(property.id, "fehler=betrag");
  const dueDate = new Date(parsed.data.dueDate);
  if (isNaN(dueDate.getTime())) back(property.id, "fehler=datum");

  const units = await db.unit.findMany({
    where: { propertyId: property.id },
    select: { id: true, mea: true, livingArea: true, personCount: true },
  });
  if (units.length === 0) back(property.id, "fehler=einheiten");

  // Verteilung nach Schlüssel (centgenau, Restcent-Regel); fehlende Stammdaten
  // (z. B. MEA) → verständlicher Fehler statt Absturz.
  let shares;
  try {
    shares = distributeByWeight(totalCents, weightsForKey(units, parsed.data.distributionKey));
  } catch {
    back(property.id, "fehler=stammdaten");
  }

  const created = await db.$transaction(async (tx) => {
    const su = await tx.sonderumlage.create({
      data: {
        organizationId: verwalter.organizationId,
        propertyId: property.id,
        title: parsed.data.title,
        purpose: parsed.data.purpose ?? null,
        totalAmountCents: totalCents,
        distributionKey: parsed.data.distributionKey,
        dueDate,
        resolutionNote: parsed.data.resolutionNote ?? null,
        createdById: verwalter.id,
      },
    });
    await tx.duePosting.createMany({
      data: units.map((u) => ({
        organizationId: verwalter.organizationId,
        propertyId: property.id,
        unitId: u.id,
        sonderumlageId: su.id,
        dueDate,
        periodYear: dueDate.getUTCFullYear(),
        periodMonth: dueDate.getUTCMonth() + 1,
        amountCents: shares.get(u.id) ?? 0,
        source: "SONDERUMLAGE",
      })),
    });
    return su;
  });

  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_SONDERUMLAGE_CREATED,
    targetType: "Sonderumlage",
    targetId: created.id,
    meta: { title: parsed.data.title, totalCents, key: parsed.data.distributionKey },
  });
  revalidatePath(`/verwaltung/weg/${property.id}/sonderumlagen`);
  revalidatePath(`/verwaltung/weg/${property.id}/hausgeld`);
  back(property.id, "gespeichert=1");
}

// Löscht eine Sonderumlage samt ihrer Sollstellungen (Cascade).
export async function deleteSonderumlage(formData: FormData) {
  const verwalter = await requireVerwalter();
  const propertyId = String(formData.get("propertyId") ?? "");
  const sonderumlageId = String(formData.get("sonderumlageId") ?? "");
  const property = await loadWegProperty(verwalter, propertyId);
  if (!property) redirect("/verwaltung/weg");

  const su = await db.sonderumlage.findFirst({
    where: { id: sonderumlageId, propertyId: property.id, organizationId: verwalter.organizationId },
    select: { id: true, title: true },
  });
  if (!su) back(property.id, "fehler=nichtgefunden");

  await db.sonderumlage.delete({ where: { id: su.id } });
  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_SONDERUMLAGE_DELETED,
    targetType: "Sonderumlage",
    targetId: su.id,
    meta: { title: su.title },
  });
  revalidatePath(`/verwaltung/weg/${property.id}/sonderumlagen`);
  revalidatePath(`/verwaltung/weg/${property.id}/hausgeld`);
  back(property.id, "geloescht=1");
}
