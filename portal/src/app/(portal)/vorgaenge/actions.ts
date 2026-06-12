"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canViewTicket, ticketTargetsForUser } from "@/lib/access";
import { db } from "@/lib/db";
import { IMAGE_TYPES, saveUpload } from "@/lib/storage";
import { requireUser, requireVerwalter } from "@/lib/session";

const createTicketSchema = z.object({
  type: z.enum(["SCHADEN", "ANFRAGE", "DOKUMENT_ANFRAGE", "SONSTIGES"]),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(3).max(5000),
  category: z.string().trim().max(100).optional(),
  location: z.string().trim().max(200).optional(),
  target: z.string().min(1),
});

export async function createTicket(formData: FormData) {
  const user = await requireUser();

  const parsed = createTicketSchema.safeParse({
    type: formData.get("type"),
    title: formData.get("title"),
    description: formData.get("description"),
    category: formData.get("category") || undefined,
    location: formData.get("location") || undefined,
    target: formData.get("target"),
  });
  if (!parsed.success) {
    redirect("/vorgaenge/neu?fehler=eingabe");
  }

  // Ziel (Objekt/Einheit) gegen die Berechtigungen des Nutzers prüfen
  const [propertyId, unitId] = parsed.data.target.split("|");
  const targets = await ticketTargetsForUser(user);
  const allowed = targets.some(
    (t) => t.propertyId === propertyId && (t.unitId ?? "") === (unitId ?? "")
  );
  if (!allowed) {
    redirect("/vorgaenge/neu?fehler=ziel");
  }

  const files = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > 10) {
    redirect("/vorgaenge/neu?fehler=dateien");
  }

  const uploads = [];
  for (const file of files) {
    try {
      uploads.push(await saveUpload(file, IMAGE_TYPES));
    } catch {
      redirect("/vorgaenge/neu?fehler=dateien");
    }
  }

  const ticket = await db.ticket.create({
    data: {
      type: parsed.data.type,
      title: parsed.data.title,
      description: parsed.data.description,
      category: parsed.data.category,
      location: parsed.data.location,
      propertyId,
      unitId: unitId || null,
      createdById: user.id,
      attachments: { create: uploads },
    },
  });

  revalidatePath("/vorgaenge");
  redirect(`/vorgaenge/${ticket.id}`);
}

export async function addComment(formData: FormData) {
  const user = await requireUser();
  const ticketId = String(formData.get("ticketId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const internal = user.role === "VERWALTER" && formData.get("internal") === "on";

  const ticket = await db.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket || !(await canViewTicket(user, ticket))) {
    redirect("/vorgaenge");
  }
  if (body.length === 0 || body.length > 5000) {
    redirect(`/vorgaenge/${ticketId}?fehler=kommentar`);
  }

  await db.ticketComment.create({
    data: { ticketId, authorId: user.id, body, internal },
  });
  await db.ticket.update({ where: { id: ticketId }, data: { updatedAt: new Date() } });

  revalidatePath(`/vorgaenge/${ticketId}`);
  redirect(`/vorgaenge/${ticketId}`);
}

const updateTicketSchema = z.object({
  ticketId: z.string().min(1),
  status: z.enum(["NEU", "IN_BEARBEITUNG", "BEAUFTRAGT", "ERLEDIGT", "GESCHLOSSEN"]),
  priority: z.enum(["NIEDRIG", "NORMAL", "HOCH", "DRINGEND"]),
  assignedToId: z.string().optional(),
});

export async function updateTicket(formData: FormData) {
  await requireVerwalter();

  const parsed = updateTicketSchema.safeParse({
    ticketId: formData.get("ticketId"),
    status: formData.get("status"),
    priority: formData.get("priority"),
    assignedToId: formData.get("assignedToId") || undefined,
  });
  if (!parsed.success) {
    redirect("/vorgaenge");
  }

  await db.ticket.update({
    where: { id: parsed.data.ticketId },
    data: {
      status: parsed.data.status,
      priority: parsed.data.priority,
      assignedToId: parsed.data.assignedToId || null,
    },
  });

  revalidatePath(`/vorgaenge/${parsed.data.ticketId}`);
  redirect(`/vorgaenge/${parsed.data.ticketId}`);
}
