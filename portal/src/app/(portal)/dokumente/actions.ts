"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canVerwalterAccessProperty, canViewProperty, userWhereForVerwalter } from "@/lib/access";
import { db } from "@/lib/db";
import { notifyDocumentPublished } from "@/lib/notify";
import { DOCUMENT_TYPES, deleteBlob, saveUpload } from "@/lib/storage";
import { requireUser, requireVerwalter } from "@/lib/session";

const uploadSchema = z.object({
  title: z.string().trim().min(2).max(200),
  category: z.enum(["ABRECHNUNG", "PROTOKOLL", "VERTRAG", "BESCHEINIGUNG", "SONSTIGES"]),
  audience: z.enum(["MIETER", "EIGENTUEMER", "ALLE", "BEIRAT"]),
  propertyId: z.string().optional(),
  unitId: z.string().optional(),
});

const ownerUploadSchema = z.object({
  title: z.string().trim().min(2).max(200),
  category: z.enum(["ABRECHNUNG", "PROTOKOLL", "VERTRAG", "BESCHEINIGUNG", "SONSTIGES"]),
  propertyId: z.string().min(1),
});

// Eigentümer lädt selbst ein Dokument hoch. Sichtbar für die Verwaltung (die alle
// Dokumente im Objekt-Scope sieht) und den Eigentümer selbst; optional zusätzlich
// für die aktuellen Mieter des Objekts. Umsetzung über gezielte Empfänger, damit
// andere Eigentümer es NICHT sehen.
export async function uploadOwnerDocument(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "EIGENTUEMER") redirect("/infos?t=dokumente");

  const parsed = ownerUploadSchema.safeParse({
    title: formData.get("title"),
    category: formData.get("category"),
    propertyId: formData.get("propertyId"),
  });
  const file = formData.get("file");
  if (!parsed.success || !(file instanceof File) || file.size === 0) {
    redirect("/infos?t=dokumente&fehler=eingabe");
  }
  const propertyId = parsed.data.propertyId;
  // Nur an eigene Objekte anhängen (Eigentümer-Prüfung, org-gesichert).
  if (!(await canViewProperty(user, propertyId))) {
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
      audience: "EIGENTUEMER", // durch Empfänger gegated – dient nur als Kennzeichen
      propertyId,
      uploadedById: user.id,
      organizationId: user.organizationId,
      ...upload,
    },
  });

  // Empfänger: der Eigentümer selbst; optional die aktiven Mieter des Objekts.
  // Die Verwaltung sieht das Dokument ohnehin über den Objekt-Scope.
  const recipientIds = new Set<string>([user.id]);
  if (String(formData.get("shareTenants") ?? "") === "1") {
    const tenancies = await db.tenancy.findMany({
      where: { active: true, unit: { propertyId } },
      select: { userId: true },
    });
    for (const t of tenancies) recipientIds.add(t.userId);
  }
  await db.documentRecipient.createMany({
    data: [...recipientIds].map((uid) => ({ documentId: doc.id, userId: uid })),
    skipDuplicates: true,
  });

  await notifyDocumentPublished(doc.id);
  revalidatePath("/infos");
  redirect("/infos?t=dokumente&hochgeladen=1");
}

// Typeahead-Suche nach möglichen Empfängern (Eigentümer/Mieter im Scope). Statt
// alle Nutzer in ein Riesen-Menü zu laden, wird serverseitig nach Name/E-Mail
// gefiltert und auf wenige Treffer begrenzt – skaliert auf beliebig viele Nutzer.
export type RecipientHit = { id: string; name: string; role: string; context: string };

export async function searchDocumentRecipients(query: string): Promise<RecipientHit[]> {
  const user = await requireVerwalter();
  const q = query.trim();
  if (q.length < 2) return [];
  const users = await db.user.findMany({
    where: {
      AND: [
        await userWhereForVerwalter(user),
        { role: { in: ["EIGENTUEMER", "MIETER"] }, active: true },
        {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        },
      ],
    },
    select: {
      id: true,
      name: true,
      role: true,
      tenancies: {
        where: { active: true },
        take: 1,
        select: { unit: { select: { label: true, property: { select: { name: true } } } } },
      },
      ownerships: { take: 1, select: { property: { select: { name: true } } } },
    },
    orderBy: { name: "asc" },
    take: 20,
  });
  return users.map((u) => {
    let context = "";
    if (u.role === "MIETER" && u.tenancies[0]) {
      context = `${u.tenancies[0].unit.property.name} · ${u.tenancies[0].unit.label}`;
    } else if (u.role === "EIGENTUEMER" && u.ownerships[0]) {
      context = u.ownerships[0].property.name;
    }
    return { id: u.id, name: u.name, role: u.role, context };
  });
}

// Dokument endgültig löschen (Verwalter im Objekt-Scope). Empfänger und
// Lesebestätigungen werden per Kaskade mit entfernt; die Datei im Storage wird
// nach dem DB-Löschen aufgeräumt.
export async function deleteDocument(formData: FormData) {
  const user = await requireVerwalter();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/infos?t=dokumente");
  const doc = await db.document.findUnique({
    where: { id },
    select: { organizationId: true, propertyId: true, storedName: true },
  });
  if (!doc || doc.organizationId !== user.organizationId) redirect("/infos?t=dokumente");
  // Objektlose Dokumente (propertyId null) darf nur der SuperAdmin löschen –
  // canVerwalterAccessProperty(user, null) bildet das ab.
  if (!(await canVerwalterAccessProperty(user, doc.propertyId))) redirect("/infos?t=dokumente");

  await db.document.delete({ where: { id } });
  await deleteBlob(doc.storedName);
  revalidatePath("/infos");
  redirect("/infos?t=dokumente&geloescht=1");
}

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
      organizationId: user.organizationId,
      ...upload,
    },
  });

  // Optionale gezielte Empfänger: nur Nutzer im eigenen Scope zulassen. Sind
  // Empfänger gesetzt, sehen NUR diese Personen (plus Verwalter) das Dokument.
  const recipientIds = formData.getAll("recipientIds").map((v) => String(v)).filter(Boolean);
  if (recipientIds.length > 0) {
    const valid = await db.user.findMany({
      where: { AND: [{ id: { in: recipientIds } }, await userWhereForVerwalter(user)] },
      select: { id: true },
    });
    if (valid.length > 0) {
      await db.documentRecipient.createMany({
        data: valid.map((r) => ({ documentId: doc.id, userId: r.id })),
        skipDuplicates: true,
      });
    }
  }

  // Mieter/Eigentümer im Scope (bzw. gezielte Empfänger) über das neue Dokument informieren
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
      organizationId: user.organizationId,
    },
  });

  revalidatePath("/vorgaenge");
  redirect(`/vorgaenge/${ticket.id}`);
}
