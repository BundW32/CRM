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
    data: {
      handoverId,
      name,
      roomType,
      sortOrder: existing,
    },
  });

  revalidatePath(`/uebergabe/${handoverId}/raeume`);
}

export async function updateRoom(formData: FormData) {
  await requireVerwalter();
  const roomId = String(formData.get("roomId") ?? "").trim();
  const handoverId = String(formData.get("handoverId") ?? "").trim();
  if (!roomId || !handoverId) return;

  await db.handoverRoom.update({
    where: { id: roomId },
    data: {
      overallNote: String(formData.get("overallNote") ?? "").trim() || null,
      wallsNote: String(formData.get("wallsNote") ?? "").trim() || null,
      ceilingNote: String(formData.get("ceilingNote") ?? "").trim() || null,
      floorNote: String(formData.get("floorNote") ?? "").trim() || null,
      windowsNote: String(formData.get("windowsNote") ?? "").trim() || null,
      doorsNote: String(formData.get("doorsNote") ?? "").trim() || null,
      heatingNote: String(formData.get("heatingNote") ?? "").trim() || null,
      sanitaryNote: String(formData.get("sanitaryNote") ?? "").trim() || null,
      otherNote: String(formData.get("otherNote") ?? "").trim() || null,
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

