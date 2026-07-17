"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AUDIT, logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { parseEuroToCents } from "@/lib/money";
import { requireVerwalter } from "@/lib/session";
import { loadWegProperty } from "@/lib/weg/scope";

function back(propertyId: string, param?: string): never {
  redirect(`/verwaltung/weg/${propertyId}/erhaltungsplanung${param ? `?${param}` : ""}`);
}

const measureSchema = z.object({
  propertyId: z.string().min(1),
  measureId: z.string().optional(), // leer = neu
  title: z.string().trim().min(2).max(200),
  trade: z.string().trim().max(80).optional(),
  targetYear: z.coerce.number().int().min(2000).max(2200),
  estimate: z.string().min(1),
  note: z.string().trim().max(1000).optional(),
});

// Erhaltungsmaßnahme anlegen oder aktualisieren.
export async function saveMeasure(formData: FormData) {
  const verwalter = await requireVerwalter();
  const parsed = measureSchema.safeParse({
    propertyId: formData.get("propertyId"),
    measureId: String(formData.get("measureId") ?? "") || undefined,
    title: formData.get("title"),
    trade: String(formData.get("trade") ?? "") || undefined,
    targetYear: formData.get("targetYear"),
    estimate: formData.get("estimate"),
    note: String(formData.get("note") ?? "") || undefined,
  });
  if (!parsed.success) redirect("/verwaltung/weg");
  const property = await loadWegProperty(verwalter, parsed.data.propertyId);
  if (!property) redirect("/verwaltung/weg");

  const estimatedCents = parseEuroToCents(parsed.data.estimate);
  if (estimatedCents === null || estimatedCents < 0) back(property.id, "fehler=betrag");

  const data = {
    title: parsed.data.title,
    trade: parsed.data.trade ?? null,
    targetYear: parsed.data.targetYear,
    estimatedCents,
    note: parsed.data.note ?? null,
  };

  let measureId = parsed.data.measureId ?? null;
  if (measureId) {
    // Update nur, wenn die Maßnahme zu diesem Objekt gehört (IDOR-Schutz).
    const existing = await db.maintenanceMeasure.findFirst({
      where: { id: measureId, propertyId: property.id },
      select: { id: true },
    });
    if (!existing) back(property.id, "fehler=nichtgefunden");
    await db.maintenanceMeasure.update({ where: { id: measureId }, data });
  } else {
    const created = await db.maintenanceMeasure.create({
      data: {
        ...data,
        organizationId: verwalter.organizationId,
        propertyId: property.id,
        createdById: verwalter.id,
      },
    });
    measureId = created.id;
  }

  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_MEASURE_SAVED,
    targetType: "MaintenanceMeasure",
    targetId: measureId,
  });
  revalidatePath(`/verwaltung/weg/${property.id}/erhaltungsplanung`);
  back(property.id, "gespeichert=massnahme");
}

// Erledigt-Status umschalten (erledigte Maßnahmen zählen nicht mehr zum Bedarf).
export async function toggleMeasureDone(formData: FormData) {
  const verwalter = await requireVerwalter();
  const propertyId = String(formData.get("propertyId") ?? "");
  const id = String(formData.get("id") ?? "");
  const property = await loadWegProperty(verwalter, propertyId);
  if (!property) redirect("/verwaltung/weg");

  const measure = await db.maintenanceMeasure.findFirst({
    where: { id, propertyId: property.id },
    select: { id: true, done: true },
  });
  if (!measure) back(property.id, "fehler=nichtgefunden");
  await db.maintenanceMeasure.update({
    where: { id: measure.id },
    data: { done: !measure.done },
  });
  revalidatePath(`/verwaltung/weg/${property.id}/erhaltungsplanung`);
  back(property.id, "gespeichert=status");
}

export async function deleteMeasure(formData: FormData) {
  const verwalter = await requireVerwalter();
  const propertyId = String(formData.get("propertyId") ?? "");
  const id = String(formData.get("id") ?? "");
  const property = await loadWegProperty(verwalter, propertyId);
  if (!property) redirect("/verwaltung/weg");

  const measure = await db.maintenanceMeasure.findFirst({
    where: { id, propertyId: property.id },
    select: { id: true },
  });
  if (measure) {
    await db.maintenanceMeasure.delete({ where: { id: measure.id } }).catch(() => {});
    await logAudit({
      actorId: verwalter.id,
      action: AUDIT.WEG_MEASURE_DELETED,
      targetType: "MaintenanceMeasure",
      targetId: measure.id,
    });
  }
  revalidatePath(`/verwaltung/weg/${property.id}/erhaltungsplanung`);
  back(property.id, "gespeichert=geloescht");
}
