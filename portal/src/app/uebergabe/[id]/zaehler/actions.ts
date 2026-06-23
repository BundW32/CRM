"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";
import { saveUpload, IMAGE_TYPES } from "@/lib/storage";
import type { MeterType } from "@/generated/prisma/client";

export async function addMeter(formData: FormData) {
  await requireVerwalter();
  const handoverId = String(formData.get("handoverId") ?? "").trim();
  const meterType = String(formData.get("meterType") ?? "STROM") as MeterType;
  if (!handoverId) return;

  const existing = await db.handoverMeter.count({ where: { handoverId } });

  await db.handoverMeter.create({
    data: {
      handoverId,
      meterType,
      sortOrder: existing,
    },
  });

  revalidatePath(`/uebergabe/${handoverId}/zaehler`);
}

export async function updateMeter(formData: FormData) {
  await requireVerwalter();
  const meterId = String(formData.get("meterId") ?? "").trim();
  const handoverId = String(formData.get("handoverId") ?? "").trim();
  if (!meterId || !handoverId) return;

  const readingDateStr = String(formData.get("readingDate") ?? "");

  await db.handoverMeter.update({
    where: { id: meterId },
    data: {
      meterNumber: String(formData.get("meterNumber") ?? "").trim() || null,
      reading: String(formData.get("reading") ?? "").trim() || null,
      readingDate: readingDateStr ? new Date(readingDateStr) : undefined,
      notes: String(formData.get("notes") ?? "").trim() || null,
    },
  });

  revalidatePath(`/uebergabe/${handoverId}/zaehler`);
}

export async function deleteMeter(formData: FormData) {
  await requireVerwalter();
  const meterId = String(formData.get("meterId") ?? "").trim();
  const handoverId = String(formData.get("handoverId") ?? "").trim();
  if (!meterId || !handoverId) return;

  await db.handoverMeter.delete({ where: { id: meterId } });
  revalidatePath(`/uebergabe/${handoverId}/zaehler`);
}

export async function uploadMeterPhoto(formData: FormData) {
  await requireVerwalter();
  const meterId = String(formData.get("meterId") ?? "").trim();
  const handoverId = String(formData.get("handoverId") ?? "").trim();
  const file = formData.get("photo") as File | null;
  if (!meterId || !handoverId || !file || file.size === 0) return;

  const { storedName } = await saveUpload(file, IMAGE_TYPES);

  await db.handoverMeter.update({
    where: { id: meterId },
    data: { photoStoredName: storedName },
  });

  revalidatePath(`/uebergabe/${handoverId}/zaehler`);
}
