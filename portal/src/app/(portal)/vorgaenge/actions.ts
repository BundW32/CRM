"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Trade } from "@/generated/prisma/client";
import { canViewTicket, ticketTargetsForUser } from "@/lib/access";
import { db } from "@/lib/db";
import { ticketPriorityLabels } from "@/lib/labels";
import { sendMail } from "@/lib/mailer";
import {
  notifyAssignee,
  notifyCreatorNewComment,
  notifyCreatorStatusChange,
  notifyVerwalterNewTicket,
} from "@/lib/notify";
import { IMAGE_TYPES, saveUpload } from "@/lib/storage";
import { requireUser, requireVerwalter } from "@/lib/session";

const TRADES = [
  "SANITAER", "HEIZUNG", "ELEKTRO", "DACH", "MALER", "BODENLEGER",
  "FENSTER_TUEREN", "SCHLOSSEREI", "GARTEN", "REINIGUNG",
  "SCHAEDLINGSBEKAEMPFUNG", "AUFZUG", "ALLGEMEIN", "SONSTIGES",
] as const;

const createTicketSchema = z.object({
  type: z.enum(["SCHADEN", "ANFRAGE", "DOKUMENT_ANFRAGE", "SONSTIGES"]),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(3).max(5000),
  category: z.string().trim().max(100).optional(),
  trade: z.enum(TRADES).optional().or(z.literal("")),
  location: z.string().trim().max(200).optional(),
  target: z.string().min(1),
});

async function collectPhotoUploads(formData: FormData, redirectTo: string) {
  const files = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > 10) {
    redirect(redirectTo);
  }
  const uploads = [];
  for (const file of files) {
    try {
      uploads.push(await saveUpload(file, IMAGE_TYPES));
    } catch {
      redirect(redirectTo);
    }
  }
  return uploads;
}

