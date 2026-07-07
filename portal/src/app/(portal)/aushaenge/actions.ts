"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canVerwalterAccessProperty } from "@/lib/access";
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
    redirect("/infos?t=aushaenge&fehler=eingabe");
  }

  // Scope-Prüfung: nur Objekte im Zuständigkeitsbereich
  if (!(await canVerwalterAccessProperty(user, parsed.data.propertyId))) {
    redirect("/infos?t=aushaenge&fehler=eingabe");
  }

  await db.announcement.create({
    data: { ...parsed.data, createdById: user.id, organizationId: user.organizationId },
  });

  revalidatePath("/infos");
  redirect("/infos?t=aushaenge");
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
  revalidatePath("/infos");
  redirect("/infos?t=aushaenge");
}

export async function deleteAnnouncement(formData: FormData) {
  const user = await requireVerwalter();
  const id = String(formData.get("id") ?? "");
  if (id) {
    // Scope-Prüfung vor dem Löschen
    const announcement = await db.announcement.findUnique({
      where: { id },
      select: { propertyId: true },
    });
    if (announcement && (await canVerwalterAccessProperty(user, announcement.propertyId))) {
      await db.announcement.delete({ where: { id } }).catch(() => {});
    }
  }
  revalidatePath("/infos");
  redirect("/infos?t=aushaenge");
}
