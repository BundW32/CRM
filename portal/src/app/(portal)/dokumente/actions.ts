"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { DOCUMENT_TYPES, saveUpload } from "@/lib/storage";
import { requireUser, requireVerwalter } from "@/lib/session";

const uploadSchema = z.object({
  title: z.string().trim().min(2).max(200),
  category: z.enum(["ABRECHNUNG", "PROTOKOLL", "VERTRAG", "BESCHEINIGUNG", "SONSTIGES"]),
  audience: z.enum(["MIETER", "EIGENTUEMER", "ALLE"]),
  propertyId: z.string().optional(),
  unitId: z.string().optional(),
});

export async function uploadDocument(formData: FormData) {
  const user = await requireVerwalter();

  const parsed = uploadSchema.safeParse({
    title: formData.get("title"),
    category: formData.get("category"),
    audience: formData.get("audience"),
    propertyId: formData.get("propertyId") || undefined,
    unitId: formData.get("unitId") || undefined,
  });
  const file = formData.get("file");
  if (!parsed.success || !(file instanceof File) || file.size === 0) {
    redirect("/dokumente?fehler=eingabe");
  }

  // Einheit muss zum Objekt gehören
  let propertyId = parsed.data.propertyId || null;
  const unitId = parsed.data.unitId || null;
  if (unitId) {
    const unit = await db.unit.findUnique({ where: { id: unitId } });
    if (!unit) redirect("/dokumente?fehler=eingabe");
    propertyId = unit.propertyId;
  }

  let upload;
  try {
    upload = await saveUpload(file, DOCUMENT_TYPES);
  } catch {
    redirect("/dokumente?fehler=datei");
  }

  await db.document.create({
    data: {
      title: parsed.data.title,
      category: parsed.data.category,
      audience: parsed.data.audience,
      propertyId,
      unitId,
      uploadedById: user.id,
      ...upload,
    },
  });

  revalidatePath("/dokumente");
  redirect("/dokumente");
}

// Mieter/Eigentümer fordern ein Dokument an → wird als Vorgang erfasst
export async function requestDocument(formData: FormData) {
  const user = await requireUser();
  const description = String(formData.get("description") ?? "").trim();
  if (description.length < 3 || description.length > 2000) {
    redirect("/dokumente?fehler=anfrage");
  }

  // Bezugsobjekt ermitteln: erste Wohnung bzw. erstes Objekt des Nutzers
  const tenancy = await db.tenancy.findFirst({
    where: { userId: user.id, active: true },
    include: { unit: true },
  });
  const ownership = await db.ownership.findFirst({ where: { userId: user.id } });
  const propertyId = tenancy?.unit.propertyId ?? ownership?.propertyId;
  if (!propertyId) {
    redirect("/dokumente?fehler=anfrage");
  }

  const ticket = await db.ticket.create({
    data: {
      type: "DOKUMENT_ANFRAGE",
      title: "Dokumentanforderung",
      description,
      propertyId,
      unitId: tenancy?.unitId ?? null,
      createdById: user.id,
    },
  });

  revalidatePath("/vorgaenge");
  redirect(`/vorgaenge/${ticket.id}`);
}