export async function createTicket(formData: FormData) {
  const user = await requireUser();

  const parsed = createTicketSchema.safeParse({
    type: formData.get("type"),
    title: formData.get("title"),
    description: formData.get("description"),
    category: formData.get("category") || undefined,
    trade: formData.get("trade") || undefined,
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

  const uploads = await collectPhotoUploads(formData, "/vorgaenge/neu?fehler=dateien");

  const ticket = await db.ticket.create({
    data: {
      type: parsed.data.type,
      title: parsed.data.title,
      description: parsed.data.description,
      category: parsed.data.category,
      trade: parsed.data.trade ? (parsed.data.trade as Trade) : null,
      location: parsed.data.location,
      propertyId,
      unitId: unitId || null,
      createdById: user.id,
      attachments: { create: uploads },
    },
  });

  if (user.role !== "VERWALTER") {
    await notifyVerwalterNewTicket(ticket, user);
  }

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

  const uploads = await collectPhotoUploads(
    formData,
    `/vorgaenge/${ticketId}?fehler=dateien`
  );

  const comment = await db.ticketComment.create({
    data: {
      ticketId,
      authorId: user.id,
      body,
      internal,
      ...(uploads.length > 0
        ? { attachments: { create: uploads.map((u) => ({ ...u, ticketId })) } }
        : {}),
    },
  });
  void comment;
  await db.ticket.update({
    where: { id: ticketId },
    data: { updatedAt: new Date() },
  });

  if (!internal) {
    await notifyCreatorNewComment(ticketId, user);
  }

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
  const verwalter = await requireVerwalter();

  const parsed = updateTicketSchema.safeParse({
    ticketId: formData.get("ticketId"),
    status: formData.get("status"),
    priority: formData.get("priority"),
    assignedToId: formData.get("assignedToId") || undefined,
  });
  if (!parsed.success) {
    redirect("/vorgaenge");
  }

  const before = await db.ticket.findUnique({ where: { id: parsed.data.ticketId } });
  if (!before) {
    redirect("/vorgaenge");
  }

  // Zuweisung nur an aktive Verwalter oder Handwerker
  let assignedToId: string | null = null;
  if (parsed.data.assignedToId) {
    const assignee = await db.user.findUnique({
      where: { id: parsed.data.assignedToId },
    });
    if (!assignee || !assignee.active || assignee.role === "MIETER" || assignee.role === "EIGENTUEMER") {
      redirect(`/vorgaenge/${parsed.data.ticketId}`);
    }
    assignedToId = assignee.id;
  }

  await db.ticket.update({
    where: { id: parsed.data.ticketId },
    data: {
      status: parsed.data.status,
      priority: parsed.data.priority,
      assignedToId,
    },
  });

  if (parsed.data.status !== before.status) {
    await notifyCreatorStatusChange(parsed.data.ticketId, verwalter);
  }
  if (assignedToId && assignedToId !== before.assignedToId && assignedToId !== verwalter.id) {
    const assignee = await db.user.findUnique({ where: { id: assignedToId } });
    if (assignee) await notifyAssignee(parsed.data.ticketId, assignee);
  }

  revalidatePath(`/vorgaenge/${parsed.data.ticketId}`);
  redirect(`/vorgaenge/${parsed.data.ticketId}`);
}

// Verwalter ordnet einem Vorgang ein Gewerk und einen Handwerker zu
export async function assignCraftsman(formData: FormData) {
  await requireVerwalter();
  const ticketId = String(formData.get("ticketId") ?? "");
  const tradeRaw = String(formData.get("trade") ?? "");
  const craftsmanId = String(formData.get("craftsmanId") ?? "");
  const setBeauftragt = formData.get("setBeauftragt") === "on";

  const ticket = await db.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) redirect("/vorgaenge");

  const trade: Trade | null = (TRADES as readonly string[]).includes(tradeRaw)
    ? (tradeRaw as Trade)
    : null;

  let craftsmanIdToSet: string | null = null;
  if (craftsmanId) {
    const craftsman = await db.craftsman.findUnique({ where: { id: craftsmanId } });
    if (!craftsman || !craftsman.active) redirect(`/vorgaenge/${ticketId}`);
    craftsmanIdToSet = craftsman.id;
  }

  await db.ticket.update({
    where: { id: ticketId },
    data: {
      trade,
      craftsmanId: craftsmanIdToSet,
      ...(setBeauftragt && craftsmanIdToSet ? { status: "BEAUFTRAGT" as const } : {}),
    },
  });

  revalidatePath(`/vorgaenge/${ticketId}`);
  redirect(`/vorgaenge/${ticketId}`);
}

// Verwalter beauftragt den zugeordneten Handwerker per E-Mail mit den Vorgangsdaten
export async function notifyCraftsman(formData: FormData) {
  const verwalter = await requireVerwalter();
  const ticketId = String(formData.get("ticketId") ?? "");

  const ticket = await db.ticket.findUnique({
    where: { id: ticketId },
    include: { property: true, unit: true, craftsman: true },
  });
  if (!ticket || !ticket.craftsman) redirect(`/vorgaenge/${ticketId}`);
  if (!ticket.craftsman.email) {
    redirect(`/vorgaenge/${ticketId}?fehler=keine_email`);
  }

  const ortsangabe = [
    `Objekt: ${ticket.property.name}, ${ticket.property.street}, ${ticket.property.zip} ${ticket.property.city}`,
    ticket.unit ? `Einheit: ${ticket.unit.label}` : null,
    ticket.location ? `Ort im Objekt: ${ticket.location}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const anrede = ticket.craftsman.company
    ? `${ticket.craftsman.company} / ${ticket.craftsman.name}`
    : ticket.craftsman.name;

  await sendMail(
    ticket.craftsman.email,
    `Auftrag #${ticket.number}: ${ticket.title}`,
    `Guten Tag ${ticket.craftsman.name},\n\n` +
      `die B&W Immobilien Management UG möchte Sie mit folgendem Vorgang beauftragen:\n\n` +
      `Vorgang #${ticket.number} – ${ticket.title}\n` +
      `Priorität: ${ticketPriorityLabels[ticket.priority]}\n\n` +
      `Beschreibung:\n${ticket.description}\n\n` +
      `${ortsangabe}\n\n` +
      `Bitte stimmen Sie einen Termin direkt mit uns ab.\n\n` +
      `Mit freundlichen Grüßen\nB&W Immobilien Management UG\n` +
      `info@bundwimmobilien.de`
  );

  await db.ticketComment.create({
    data: {
      ticketId,
      authorId: verwalter.id,
      body: `Handwerker „${anrede}" per E-Mail beauftragt (${ticket.craftsman.email}).`,
      internal: true,
    },
  });
  // Bereits erledigte/geschlossene Vorgänge nicht wieder öffnen
  if (ticket.status !== "ERLEDIGT" && ticket.status !== "GESCHLOSSEN") {
    await db.ticket.update({
      where: { id: ticketId },
      data: { status: "BEAUFTRAGT" },
    });
  }

  revalidatePath(`/vorgaenge/${ticketId}`);
  redirect(`/vorgaenge/${ticketId}?beauftragt=1`);
}

// Handwerker melden den Stand ihrer zugewiesenen Aufträge zurück
export async function setOwnTicketStatus(formData: FormData) {
  const user = await requireUser();
  const ticketId = String(formData.get("ticketId") ?? "");
  const status = String(formData.get("status") ?? "");

  if (user.role !== "HANDWERKER" || !["IN_BEARBEITUNG", "ERLEDIGT"].includes(status)) {
    redirect("/vorgaenge");
  }
  const ticket = await db.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket || ticket.assignedToId !== user.id) {
    redirect("/vorgaenge");
  }

  await db.ticket.update({
    where: { id: ticketId },
    data: { status: status as "IN_BEARBEITUNG" | "ERLEDIGT" },
  });
  await notifyCreatorStatusChange(ticketId, user);

  revalidatePath(`/vorgaenge/${ticketId}`);
  redirect(`/vorgaenge/${ticketId}`);
}
