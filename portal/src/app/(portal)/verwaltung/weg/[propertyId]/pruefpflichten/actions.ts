"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AUDIT, logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { maintenanceIntervalMonths } from "@/lib/labels";
import { requireVerwalter } from "@/lib/session";
import { addMonths } from "@/lib/weg/compliance";
import { WEG_COMPLIANCE_CATALOG } from "@/lib/weg/compliance-catalog";
import { loadWegProperty } from "@/lib/weg/scope";

function back(propertyId: string, param?: string): never {
  redirect(`/verwaltung/weg/${propertyId}/pruefpflichten${param ? `?${param}` : ""}`);
}

// Übernimmt den Prüfpflichten-Katalog für ein Objekt. Idempotent: es werden nur
// Pflichten angelegt, die es (per catalogKey) für dieses Objekt noch nicht gibt —
// mehrfaches Klicken erzeugt keine Duplikate.
export async function adoptComplianceCatalog(formData: FormData) {
  const verwalter = await requireVerwalter();
  const propertyId = String(formData.get("propertyId") ?? "");
  const property = await loadWegProperty(verwalter, propertyId);
  if (!property) redirect("/verwaltung/weg");

  const existing = await db.maintenanceTask.findMany({
    where: { propertyId: property.id, catalogKey: { not: null } },
    select: { catalogKey: true },
  });
  const have = new Set(existing.map((t) => t.catalogKey));
  const toCreate = WEG_COMPLIANCE_CATALOG.filter((d) => !have.has(d.key));

  const now = new Date();
  if (toCreate.length > 0) {
    await db.maintenanceTask.createMany({
      data: toCreate.map((d) => ({
        organizationId: verwalter.organizationId,
        propertyId: property.id,
        title: d.title,
        description: d.description,
        interval: d.interval,
        dueDate: addMonths(now, d.initialDueMonths),
        catalogKey: d.key,
      })),
    });
  }

  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_PRUEFPFLICHT_CATALOG_ADOPTED,
    targetType: "Property",
    targetId: property.id,
    meta: { created: toCreate.length },
  });
  revalidatePath(`/verwaltung/weg/${property.id}/pruefpflichten`);
  revalidatePath("/dashboard");
  back(property.id, "gespeichert=katalog");
}

// Als erledigt markieren: nächste Fälligkeit im Turnus setzen (bzw. einmalige
// Pflicht abschließen). Rechnet ab dem bisherigen Fälligkeitsdatum, damit der
// Turnus nicht schleichend nach hinten wandert, wenn spät quittiert wird.
export async function completeCompliance(formData: FormData) {
  const verwalter = await requireVerwalter();
  const propertyId = String(formData.get("propertyId") ?? "");
  const id = String(formData.get("id") ?? "");
  const property = await loadWegProperty(verwalter, propertyId);
  if (!property) redirect("/verwaltung/weg");

  const task = await db.maintenanceTask.findFirst({
    where: { id, propertyId: property.id },
  });
  if (!task) back(property.id, "fehler=nichtgefunden");

  const months = maintenanceIntervalMonths[task.interval];
  const now = new Date();
  if (months === null) {
    await db.maintenanceTask.update({
      where: { id: task.id },
      data: { lastDoneAt: now, active: false },
    });
  } else {
    // Basis ist das spätere von bisheriger Fälligkeit und heute – so bleibt der
    // Turnus stabil, ohne eine Fälligkeit in der Vergangenheit zu erzeugen.
    const base = task.dueDate.getTime() > now.getTime() ? task.dueDate : now;
    await db.maintenanceTask.update({
      where: { id: task.id },
      data: { lastDoneAt: now, dueDate: addMonths(base, months), lastReminderAt: null },
    });
  }

  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_PRUEFPFLICHT_COMPLETED,
    targetType: "MaintenanceTask",
    targetId: task.id,
  });
  revalidatePath(`/verwaltung/weg/${property.id}/pruefpflichten`);
  revalidatePath("/dashboard");
  back(property.id, "gespeichert=erledigt");
}

// Fälligkeit manuell anpassen (z. B. an einen realen Prüftermin/Herstellerturnus).
export async function updateComplianceDue(formData: FormData) {
  const verwalter = await requireVerwalter();
  const propertyId = String(formData.get("propertyId") ?? "");
  const id = String(formData.get("id") ?? "");
  const dueRaw = String(formData.get("dueDate") ?? "");
  const property = await loadWegProperty(verwalter, propertyId);
  if (!property) redirect("/verwaltung/weg");

  const due = new Date(dueRaw);
  if (!dueRaw || Number.isNaN(due.getTime())) back(property.id, "fehler=datum");

  const task = await db.maintenanceTask.findFirst({
    where: { id, propertyId: property.id },
    select: { id: true },
  });
  if (!task) back(property.id, "fehler=nichtgefunden");

  await db.maintenanceTask.update({
    where: { id: task.id },
    data: { dueDate: due, lastReminderAt: null },
  });
  revalidatePath(`/verwaltung/weg/${property.id}/pruefpflichten`);
  revalidatePath("/dashboard");
  back(property.id, "gespeichert=faelligkeit");
}

export async function deleteCompliance(formData: FormData) {
  const verwalter = await requireVerwalter();
  const propertyId = String(formData.get("propertyId") ?? "");
  const id = String(formData.get("id") ?? "");
  const property = await loadWegProperty(verwalter, propertyId);
  if (!property) redirect("/verwaltung/weg");

  const task = await db.maintenanceTask.findFirst({
    where: { id, propertyId: property.id },
    select: { id: true },
  });
  if (task) {
    await db.maintenanceTask.delete({ where: { id: task.id } }).catch(() => {});
    await logAudit({
      actorId: verwalter.id,
      action: AUDIT.WEG_PRUEFPFLICHT_DELETED,
      targetType: "MaintenanceTask",
      targetId: task.id,
    });
  }
  revalidatePath(`/verwaltung/weg/${property.id}/pruefpflichten`);
  revalidatePath("/dashboard");
  back(property.id, "gespeichert=geloescht");
}
