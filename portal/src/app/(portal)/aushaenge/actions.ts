"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, requireVerwalter } from "@/lib/session";

const announcementSchema = z.object({
  propertyId: z.string().min(1),
  audience: z.enum(["MIETER", "EIGENTUEMER", "ALLE"]),
  title: z.string().trim().min(3).max(200),
  body: z.string().trim().min(3).max(5000),
});

export async function createAnnouncement(formData: FormData) {
  const user = await requireVerwalter();

  const parsed = announcementSchema.safeParse({
    propertyId: formData.get("propertyId"),
    audience: formData.get("audience"),
    title: formData.get("title"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    redirect("/aushaenge?fehler=eingabe");
  }

  await db.announcement.create({
    data: { ...parsed.data, createdById: user.id },
  });

  revalidatePath("/aushaenge");
  redirect("/aushaenge");
}

// Mieter/Eigentümer bestätigen, einen Aushang zur Kenntnis genommen zu haben
export async function acknowledgeAnnouncement(formData: FormData) {
  const user = await requireUser();
  const announcementId = String(formData.get("id") ?? "");
  if (announcementId && user.role !== "VERWALTER") {
    await db.acknowledgement
      .create({ data: { userId: user.id, announcementId } })
      .catch(() => {});
  }
  revalidatePath("/aushaenge");
  redirect("/aushaenge");
}

export async function deleteAnnouncement(formData: FormData) {
  await requireVerwalter();
  const id = String(formData.get("id") ?? "");
  if (id) {
    await db.announcement.delete({ where: { id } }).catch(() => {});
  }
  revalidatePath("/aushaenge");
  redirect("/aushaenge");
}
