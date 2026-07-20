"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { User } from "@/generated/prisma/client";
import { canVerwalterAccessProperty, isBoardMemberOf } from "@/lib/access";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

// Zugriff auf den Beirats-Bereich eines Objekts: Beiratsmitglied (Eigentümer mit
// Kennzeichen) ODER der zuständige Verwalter (unterstützt den Beirat).
async function canAccessBeiratProperty(user: User, propertyId: string): Promise<boolean> {
  if (!propertyId) return false;
  if (user.role === "VERWALTER") return canVerwalterAccessProperty(user, propertyId);
  return isBoardMemberOf(user.id, propertyId);
}

export async function addBeiratTask(formData: FormData) {
  const user = await requireUser();
  const propertyId = String(formData.get("propertyId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim().slice(0, 200);
  const description = String(formData.get("description") ?? "").trim().slice(0, 2000) || null;
  if (!title) redirect("/beirat");
  if (!(await canAccessBeiratProperty(user, propertyId))) redirect("/beirat");

  await db.beiratTask.create({
    data: {
      organizationId: user.organizationId,
      propertyId,
      title,
      description,
      createdById: user.id,
    },
  });
  revalidatePath("/beirat");
  redirect("/beirat");
}

export async function toggleBeiratTask(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/beirat");
  const task = await db.beiratTask.findFirst({
    where: { id, organizationId: user.organizationId },
    select: { propertyId: true, done: true },
  });
  if (!task || !(await canAccessBeiratProperty(user, task.propertyId))) redirect("/beirat");

  await db.beiratTask.update({ where: { id }, data: { done: !task.done } });
  revalidatePath("/beirat");
  redirect("/beirat");
}

export async function deleteBeiratTask(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/beirat");
  const task = await db.beiratTask.findFirst({
    where: { id, organizationId: user.organizationId },
    select: { propertyId: true },
  });
  if (!task || !(await canAccessBeiratProperty(user, task.propertyId))) redirect("/beirat");

  await db.beiratTask.delete({ where: { id } });
  revalidatePath("/beirat");
  redirect("/beirat");
}
