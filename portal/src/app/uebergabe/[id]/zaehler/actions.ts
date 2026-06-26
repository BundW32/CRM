"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";
import { canVerwalterAccessHandover } from "@/lib/access";
import { saveUpload, IMAGE_TYPES } from "@/lib/storage";
import type { MeterType } from "@/generated/prisma/client";

export async function addMeter(formData: FormData) {
  const verwalter = await requireVerwalter();
  const handoverId = String(formData.get("handoverId") ?? "").trim();
  const meterType = String(formData.get("meterType") ?? "STROM") as MeterType;
  if (!handoverId) return;
  if (!(await canVerwalterAccessHandover(verwalter, handoverId))) redirect("/uebergabe");

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
  const verwalter = await requireVerwalter();
  const meterId = String(formData.get("meterId") ?? "").trim();
  const handoverId = String(formData.get("handoverId") ?? "").trim();
  if (!meterId || !handoverId) return;
  if (!(await canVerwalterAccessHandover(verwalter, handoverId))) redirect("/uebergabe");

  const readingDateStr = String(formData.get("readingDate") ?? "");

  // Kind an die validierte handoverId binden: eine fremde meterId trifft keine Zeile.
  await db.handoverMeter.updateMany({
    where: { id: meterId, handoverId },
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
  const verwalter = await requireVerwalter();
  const meterId = String(formData.get("meterId") ?? "").trim();
  const handoverId = String(formData.get("handoverId") ?? "").trim();
  if (!meterId || !handoverId) return;
  if (!(await canVerwalterAccessHandover(verwalter, handoverId))) redirect("/uebergabe");

  // Kind an die validierte handoverId binden (verhindert Löschen fremder Zähler).
  await db.handoverMeter.deleteMany({ where: { id: meterId, handoverId } });
  revalidatePath(`/uebergabe/${handoverId}/zaehler`);
}

export async function uploadMeterPhoto(formData: FormData) {
  const verwalter = await requireVerwalter();
  const meterId = String(formData.get("meterId") ?? "").trim();
  const handoverId = String(formData.get("handoverId") ?? "").trim();
  const file = formData.get("photo") as File | null;
  if (!meterId || !handoverId || !file || file.size === 0) return;
  if (!(await canVerwalterAccessHandover(verwalter, handoverId))) redirect("/uebergabe");

  const { storedName } = await saveUpload(file, IMAGE_TYPES);

  // Kind an die validierte handoverId binden.
  await db.handoverMeter.updateMany({
    where: { id: meterId, handoverId },
    data: { photoStoredName: storedName },
  });

  revalidatePath(`/uebergabe/${handoverId}/zaehler`);
}
