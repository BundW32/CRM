"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canVerwalterUseCraftsman, propertyIdsForVerwalter } from "@/lib/access";
import { db } from "@/lib/db";
import { maintenanceIntervalMonths } from "@/lib/labels";
import { requireVerwalter } from "@/lib/session";

const taskSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).optional(),
  interval: z.enum([
    "MONATLICH",
    "QUARTALSWEISE",
    "HALBJAEHRLICH",
    "JAEHRLICH",
    "ZWEIJAEHRLICH",
    "EINMALIG",
  ]),
  dueDate: z.string().min(1),
  propertyId: z.string().optional(),
  craftsmanId: z.string().optional(),
});

export async function createMaintenanceTask(formData: FormData) {
  const verwalter = await requireVerwalter();
  const parsed = taskSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    interval: formData.get("interval"),
    dueDate: formData.get("dueDate"),
    propertyId: formData.get("propertyId") || undefined,
    craftsmanId: formData.get("craftsmanId") || undefined,
  });
  if (!parsed.success) {
    redirect("/verwaltung/wartung?fehler=eingabe");
  }
  const due = new Date(parsed.data.dueDate);
  if (Number.isNaN(due.getTime())) {
    redirect("/verwaltung/wartung?fehler=eingabe");
  }

  // Scope-Prüfung: eingeschränkte Verwalter nur auf eigene Objekte/freigegebene Handwerker
  const allowedPropIds = await propertyIdsForVerwalter(verwalter);
  let propertyId = parsed.data.propertyId || null;
  if (propertyId && allowedPropIds !== null && !allowedPropIds.includes(propertyId)) {
    propertyId = null;
  }
  let craftsmanId = parsed.data.craftsmanId || null;
  if (craftsmanId && !(await canVerwalterUseCraftsman(verwalter, craftsmanId))) {
    craftsmanId = null;
  }

  await db.maintenanceTask.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description || null,
      interval: parsed.data.interval,
      dueDate: due,
      propertyId,
      craftsmanId,
    },
  });
  revalidatePath("/verwaltung/wartung");
  redirect("/verwaltung/wartung");
}

// Als erledigt markieren: nächste Fälligkeit berechnen (oder einmalig abschließen)
export async function completeMaintenanceTask(formData: FormData) {
  await requireVerwalter();
  const id = String(formData.get("id") ?? "");
  const task = await db.maintenanceTask.findUnique({ where: { id } });
  if (!task) redirect("/verwaltung/wartung");

  const months = maintenanceIntervalMonths[task.interval];
  if (months === null) {
    // Einmalige Aufgabe abschließen
    await db.maintenanceTask.update({
      where: { id },
      data: { lastDoneAt: new Date(), active: false },
    });
  } else {
    const next = new Date();
    next.setMonth(next.getMonth() + months);
    await db.maintenanceTask.update({
      where: { id },
      data: { lastDoneAt: new Date(), dueDate: next },
    });
  }
  revalidatePath("/verwaltung/wartung");
  revalidatePath("/dashboard");
  redirect("/verwaltung/wartung");
}

export async function deleteMaintenanceTask(formData: FormData) {
  await requireVerwalter();
  const id = String(formData.get("id") ?? "");
  if (id) {
    await db.maintenanceTask.delete({ where: { id } }).catch(() => {});
  }
  revalidatePath("/verwaltung/wartung");
  redirect("/verwaltung/wartung");
}
