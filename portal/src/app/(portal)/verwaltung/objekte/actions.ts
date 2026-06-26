"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canVerwalterAccessProperty } from "@/lib/access";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";

const unitSchema = z.object({
  propertyId: z.string().min(1),
  label: z.string().trim().min(1).max(200),
  floor: z.string().trim().max(100).optional(),
});

export async function createUnit(formData: FormData) {
  const verwalter = await requireVerwalter();
  const parsed = unitSchema.safeParse({
    propertyId: formData.get("propertyId"),
    label: formData.get("label"),
    floor: formData.get("floor") || undefined,
  });
  if (!parsed.success) {
    redirect("/verwaltung/objekte?fehler=eingabe");
  }
  // Scope-Prüfung: Einheit nur an eigene Objekte anlegen
  if (!(await canVerwalterAccessProperty(verwalter, parsed.data.propertyId))) {
    redirect("/verwaltung/objekte?fehler=eingabe");
  }
  await db.unit.create({ data: parsed.data });
  revalidatePath("/verwaltung/objekte");
  redirect("/verwaltung/objekte");
}
