"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";
import { canVerwalterAccessHandover } from "@/lib/access";
import { saveUpload, IMAGE_TYPES } from "@/lib/storage";
import { ablageFehlerText } from "@/lib/weg/ablage-fehler";
import type { RoomType } from "@/generated/prisma/client";

export async function addRoom(formData: FormData) {
  const verwalter = await requireVerwalter();
  const handoverId = String(formData.get("handoverId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const roomType = String(formData.get("roomType") ?? "SONSTIGES") as RoomType;
  if (!handoverId || !name) return;
  if (!(await canVerwalterAccessHandover(verwalter, handoverId))) redirect("/uebergabe");

  const existing = await db.handoverRoom.count({ where: { handoverId } });

  await db.handoverRoom.create({
    data: { handoverId, name, roomType, sortOrder: existing },
  });

  revalidatePath(`/uebergabe/${handoverId}/raeume`);
}

// Inline-Bearbeitung von Bezeichnung & Art direkt in der Übersicht.
export async function updateRoomMeta(formData: FormData) {
  const verwalter = await requireVerwalter();
  const roomId = String(formData.get("roomId") ?? "").trim();
  const handoverId = String(formData.get("handoverId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const roomType = String(formData.get("roomType") ?? "SONSTIGES") as RoomType;
  if (!roomId || !handoverId) return;
  if (!(await canVerwalterAccessHandover(verwalter, handoverId))) redirect("/uebergabe");

  // Kind an die validierte handoverId binden: ein fremder roomId trifft keine Zeile.
  await db.handoverRoom.updateMany({
    where: { id: roomId, handoverId },
    data: { name: name || "Raum", roomType },
  });

  revalidatePath(`/uebergabe/${handoverId}/raeume`);
}

// Strukturierte Prüfpunkte (ok / maengel / na) inkl. Notizen + allgemeine Anmerkung.
export async function updateRoomChecks(formData: FormData) {
  const verwalter = await requireVerwalter();
  const roomId = String(formData.get("roomId") ?? "").trim();
  const handoverId = String(formData.get("handoverId") ?? "").trim();
  if (!roomId || !handoverId) return;
  if (!(await canVerwalterAccessHandover(verwalter, handoverId))) redirect("/uebergabe");

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

  // Kind an die validierte handoverId binden.
  await db.handoverRoom.updateMany({
    where: { id: roomId, handoverId },
    data: {
      checks,
      overallNote: String(formData.get("overallNote") ?? "").trim() || null,
    },
  });

  revalidatePath(`/uebergabe/${handoverId}/raeume`);
}

export async function deleteRoom(formData: FormData) {
  const verwalter = await requireVerwalter();
  const roomId = String(formData.get("roomId") ?? "").trim();
  const handoverId = String(formData.get("handoverId") ?? "").trim();
  if (!roomId || !handoverId) return;
  if (!(await canVerwalterAccessHandover(verwalter, handoverId))) redirect("/uebergabe");

  // Kind an die validierte handoverId binden (verhindert Löschen fremder Räume).
  await db.handoverRoom.deleteMany({ where: { id: roomId, handoverId } });
  revalidatePath(`/uebergabe/${handoverId}/raeume`);
}

/**
 * Ergebnis statt Ausnahme.
 *
 * Die Fotos werden aus dem Browser einzeln nacheinander hochgeladen (Vercel
 * begrenzt den Rumpf einer Server-Action auf ~4,5 MB). Warf diese Funktion, kam
 * beim Nutzer in Produktion nicht der Grund an, sondern Nexts Ersatztext („An
 * error occurred in the Server Components render") — echte Fehlermeldungen
 * werden zum Client hin absichtlich verschwiegen. Also reist der Grund als
 * gewöhnlicher Rückgabewert mit; die Oberfläche zeigt ihn als Banner.
 */
export type FotoErgebnis = { ok: true } | { ok: false; grund: string };

export async function uploadRoomPhoto(formData: FormData): Promise<FotoErgebnis> {
  const verwalter = await requireVerwalter();
  const handoverId = String(formData.get("handoverId") ?? "").trim();
  const roomId = String(formData.get("roomId") ?? "").trim();
  const file = formData.get("photo") as File | null;
  if (!handoverId || !roomId || !file || file.size === 0) return { ok: true };
  if (!(await canVerwalterAccessHandover(verwalter, handoverId))) redirect("/uebergabe");
  // roomId an die validierte handoverId binden: kein Einschleusen in fremde Räume.
  const room = await db.handoverRoom.findFirst({
    where: { id: roomId, handoverId },
    select: { id: true },
  });
  if (!room) redirect("/uebergabe");

  let upload;
  try {
    upload = await saveUpload(file, IMAGE_TYPES);
  } catch (err) {
    console.error("Ablage eines Übergabefotos fehlgeschlagen", err);
    return { ok: false, grund: ablageFehlerText(err) };
  }
  const { storedName, fileName, mimeType, size } = upload;

  await db.handoverPhoto.create({
    data: { handoverId, roomId, storedName, fileName, mimeType, size },
  });

  revalidatePath(`/uebergabe/${handoverId}/raeume`);
  return { ok: true };
}

export async function deletePhoto(formData: FormData) {
  const verwalter = await requireVerwalter();
  const photoId = String(formData.get("photoId") ?? "").trim();
  const handoverId = String(formData.get("handoverId") ?? "").trim();
  if (!photoId || !handoverId) return;
  if (!(await canVerwalterAccessHandover(verwalter, handoverId))) redirect("/uebergabe");

  // Kind an die validierte handoverId binden (verhindert Löschen fremder Fotos).
  await db.handoverPhoto.deleteMany({ where: { id: photoId, handoverId } });
  revalidatePath(`/uebergabe/${handoverId}/raeume`);
}
