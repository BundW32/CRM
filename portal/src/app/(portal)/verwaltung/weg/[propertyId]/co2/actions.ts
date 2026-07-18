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
  redirect(`/verwaltung/weg/${propertyId}/co2${param ? `?${param}` : ""}`);
}

const schema = z.object({
  propertyId: z.string().min(1),
  year: z.coerce.number().int().min(2020).max(2100),
  totalCo2: z.string().min(1),
  emissionsKg: z.string().min(1),
  note: z.string().trim().max(500).optional(),
});

export async function saveCo2Allocation(formData: FormData) {
  const verwalter = await requireVerwalter();
  const parsed = schema.safeParse({
    propertyId: formData.get("propertyId"),
    year: formData.get("year"),
    totalCo2: formData.get("totalCo2"),
    emissionsKg: formData.get("emissionsKg"),
    note: String(formData.get("note") ?? "") || undefined,
  });
  if (!parsed.success) redirect("/verwaltung/weg");
  const property = await loadWegProperty(verwalter, parsed.data.propertyId);
  if (!property) redirect("/verwaltung/weg");

  const totalCo2Cents = parseEuroToCents(parsed.data.totalCo2);
  if (totalCo2Cents === null || totalCo2Cents < 0) back(property.id, "fehler=betrag");
  const emissionsKg = Number(parsed.data.emissionsKg.replace(",", "."));
  if (!Number.isFinite(emissionsKg) || emissionsKg < 0) back(property.id, "fehler=emissionen");

  await db.co2Allocation.upsert({
    where: { propertyId_year: { propertyId: property.id, year: parsed.data.year } },
    create: {
      organizationId: verwalter.organizationId,
      propertyId: property.id,
      year: parsed.data.year,
      totalCo2Cents,
      emissionsKg,
      note: parsed.data.note ?? null,
      createdById: verwalter.id,
    },
    update: {
      totalCo2Cents,
      emissionsKg,
      note: parsed.data.note ?? null,
    },
  });

  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_CO2_SAVED,
    targetType: "Property",
    targetId: property.id,
    meta: { year: parsed.data.year },
  });
  revalidatePath(`/verwaltung/weg/${property.id}/co2`);
  back(property.id, `gespeichert=1&jahr=${parsed.data.year}`);
}

export async function deleteCo2Allocation(formData: FormData) {
  const verwalter = await requireVerwalter();
  const propertyId = String(formData.get("propertyId") ?? "");
  const id = String(formData.get("id") ?? "");
  const property = await loadWegProperty(verwalter, propertyId);
  if (!property) redirect("/verwaltung/weg");

  const alloc = await db.co2Allocation.findFirst({
    where: { id, propertyId: property.id },
    select: { id: true },
  });
  if (alloc) {
    await db.co2Allocation.delete({ where: { id: alloc.id } }).catch(() => {});
    await logAudit({
      actorId: verwalter.id,
      action: AUDIT.WEG_CO2_DELETED,
      targetType: "Co2Allocation",
      targetId: alloc.id,
    });
  }
  revalidatePath(`/verwaltung/weg/${property.id}/co2`);
  back(property.id, "gespeichert=geloescht");
}
