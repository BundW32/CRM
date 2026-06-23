"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export async function createNote(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "VERWALTER") return;
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;
  const propertyId = (formData.get("propertyId") as string | null) || undefined;
  const unitId = (formData.get("unitId") as string | null) || undefined;
  const targetUserId = (formData.get("targetUserId") as string | null) || undefined;
  await db.note.create({
    data: {
      body,
      authorId: user.id,
      propertyId: propertyId || null,
      unitId: unitId || null,
      targetUserId: targetUserId || null,
    },
  });
  revalidatePath("/verwaltung/notizen");
}

export async function deleteNote(id: string) {
  const user = await requireUser();
  if (user.role !== "VERWALTER") return;
  await db.note.delete({ where: { id } });
  revalidatePath("/verwaltung/notizen");
}

export async function togglePinNote(id: string, pinned: boolean) {
  const user = await requireUser();
  if (user.role !== "VERWALTER") return;
  await db.note.update({ where: { id }, data: { pinned: !pinned } });
  revalidatePath("/verwaltung/notizen");
}
