"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canVerwalterAccessProperty } from "@/lib/access";
import { db } from "@/lib/db";
import { notifyDocumentPublished } from "@/lib/notify";
import { DOCUMENT_TYPES, saveUpload } from "@/lib/storage";
import { requireUser, requireVerwalter } from "@/lib/session";

const uploadSchema = z.object({
  title: z.string().trim().min(2).max(200),
  category: z.enum(["ABRECHNUNG", "PROTOKOLL", "VERTRAG", "BESCHEINIGUNG", "SONSTIGES"]),
  audience: z.enum(["MIETER", "EIGENTUEMER", "ALLE"]),
  propertyId: z.string().optional(),
  unitId: z.string().optional(),
});

// Mieter/Eigentümer bestätigen, ein Dokument zur Kenntnis genommen zu haben
export async function acknowledgeDocument(formData: FormData) {
  const user = await requireUser();
  const documentId = String(formData.get("id") ?? "");
  if (documentId && user.role !== "VERWALTER") {
    await db.acknowledgement
      .create({ data: { userId: user.id, documentId } })
      .catch(() => {});
  }
  revalidatePath("/infos");
  redirect("/infos?t=dokumente");
}

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
    redirect("/infos?t=dokumente&fehler=eingabe");
  }

  // Einheit muss zum Objekt gehören
  let propertyId = parsed.data.propertyId || null;
  const unitId = parsed.data.unitId || null;
  if (unitId) {
    const unit = await db.unit.findUnique({ where: { id: unitId } });
    if (!unit) redirect("/infos?t=dokumente&fehler=eingabe");
    propertyId = unit.propertyId;
  }

  // Scope-Prüfung: eingeschränkte Verwalter dürfen Dokumente nur an eigene
  // Objekte hängen (verhindert Veröffentlichung an fremde Mieter/Eigentümer).
  if (!(await canVerwalterAccessProperty(user, propertyId))) {
    redirect("/infos?t=dokumente&fehler=eingabe");
  }

  let upload;
  try {
    upload = await saveUpload(file, DOCUMENT_TYPES);
  } catch {
    redirect("/infos?t=dokumente&fehler=datei");
  }

  const doc = await db.document.create({
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

  // Mieter/Eigentümer im Scope über das neue Dokument informieren
  await notifyDocumentPublished(doc.id);

  revalidatePath("/infos");
  redirect("/infos?t=dokumente");
}

// Mieter/Eigentümer fordern ein Dokument an → wird als Vorgang erfasst
export async function requestDocument(formData: FormData) {
  const user = await requireUser();
  const art = String(formData.get("art") ?? "").trim().slice(0, 120);
  const description = String(formData.get("description") ?? "").trim().slice(0, 2000);
  // Es muss mindestens eine Dokumentart gewählt oder ein Text angegeben sein
  if (!art && description.length < 3) {
    redirect("/infos?t=dokumente&fehler=anfrage");
  }

  // Bezugsobjekt ermitteln: erste Wohnung bzw. erstes Objekt des Nutzers
  const tenancy = await db.tenancy.findFirst({
    where: { userId: user.id, active: true },
    include: { unit: true },
  });
  const ownership = await db.ownership.findFirst({ where: { userId: user.id } });
  const propertyId = tenancy?.unit.propertyId ?? ownership?.propertyId;
  if (!propertyId) {
    redirect("/infos?t=dokumente&fehler=anfrage");
  }

  const ticket = await db.ticket.create({
    data: {
      type: "DOKUMENT_ANFRAGE",
      title: art ? `Dokumentanforderung: ${art}` : "Dokumentanforderung",
      description: description || `Angefordert: ${art}`,
      propertyId,
      unitId: tenancy?.unitId ?? null,
      createdById: user.id,
    },
  });

  revalidatePath("/vorgaenge");
  redirect(`/vorgaenge/${ticket.id}`);
}
