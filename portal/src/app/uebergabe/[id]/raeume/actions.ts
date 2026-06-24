"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";
import { saveUpload, IMAGE_TYPES } from "@/lib/storage";
import type { RoomType } from "@/generated/prisma/client";

export async function addRoom(formData: FormData) {
  await requireVerwalter();
  const handoverId = String(formData.get("handoverId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const roomType = String(formData.get("roomType") ?? "SONSTIGES") as RoomType;
  if (!handoverId || !name) return;

  const existing = await db.handoverRoom.count({ where: { handoverId } });

  await db.handoverRoom.create({
    data: { handoverId, name, roomType, sortOrder: existing },
  });

  revalidatePath(`/uebergabe/${handoverId}/raeume`);
}

// Inline-Bearbeitung von Bezeichnung & Art direkt in der Übersicht.
export async function updateRoomMeta(formData: FormData) {
  await requireVerwalter();
  const roomId = String(formData.get("roomId") ?? "").trim();
  const handoverId = String(formData.get("handoverId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const roomType = String(formData.get("roomType") ?? "SONSTIGES") as RoomType;
  if (!roomId || !handoverId) return;

  await db.handoverRoom.update({
    where: { id: roomId },
    data: { name: name || "Raum", roomType },
  });

  revalidatePath(`/uebergabe/${handoverId}/raeume`);
}

// Strukturierte Prüfpunkte (ok / maengel / na) inkl. Notizen + allgemeine Anmerkung.
export async function updateRoomChecks(formData: FormData) {
  await requireVerwalter();
  const roomId = String(formData.get("roomId") ?? "").trim();
  const handoverId = String(formData.get("handoverId") ?? "").trim();
  if (!roomId || !handoverId) return;

  const checks: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("check_")) {
      const v = String(value);
      if (v) checks[key.slice(6)] = v;
    } else if (key.startsWith("note_")) {
      const v = String(value).trim();
      if (v) checks[key] = v;
    }
  }

  await db.handoverRoom.update({
    where: { id: roomId },
    data: {
      checks,
      overallNote: String(formData.get("overallNote") ?? "").trim() || null,
    },
  });

  revalidatePath(`/uebergabe/${handoverId}/raeume`);
}

export async function deleteRoom(formData: FormData) {
  await requireVerwalter();
  const roomId = String(formData.get("roomId") ?? "").trim();
  const handoverId = String(formData.get("handoverId") ?? "").trim();
  if (!roomId || !handoverId) return;

  await db.handoverRoom.delete({ where: { id: roomId } });
  revalidatePath(`/uebergabe/${handoverId}/raeume`);
}

export async function uploadRoomPhoto(formData: FormData) {
  await requireVerwalter();
  const handoverId = String(formData.get("handoverId") ?? "").trim();
  const roomId = String(formData.get("roomId") ?? "").trim();
  const file = formData.get("photo") as File | null;
  if (!handoverId || !roomId || !file || file.size === 0) return;

  const { storedName, fileName, mimeType, size } = await saveUpload(file, IMAGE_TYPES);

  await db.handoverPhoto.create({
    data: { handoverId, roomId, storedName, fileName, mimeType, size },
  });

  revalidatePath(`/uebergabe/${handoverId}/raeume`);
}

export async function deletePhoto(formData: FormData) {
  await requireVerwalter();
  const photoId = String(formData.get("photoId") ?? "").trim();
  const handoverId = String(formData.get("handoverId") ?? "").trim();
  if (!photoId || !handoverId) return;

  await db.handoverPhoto.delete({ where: { id: photoId } });
  revalidatePath(`/uebergabe/${handoverId}/raeume`);
}
