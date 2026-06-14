"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, requireVerwalter } from "@/lib/session";

const meterSchema = z.object({
  unitId: z.string().min(1),
  type: z.enum(["STROM", "GAS", "WASSER_KALT", "WASSER_WARM", "HEIZUNG", "SONSTIGES"]),
  meterNumber: z.string().trim().max(100).optional(),
  location: z.string().trim().max(200).optional(),
});

export async function createMeter(formData: FormData) {
  await requireVerwalter();
  const parsed = meterSchema.safeParse({
    unitId: formData.get("unitId"),
    type: formData.get("type"),
    meterNumber: formData.get("meterNumber") || undefined,
    location: formData.get("location") || undefined,
  });
  if (!parsed.success) {
    redirect("/zaehler?fehler=eingabe");
  }
  await db.meter.create({
    data: {
      unitId: parsed.data.unitId,
      type: parsed.data.type,
      meterNumber: parsed.data.meterNumber || null,
      location: parsed.data.location || null,
    },
  });
  revalidatePath("/zaehler");
  redirect("/zaehler");
}

export async function deleteMeter(formData: FormData) {
  await requireVerwalter();
  const id = String(formData.get("id") ?? "");
  if (id) {
    await db.meter.delete({ where: { id } }).catch(() => {});
  }
  revalidatePath("/zaehler");
  redirect("/zaehler");
}

export async function submitReading(formData: FormData) {
  const user = await requireUser();
  const meterId = String(formData.get("meterId") ?? "");
  const valueRaw = String(formData.get("value") ?? "").trim().replace(",", ".");
  const dateRaw = String(formData.get("readingDate") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim().slice(0, 300) || null;

  const meter = await db.meter.findUnique({ where: { id: meterId } });
  if (!meter) redirect("/zaehler");

  // Mieter dürfen nur Zähler ihrer eigenen Einheit ablesen
  if (user.role !== "VERWALTER") {
    const tenancy = await db.tenancy.findFirst({
      where: { userId: user.id, unitId: meter.unitId, active: true },
    });
    if (!tenancy) redirect("/zaehler");
  }

  const value = Number(valueRaw);
  if (!Number.isFinite(value) || value < 0) {
    redirect("/zaehler?fehler=wert");
  }
  const readingDate = dateRaw ? new Date(dateRaw) : new Date();

  await db.meterReading.create({
    data: {
      meterId,
      value,
      readingDate: Number.isNaN(readingDate.getTime()) ? new Date() : readingDate,
      note,
      createdById: user.id,
    },
  });
  revalidatePath("/zaehler");
  redirect("/zaehler?gespeichert=1");
}
