"use server";

import crypto from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Trade, User } from "@/generated/prisma/client";
import {
  canViewTicket,
  canVerwalterAccessProperty,
  canVerwalterUseCraftsman,
  canVerwalterUseTicketTarget,
  ticketTargetsForUser,
} from "@/lib/access";
import { db } from "@/lib/db";
import { getBrandingForOrg } from "@/lib/branding-server";
import { ticketPriorityLabels, unitPublicLabel } from "@/lib/labels";
import { portalUrl, sendMail } from "@/lib/mailer";
import {
  notifyAssignee,
  notifyCreatorNewComment,
  notifyCreatorStatusChange,
  notifyTenantStatusChange,
  notifyVerwalterNewTicket,
} from "@/lib/notify";
import { computeDueAt } from "@/lib/sla";
import { parseEuroToCents } from "@/lib/money";
import { MEDIA_TYPES, DOCUMENT_TYPES, deleteBlob, readUpload, saveBuffer, saveUpload } from "@/lib/storage";
import { errorMessage, isNextControlFlowError } from "@/lib/errors";
import { requireUser, requireVerwalter } from "@/lib/session";
import { AUDIT, logAudit } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";
import { applyTriage } from "@/lib/triage";
import {
  generateMietbescheinigung,
  generateWohnungsgeberbescheinigung,
  supportedCertificate,
  type SignatureImage,
} from "@/lib/documents/bescheinigungen";

const TRADES = [
  "SANITAER", "HEIZUNG", "ELEKTRO", "DACH", "MALER", "BODENLEGER",
  "FENSTER_TUEREN", "SCHLOSSEREI", "GARTEN", "REINIGUNG",
  "SCHAEDLINGSBEKAEMPFUNG", "AUFZUG", "ALLGEMEIN", "SONSTIGES",
] as const;

// Mandanten-Scope für jede mutierende Verwalter-Aktion an einem Vorgang erzwingen.
// Verhindert IDOR: ein eingeschränkter Verwalter darf nur Vorgänge in seinen
// zugewiesenen Objekten (bzw. noch nicht zugeordnete) bearbeiten. Liefert das
// Ticket zurück oder leitet bei fehlender Berechtigung weg.
async function requireTicketInScope(verwalter: User, ticketId: string) {
  if (!ticketId) redirect("/vorgaenge");
  const ticket = await db.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket || !(await canViewTicket(verwalter, ticket))) redirect("/vorgaenge");
  return ticket;
}

const createTicketSchema = z.object({
  type: z.enum(["SCHADEN", "ANFRAGE", "DOKUMENT_ANFRAGE", "SONSTIGES"]),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(5000).optional(),
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
      uploads.push(await saveUpload(file, MEDIA_TYPES));
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
    description: formData.get("description") || undefined,
    category: formData.get("category") || undefined,
    trade: formData.get("trade") || undefined,
    location: formData.get("location") || undefined,
    target: formData.get("target"),
  });
  if (!parsed.success) {
    redirect("/vorgaenge/neu?fehler=eingabe");
  }

  const isDocRequest = parsed.data.type === "DOKUMENT_ANFRAGE";
  const description = (parsed.data.description ?? "").trim();
  // Bei Schäden/Anfragen ist eine Beschreibung Pflicht; bei Dokumentanforderungen optional
  if (!isDocRequest && description.length < 3) {
    redirect("/vorgaenge/neu?fehler=eingabe");
  }

  // Ziel (Objekt/Einheit) gegen die Berechtigungen des Nutzers prüfen.
  // Verwalter: gezielte Scope-Prüfung (lädt nicht alle Ziele). Andere Rollen:
  // Mitgliedschaft in der – kleinen – Zielliste prüfen.
  const [propertyId, unitId] = parsed.data.target.split("|");
  const allowed =
    user.role === "VERWALTER"
      ? await canVerwalterUseTicketTarget(user, propertyId, unitId || null)
      : (await ticketTargetsForUser(user)).some(
          (t) => t.propertyId === propertyId && (t.unitId ?? "") === (unitId ?? "")
        );
  if (!allowed) {
    redirect("/vorgaenge/neu?fehler=ziel");
  }

  const uploads = isDocRequest
    ? []
    : await collectPhotoUploads(formData, "/vorgaenge/neu?fehler=dateien");

  const ticket = await db.ticket.create({
    data: {
      type: parsed.data.type,
      title: parsed.data.title,
      description: description || parsed.data.title,
      category: isDocRequest ? undefined : parsed.data.category,
      trade: !isDocRequest && parsed.data.trade ? (parsed.data.trade as Trade) : null,
      location: isDocRequest ? undefined : parsed.data.location,
      propertyId,
      unitId: unitId || null,
      createdById: user.id,
      organizationId: user.organizationId,
      attachments: { create: uploads },
    },
  });

  // KI-Triage nur bei Schäden/Anfragen ohne gewähltes Gewerk (nicht bei Dokumentanforderungen)
  let triaged = ticket;
  if (!isDocRequest && !parsed.data.trade) {
    const ai = await applyTriage(ticket.id, {
      title: parsed.data.title,
      description,
    });
    if (ai) triaged = { ...ticket, trade: ai.trade ?? ticket.trade, priority: ai.priority };
  }

  // SLA-Fälligkeitsdatum aus der (ggf. durch Triage angepassten) Priorität
  await db.ticket.update({
    where: { id: ticket.id },
    data: { dueAt: computeDueAt(triaged.priority) },
  });

  if (user.role !== "VERWALTER") {
    await notifyVerwalterNewTicket(triaged, user);
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

  await db.$transaction([
    db.ticketComment.create({
      data: {
        ticketId,
        authorId: user.id,
        body,
        internal,
        ...(uploads.length > 0
          ? { attachments: { create: uploads.map((u) => ({ ...u, ticketId })) } }
          : {}),
      },
    }),
    db.ticket.update({ where: { id: ticketId }, data: { updatedAt: new Date() } }),
  ]);

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
  cost: z.string().optional(),
  costNote: z.string().optional(),
});

export async function updateTicket(formData: FormData) {
  const verwalter = await requireVerwalter();

  const parsed = updateTicketSchema.safeParse({
    ticketId: formData.get("ticketId"),
    status: formData.get("status"),
    priority: formData.get("priority"),
    assignedToId: formData.get("assignedToId") || undefined,
    cost: formData.get("cost") ?? undefined,
    costNote: formData.get("costNote") ?? undefined,
  });
  if (!parsed.success) {
    redirect("/vorgaenge");
  }

  const before = await db.ticket.findUnique({ where: { id: parsed.data.ticketId } });
  if (!before || !(await canViewTicket(verwalter, before))) {
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

  // Status-Felder kohärent halten, wenn der Status direkt über das Dropdown
  // gesetzt wird (sonst z. B. GESCHLOSSEN ohne closedAt → inkonsistente Anzeige).
  const next = parsed.data.status;
  const statusFields: {
    closedAt?: Date | null;
    closedById?: string | null;
    completionReportedAt?: Date | null;
    completionReportedVia?: string | null;
  } = {};
  if (next !== before.status) {
    if (next === "GESCHLOSSEN") {
      statusFields.closedAt = new Date();
      statusFields.closedById = verwalter.id;
      if (!before.completionReportedAt) {
        statusFields.completionReportedAt = new Date();
        statusFields.completionReportedVia = "manuell";
      }
    } else if (next === "ERLEDIGT") {
      statusFields.closedAt = null;
      statusFields.closedById = null;
      if (!before.completionReportedAt) {
        statusFields.completionReportedAt = new Date();
        statusFields.completionReportedVia = "manuell";
      }
    } else {
      // zurück in einen aktiven Status → Abschluss-/Meldekennzeichen löschen
      statusFields.closedAt = null;
      statusFields.closedById = null;
      statusFields.completionReportedAt = null;
      statusFields.completionReportedVia = null;
    }
  }

  const dueAtUpdate =
    parsed.data.priority !== before.priority
      ? { dueAt: computeDueAt(parsed.data.priority) }
      : {};

  // Optionale Kostenerfassung: leeres Feld löscht den Betrag (null), sonst Cent.
  const costCents = parseEuroToCents(parsed.data.cost ?? "");
  const costNote = (parsed.data.costNote ?? "").trim().slice(0, 300) || null;

  await db.ticket.update({
    where: { id: parsed.data.ticketId },
    data: {
      status: next,
      priority: parsed.data.priority,
      assignedToId,
      costCents,
      costNote,
      ...statusFields,
      ...dueAtUpdate,
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

// Verwalter ordnet einen (z. B. per E-Mail eingegangenen) Vorgang einem Objekt/einer Einheit zu
export async function assignTicketTarget(formData: FormData) {
  const user = await requireVerwalter();
  const ticketId = String(formData.get("ticketId") ?? "");
  const target = String(formData.get("target") ?? "");
  const [propertyId, unitId] = target.split("|");
  if (!ticketId || !propertyId) redirect(`/vorgaenge/${ticketId}`);

  // Der Vorgang selbst muss im Scope liegen (kein „Übernehmen" fremder Vorgänge).
  await requireTicketInScope(user, ticketId);

  // Scope-Prüfung: nur Objekte/Einheiten im eigenen Zuständigkeitsbereich.
  // canVerwalterUseTicketTarget stellt zugleich sicher, dass die Einheit zum
  // Objekt gehört.
  if (!(await canVerwalterUseTicketTarget(user, propertyId, unitId || null))) {
    redirect(`/vorgaenge/${ticketId}`);
  }

  await db.ticket.update({
    where: { id: ticketId },
    data: { propertyId, unitId: unitId || null },
  });
  revalidatePath(`/vorgaenge/${ticketId}`);
  redirect(`/vorgaenge/${ticketId}?zugeordnet=1`);
}

// Verwalter ordnet einem Vorgang ein Gewerk und einen Handwerker zu
export async function assignCraftsman(formData: FormData) {
  const verwalter = await requireVerwalter();
  const ticketId = String(formData.get("ticketId") ?? "");
  const tradeRaw = String(formData.get("trade") ?? "");
  const craftsmanId = String(formData.get("craftsmanId") ?? "");
  const setBeauftragt = formData.get("setBeauftragt") === "on";

  await requireTicketInScope(verwalter, ticketId);

  const trade: Trade | null = (TRADES as readonly string[]).includes(tradeRaw)
    ? (tradeRaw as Trade)
    : null;

  let craftsmanIdToSet: string | null = null;
  if (craftsmanId) {
    const craftsman = await db.craftsman.findUnique({ where: { id: craftsmanId } });
    if (!craftsman || !craftsman.active) redirect(`/vorgaenge/${ticketId}`);
    // Eingeschränkte Verwalter dürfen nur freigegebene Handwerker zuordnen.
    if (!(await canVerwalterUseCraftsman(verwalter, craftsman.id))) {
      redirect(`/vorgaenge/${ticketId}`);
    }
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

// Verwalter gibt die Beauftragung EXTERNER Handwerker für diesen Vorgang frei.
// Bewusster Schritt nach Prüfung der internen Eigenleistung – ohne diese Freigabe
// blockiert notifyCraftsman die externe Beauftragung serverseitig.
export async function releaseExternalCraftsman(formData: FormData) {
  const verwalter = await requireVerwalter();
  const ticketId = String(formData.get("ticketId") ?? "");
  await requireTicketInScope(verwalter, ticketId);

  await db.ticket.update({
    where: { id: ticketId },
    data: { externalReleasedAt: new Date(), externalReleasedById: verwalter.id },
  });
  await db.ticketComment.create({
    data: {
      ticketId,
      authorId: verwalter.id,
      internal: true,
      body: "Externe Beauftragung freigegeben (interne Eigenleistung nicht möglich).",
    },
  });
  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.TICKET_EXTERNAL_RELEASED,
    targetType: "Ticket",
    targetId: ticketId,
    ip: await getClientIp(),
  });
  revalidatePath(`/vorgaenge/${ticketId}`);
  redirect(`/vorgaenge/${ticketId}?freigegeben=1`);
}

// Verwalter bestätigt den vom Handwerker vorgeschlagenen Termin. Erst danach gilt
// der Termin als verbindlich; der Handwerker wird (falls E-Mail vorhanden) informiert.
export async function confirmAppointment(formData: FormData) {
  const verwalter = await requireVerwalter();
  const ticketId = String(formData.get("ticketId") ?? "");
  const ticket = await db.ticket.findUnique({
    where: { id: ticketId },
    include: { craftsman: true },
  });
  if (!ticket || !(await canViewTicket(verwalter, ticket))) redirect("/vorgaenge");
  if (!ticket.appointmentNote) redirect(`/vorgaenge/${ticketId}`);

  await db.ticket.update({
    where: { id: ticketId },
    data: { appointmentConfirmedAt: new Date(), appointmentConfirmedById: verwalter.id },
  });
  await db.ticketComment.create({
    data: {
      ticketId,
      authorId: verwalter.id,
      internal: true,
      body: `Termin bestätigt: ${ticket.appointmentNote}`,
    },
  });
  if (ticket.craftsman?.email) {
    const branding = await getBrandingForOrg(ticket.organizationId);
    await sendMail(
      ticket.craftsman.email,
      `Termin bestätigt – Auftrag #${ticket.number}`,
      `Guten Tag ${ticket.craftsman.name},\n\n` +
        `Ihr Terminvorschlag für Vorgang #${ticket.number} „${ticket.title}" wurde bestätigt:\n` +
        `${ticket.appointmentNote}\n\n` +
        `Mit freundlichen Grüßen\n${branding.legalName}`,
      undefined,
      branding
    );
  }
  // Mieter über den bestätigten Termin informieren (verständliche Sprache)
  await notifyTenantStatusChange(
    ticketId,
    `Terminbestätigung zu Ihrem Anliegen #${ticket.number}`,
    `Bezüglich Ihres Anliegens „${ticket.title}" wurde folgender Termin vereinbart:\n\n` +
      `${ticket.appointmentNote}\n\n` +
      `Der Handwerker wird zu diesem Termin erscheinen.`
  );
  revalidatePath(`/vorgaenge/${ticketId}`);
  redirect(`/vorgaenge/${ticketId}?termin=bestaetigt`);
}

// Verwalter lehnt den Terminvorschlag ab (bittet um einen neuen Termin).
export async function declineAppointment(formData: FormData) {
  const verwalter = await requireVerwalter();
  const ticketId = String(formData.get("ticketId") ?? "");
  const ticket = await db.ticket.findUnique({
    where: { id: ticketId },
    include: { craftsman: true },
  });
  if (!ticket || !(await canViewTicket(verwalter, ticket))) redirect("/vorgaenge");
  if (!ticket.appointmentNote) redirect(`/vorgaenge/${ticketId}`);

  const abgelehnt = ticket.appointmentNote;
  await db.ticket.update({
    where: { id: ticketId },
    data: { appointmentNote: null, appointmentConfirmedAt: null, appointmentConfirmedById: null },
  });
  await db.ticketComment.create({
    data: {
      ticketId,
      authorId: verwalter.id,
      internal: true,
      body: `Terminvorschlag abgelehnt: ${abgelehnt}. Neuer Termin angefragt.`,
    },
  });
  if (ticket.craftsman?.email) {
    const branding = await getBrandingForOrg(ticket.organizationId);
    await sendMail(
      ticket.craftsman.email,
      `Bitte neuen Termin vorschlagen – Auftrag #${ticket.number}`,
      `Guten Tag ${ticket.craftsman.name},\n\n` +
        `Ihr Terminvorschlag für Vorgang #${ticket.number} „${ticket.title}" (${abgelehnt}) ` +
        `passt leider nicht. Bitte schlagen Sie über das Auftragsportal einen neuen Termin vor.\n\n` +
        `Mit freundlichen Grüßen\n${branding.legalName}`,
      undefined,
      branding
    );
  }
  revalidatePath(`/vorgaenge/${ticketId}`);
  redirect(`/vorgaenge/${ticketId}?termin=abgelehnt`);
}

// ---------------------------------------------------------------------------
// Abschluss-Workflow
//
// Der Handwerker MELDET die Erledigung – in der Praxis meist per Telefon,
// WhatsApp oder E-Mail, nicht zwingend über das Portal. Diese Meldung setzt den
// Vorgang auf ERLEDIGT (gemeldet, wartet auf Prüfung). Erst die ausdrückliche
// Bestätigung durch den Verwalter schließt den Vorgang (GESCHLOSSEN). Ist
// Nacharbeit nötig, öffnet der Verwalter den Vorgang wieder.
// ---------------------------------------------------------------------------

const COMPLETION_CHANNELS = ["Telefon", "WhatsApp", "E-Mail", "persönlich", "Portal"] as const;

// Verwalter dokumentiert die (z. B. telefonische) Erledigungsmeldung des Handwerkers.
export async function reportCompletion(formData: FormData) {
  const verwalter = await requireVerwalter();
  const ticketId = String(formData.get("ticketId") ?? "");
  const viaRaw = String(formData.get("via") ?? "Telefon");
  const via = (COMPLETION_CHANNELS as readonly string[]).includes(viaRaw) ? viaRaw : "Telefon";
  const note = String(formData.get("note") ?? "").trim().slice(0, 1000);

  const ticket = await requireTicketInScope(verwalter, ticketId);
  if (ticket.status === "GESCHLOSSEN") redirect(`/vorgaenge/${ticketId}`);

  await db.ticket.update({
    where: { id: ticketId },
    data: { status: "ERLEDIGT", completionReportedAt: new Date(), completionReportedVia: via },
  });
  await db.ticketComment.create({
    data: {
      ticketId,
      authorId: verwalter.id,
      internal: true,
      body: `Erledigung gemeldet (${via})${note ? `: ${note}` : ""}. Wartet auf Abschluss-Bestätigung.`,
    },
  });
  await notifyCreatorStatusChange(ticketId, verwalter);
  revalidatePath(`/vorgaenge/${ticketId}`);
  redirect(`/vorgaenge/${ticketId}?abschluss=gemeldet`);
}

// Verwalter bestätigt den Abschluss und schließt den Vorgang.
export async function confirmCompletion(formData: FormData) {
  const verwalter = await requireVerwalter();
  const ticketId = String(formData.get("ticketId") ?? "");
  await requireTicketInScope(verwalter, ticketId);

  await db.ticket.update({
    where: { id: ticketId },
    data: {
      status: "GESCHLOSSEN",
      closedAt: new Date(),
      closedById: verwalter.id,
    },
  });
  await db.ticketComment.create({
    data: {
      ticketId,
      authorId: verwalter.id,
      internal: true,
      body: "Abschluss bestätigt – Vorgang geschlossen.",
    },
  });
  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.TICKET_CLOSED,
    targetType: "Ticket",
    targetId: ticketId,
    ip: await getClientIp(),
  });
  await notifyCreatorStatusChange(ticketId, verwalter);
  // Mieter über den Abschluss informieren
  const closedTicket = await db.ticket.findUnique({
    where: { id: ticketId },
    select: { number: true, title: true },
  });
  if (closedTicket) {
    await notifyTenantStatusChange(
      ticketId,
      `Ihr Anliegen #${closedTicket.number} wurde abgeschlossen`,
      `Ihr Anliegen „${closedTicket.title}" wurde durch die Hausverwaltung abgeschlossen. ` +
        `Wir hoffen, dass alles zu Ihrer Zufriedenheit erledigt wurde.\n\n` +
        `Bei weiteren Fragen stehen wir Ihnen gerne zur Verfügung.`
    );
  }
  revalidatePath(`/vorgaenge/${ticketId}`);
  redirect(`/vorgaenge/${ticketId}?abschluss=bestaetigt`);
}

// Verwalter akzeptiert die vom Handwerker eingereichte Rechnung: übernimmt Betrag
// und Beleg-Verweis in die Kostenerfassung des Vorgangs.
export async function acceptInvoice(formData: FormData) {
  const verwalter = await requireVerwalter();
  const ticketId = String(formData.get("ticketId") ?? "");
  const ticket = await db.ticket.findUnique({ where: { id: ticketId }, include: { invoice: true } });
  if (!ticket || !(await canViewTicket(verwalter, ticket))) redirect("/vorgaenge");
  const invoice = ticket.invoice;
  if (!invoice || invoice.status !== "EINGEREICHT") redirect(`/vorgaenge/${ticketId}`);

  await db.$transaction([
    db.craftsmanInvoice.update({
      where: { id: invoice.id },
      data: { status: "AKZEPTIERT", reviewedAt: new Date(), reviewedById: verwalter.id },
    }),
    db.ticket.update({
      where: { id: ticketId },
      data: {
        costCents: invoice.amountCents,
        costNote: [invoice.invoiceNumber ? `Rechnung ${invoice.invoiceNumber}` : "Handwerker-Rechnung", invoice.note]
          .filter(Boolean)
          .join(" · ")
          .slice(0, 300),
        updatedAt: new Date(),
      },
    }),
    db.ticketComment.create({
      data: { ticketId, authorId: verwalter.id, internal: true, body: "Rechnung akzeptiert und als Kosten übernommen." },
    }),
  ]);
  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.HANDWERKER_INVOICE_ACCEPTED,
    targetType: "Ticket",
    targetId: ticketId,
    meta: { amountCents: invoice.amountCents },
    ip: await getClientIp(),
  });
  revalidatePath(`/vorgaenge/${ticketId}`);
  redirect(`/vorgaenge/${ticketId}?rechnung=akzeptiert`);
}

// Verwalter lehnt die Rechnung ab (mit Grund); der Handwerker kann eine neue
// Rechnung einreichen.
export async function rejectInvoice(formData: FormData) {
  const verwalter = await requireVerwalter();
  const ticketId = String(formData.get("ticketId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);
  const ticket = await db.ticket.findUnique({ where: { id: ticketId }, include: { invoice: { include: { craftsman: true } } } });
  if (!ticket || !(await canViewTicket(verwalter, ticket))) redirect("/vorgaenge");
  const invoice = ticket.invoice;
  if (!invoice || invoice.status !== "EINGEREICHT") redirect(`/vorgaenge/${ticketId}`);

  await db.$transaction([
    db.craftsmanInvoice.update({
      where: { id: invoice.id },
      data: { status: "ABGELEHNT", reviewedAt: new Date(), reviewedById: verwalter.id },
    }),
    db.ticketComment.create({
      data: {
        ticketId,
        authorId: verwalter.id,
        internal: true,
        body: `Rechnung abgelehnt${reason ? `: ${reason}` : ""}.`,
      },
    }),
  ]);
  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.HANDWERKER_INVOICE_REJECTED,
    targetType: "Ticket",
    targetId: ticketId,
    ip: await getClientIp(),
  });
  if (invoice.craftsman?.email) {
    const branding = await getBrandingForOrg(ticket.organizationId);
    await sendMail(
      invoice.craftsman.email,
      `Rechnung zu Auftrag #${ticket.number} abgelehnt`,
      `Guten Tag ${invoice.craftsman.name},\n\n` +
        `Ihre Rechnung zum Auftrag „${ticket.title}" wurde nicht akzeptiert${reason ? `:\n${reason}` : "."}\n\n` +
        `Bitte reichen Sie ggf. eine korrigierte Rechnung ein.\n\nMit freundlichen Grüßen\n${branding.legalName}`,
      undefined,
      branding,
    ).catch(() => {});
  }
  revalidatePath(`/vorgaenge/${ticketId}`);
  redirect(`/vorgaenge/${ticketId}?rechnung=abgelehnt`);
}

// Verwalter weist die Erledigung zurück / öffnet den Vorgang für Nacharbeit wieder.
export async function reopenTicket(formData: FormData) {
  const verwalter = await requireVerwalter();
  const ticketId = String(formData.get("ticketId") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 1000);
  const ticket = await db.ticket.findUnique({
    where: { id: ticketId },
    include: { craftsman: true },
  });
  if (!ticket || !(await canViewTicket(verwalter, ticket))) redirect("/vorgaenge");

  // Zurück in einen aktiven Status: war ein Handwerker beauftragt → BEAUFTRAGT,
  // sonst IN_BEARBEITUNG. Meldekennzeichen und Abschluss zurücksetzen.
  const nextStatus = ticket.craftsmanId ? "BEAUFTRAGT" : "IN_BEARBEITUNG";
  await db.ticket.update({
    where: { id: ticketId },
    data: {
      status: nextStatus,
      completionReportedAt: null,
      completionReportedVia: null,
      closedAt: null,
      closedById: null,
    },
  });
  await db.ticketComment.create({
    data: {
      ticketId,
      authorId: verwalter.id,
      internal: true,
      body: `Vorgang wieder geöffnet (Nacharbeit nötig)${note ? `: ${note}` : ""}.`,
    },
  });
  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.TICKET_REOPENED,
    targetType: "Ticket",
    targetId: ticketId,
    meta: note ? { note } : undefined,
    ip: await getClientIp(),
  });
  // Beauftragten Handwerker über die Nacharbeit informieren
  if (ticket.craftsman?.email) {
    const branding = await getBrandingForOrg(ticket.organizationId);
    await sendMail(
      ticket.craftsman.email,
      `Nacharbeit erforderlich – Auftrag #${ticket.number}`,
      `Guten Tag ${ticket.craftsman.name},\n\n` +
        `der Vorgang #${ticket.number} „${ticket.title}" wurde noch nicht abgenommen` +
        `${note ? `:\n\n${note}` : "."}\n\n` +
        `Bitte stimmen Sie sich mit der ${branding.legalName} ab.\n\n` +
        `Mit freundlichen Grüßen\n${branding.legalName}`,
      undefined,
      branding
    );
  }
  revalidatePath(`/vorgaenge/${ticketId}`);
  redirect(`/vorgaenge/${ticketId}?abschluss=geoeffnet`);
}

// Verwalter beauftragt den zugeordneten Handwerker per E-Mail mit den Vorgangsdaten
export async function notifyCraftsman(formData: FormData) {
  const verwalter = await requireVerwalter();
  const ticketId = String(formData.get("ticketId") ?? "");

  const ticket = await db.ticket.findUnique({
    where: { id: ticketId },
    include: { property: true, unit: true, craftsman: true },
  });
  if (!ticket || !(await canViewTicket(verwalter, ticket))) redirect("/vorgaenge");
  if (!ticket.craftsman) redirect(`/vorgaenge/${ticketId}`);
  if (!ticket.craftsman.email) {
    redirect(`/vorgaenge/${ticketId}?fehler=keine_email`);
  }
  // Harte Sperre: EXTERNE Handwerker dürfen erst nach bewusster Verwalter-Freigabe
  // beauftragt werden (interne Eigenleistung wird zuerst geprüft). Niemals automatisch.
  if (!ticket.craftsman.isInternal && !ticket.externalReleasedAt) {
    redirect(`/vorgaenge/${ticketId}?fehler=freigabe`);
  }

  const ortsangabe = [
    ticket.property
      ? `Objekt: ${ticket.property.name}, ${ticket.property.street}, ${ticket.property.zip} ${ticket.property.city}`
      : null,
    ticket.unit ? `Einheit: ${ticket.unit.label}` : null,
    ticket.location ? `Ort im Objekt: ${ticket.location}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const anrede = ticket.craftsman.company
    ? `${ticket.craftsman.company} / ${ticket.craftsman.name}`
    : ticket.craftsman.name;

  // Magic-Link-Token sicherstellen (ggf. neu erzeugen)
  let token = ticket.craftsman.accessToken;
  if (!token) {
    token = crypto.randomBytes(24).toString("hex");
  }
  const missingToken = !ticket.craftsman.accessToken;

  // DB-Schreibvorgänge atomisch: Token setzen + Kommentar + Statuswechsel
  await db.$transaction(async (tx) => {
    if (missingToken) {
      await tx.craftsman.update({
        where: { id: ticket.craftsman!.id },
        data: { accessToken: token },
      });
    }
    await tx.ticketComment.create({
      data: {
        ticketId,
        authorId: verwalter.id,
        body: `Handwerker „${anrede}" per E-Mail beauftragt (${ticket.craftsman!.email}).`,
        internal: true,
      },
    });
    if (ticket.status !== "ERLEDIGT" && ticket.status !== "GESCHLOSSEN") {
      await tx.ticket.update({ where: { id: ticketId }, data: { status: "BEAUFTRAGT" } });
    }
  });

  // E-Mail nach erfolgreichem Commit – externe Side-Effects nie im Transaction-Block
  const branding = await getBrandingForOrg(ticket.organizationId);
  await sendMail(
    ticket.craftsman.email,
    `Auftrag #${ticket.number}: ${ticket.title}`,
    `Guten Tag ${ticket.craftsman.name},\n\n` +
      `die ${branding.legalName} möchte Sie mit folgendem Vorgang beauftragen:\n\n` +
      `Vorgang #${ticket.number} – ${ticket.title}\n` +
      `Priorität: ${ticketPriorityLabels[ticket.priority]}\n\n` +
      `Beschreibung:\n${ticket.description}\n\n` +
      `${ortsangabe}\n\n` +
      `Auftrag annehmen, Termin vorschlagen oder Rückfragen stellen:\n` +
      `${portalUrl(`/auftraege/${token}`)}\n\n` +
      `Mit freundlichen Grüßen\n${branding.legalName}` +
      (branding.email ? `\n${branding.email}` : ""),
    undefined,
    branding
  );

  // Mieter über die Beauftragung informieren
  await notifyTenantStatusChange(
    ticketId,
    `Update zu Ihrem Anliegen #${ticket.number}`,
    `Bezüglich Ihres Anliegens „${ticket.title}" haben wir einen Handwerker beauftragt, ` +
      `der sich darum kümmern wird. Wir melden uns zur Terminabstimmung.`
  );

  revalidatePath(`/vorgaenge/${ticketId}`);
  redirect(`/vorgaenge/${ticketId}?beauftragt=1`);
}

// Verwalter stellt aus einer Dokumentanforderung heraus direkt das Dokument bereit.
// Es wird ein Dokument für den Anfragenden erstellt und der Vorgang erledigt.
const DOC_CATEGORIES = ["ABRECHNUNG", "PROTOKOLL", "VERTRAG", "BESCHEINIGUNG", "SONSTIGES"] as const;

export async function uploadRequestedDocument(formData: FormData) {
  const verwalter = await requireVerwalter();
  const ticketId = String(formData.get("ticketId") ?? "");
  const title = String(formData.get("title") ?? "").trim().slice(0, 200);
  const catRaw = String(formData.get("category") ?? "BESCHEINIGUNG");
  const category = (DOC_CATEGORIES as readonly string[]).includes(catRaw)
    ? (catRaw as (typeof DOC_CATEGORIES)[number])
    : "BESCHEINIGUNG";

  const ticket = await db.ticket.findUnique({
    where: { id: ticketId },
    include: { createdBy: true },
  });
  if (!ticket || !(await canViewTicket(verwalter, ticket))) redirect("/vorgaenge");
  if (!title) redirect(`/vorgaenge/${ticketId}?fehler=titel`);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/vorgaenge/${ticketId}?fehler=datei`);
  }
  let upload;
  try {
    upload = await saveUpload(file, DOCUMENT_TYPES);
  } catch {
    redirect(`/vorgaenge/${ticketId}?fehler=datei`);
  }

  // Sichtbarkeit am Anfragenden ausrichten
  const audience =
    ticket.createdBy.role === "EIGENTUEMER"
      ? "EIGENTUEMER"
      : ticket.createdBy.role === "MIETER"
        ? "MIETER"
        : "ALLE";

  await db.$transaction([
    db.document.create({
      data: {
        title,
        category,
        audience,
        propertyId: ticket.propertyId,
        unitId: ticket.unitId,
        uploadedById: verwalter.id,
        organizationId: ticket.organizationId,
        ...upload,
      },
    }),
    db.ticketComment.create({
      data: {
        ticketId,
        authorId: verwalter.id,
        body: `Dokument bereitgestellt: „${title}". Sie finden es unter „Infos → Dokumente".`,
      },
    }),
    db.ticket.update({ where: { id: ticketId }, data: { status: "ERLEDIGT" } }),
  ]);
  await notifyCreatorNewComment(ticketId, verwalter);

  revalidatePath(`/vorgaenge/${ticketId}`);
  revalidatePath("/infos");
  redirect(`/vorgaenge/${ticketId}?bereitgestellt=1`);
}

// Bescheinigung automatisch aus den Stammdaten erstellen und bereitstellen
export async function generateCertificate(formData: FormData) {
  const ticketId = String(formData.get("ticketId") ?? "");
  // Äußeres try/catch: konkrete Fehlermeldung statt generischer Fehlerseite.
  try {
  const verwalter = await requireVerwalter();
  const ticket = await db.ticket.findUnique({
    where: { id: ticketId },
    include: { createdBy: true, unit: true, property: true },
  });
  if (!ticket || !(await canViewTicket(verwalter, ticket))) redirect("/vorgaenge");
  const kind = supportedCertificate(ticket.title);
  if (!kind || !ticket.property) {
    redirect(`/vorgaenge/${ticketId}?fehler=cert`);
  }
  const property = ticket.property;
  const unit = ticket.unit;

  // Aktive Mieter der Einheit (sonst der Anfragende)
  const tenancies = unit
    ? await db.tenancy.findMany({
        where: { unitId: unit.id, active: true },
        include: { user: true },
      })
    : [];
  const mieterNamen =
    tenancies.length > 0 ? tenancies.map((t) => t.user.name) : [ticket.createdBy.name];
  const mietbeginn = tenancies[0]?.startDate ?? null;

  // Eigentümer als Wohnungsgeber
  const ownership = await db.ownership.findFirst({
    where: { propertyId: property.id },
    include: { user: true },
  });
  const owner = ownership?.user ?? null;

  // Branding der ausstellenden Hausverwaltung (Briefkopf + Fallback-Wohnungsgeber).
  const branding = await getBrandingForOrg(ticket.organizationId);
  const brandingPlzOrt = [branding.zip, branding.city].filter(Boolean).join(" ");

  const unitPublic = unit ? unitPublicLabel(unit) : "";
  const wohnungAnschrift = `${property.street}, ${unitPublic ? unitPublic + ", " : ""}${property.zip} ${property.city}`;
  const wohnungsgeberName = owner?.name ?? branding.legalName;
  const wohnungsgeberStrasse = owner?.street ?? branding.street ?? "";
  const wohnungsgeberPlzOrt =
    owner?.zip && owner?.city ? `${owner.zip} ${owner.city}` : brandingPlzOrt;
  const wohnungStrasse = property.street;
  const wohnungPlzOrt = `${property.zip} ${property.city}`;
  const wohnungZusatz = unitPublic;
  const unterzeichner = owner?.name ?? branding.legalName;
  const ausstellungsOrt = branding.city ?? "";
  const issuer = {
    legalName: branding.legalName,
    contactLine: [branding.addressLine, branding.email].filter(Boolean).join(" · "),
  };

  // Unterschrift (Eigentümer bevorzugt, sonst Verwalter)
  const sigSource = owner?.signatureStoredName ?? verwalter.signatureStoredName ?? null;
  let signature: SignatureImage = null;
  if (sigSource) {
    try {
      const bytes = await readUpload(sigSource);
      let sigMime = "image/jpeg";
      if (sigSource.startsWith("data:")) {
        const m = sigSource.match(/^data:([^;,]+)/);
        if (m) sigMime = m[1];
      } else if (sigSource.toLowerCase().includes(".png")) {
        sigMime = "image/png";
      } else if (sigSource.toLowerCase().includes(".webp")) {
        sigMime = "image/webp";
      }
      signature = { bytes: new Uint8Array(bytes), mime: sigMime };
    } catch {
      /* fehlende/ungültige Unterschrift ignorieren */
    }
  }

  const ausstellungsdatum = new Date();
  let pdf: Buffer;
  let title: string;
  if (kind === "wohnungsgeber") {
    title = "Wohnungsgeberbescheinigung";
    pdf = await generateWohnungsgeberbescheinigung({
      wohnungsgeberName,
      wohnungsgeberStrasse,
      wohnungsgeberPlzOrt,
      wohnungStrasse,
      wohnungPlzOrt,
      wohnungZusatz,
      mieterNamen,
      einzugsdatum: mietbeginn,
      ausstellungsdatum,
      ort: ausstellungsOrt,
      unterzeichner,
      signature,
    });
  } else {
    title = "Mietbescheinigung";
    pdf = await generateMietbescheinigung({
      mieterNamen,
      wohnungAnschrift,
      mietbeginn,
      vermieterName: wohnungsgeberName,
      ort: ausstellungsOrt,
      ausstellungsdatum,
      unterzeichner,
      issuer,
      signature,
    });
  }

  const upload = await saveBuffer(pdf, `${title}.pdf`, "application/pdf", ["application/pdf"]);

  await db.$transaction([
    db.document.create({
      data: {
        title: `${title} – ${ticket.createdBy.name}`,
        category: "BESCHEINIGUNG",
        audience: "MIETER",
        propertyId: property.id,
        unitId: ticket.unitId,
        uploadedById: verwalter.id,
        organizationId: ticket.organizationId,
        ...upload,
      },
    }),
    db.ticketComment.create({
      data: {
        ticketId,
        authorId: verwalter.id,
        body: `${title} automatisch erstellt und bereitgestellt. Abrufbar unter „Infos → Dokumente".`,
      },
    }),
    db.ticket.update({ where: { id: ticketId }, data: { status: "ERLEDIGT" } }),
  ]);
  await notifyCreatorNewComment(ticketId, verwalter);

  revalidatePath(`/vorgaenge/${ticketId}`);
  revalidatePath("/infos");
  redirect(`/vorgaenge/${ticketId}?bereitgestellt=1`);
  } catch (e) {
    if (isNextControlFlowError(e)) throw e; // redirect()/notFound() durchlassen
    redirect(`/vorgaenge/${ticketId}?fehler=cert&msg=${encodeURIComponent(errorMessage(e))}`);
  }
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
    data: {
      status: status as "IN_BEARBEITUNG" | "ERLEDIGT",
      // Erledigung gilt als gemeldet (über das Portal), wartet auf Verwalter-Abnahme
      ...(status === "ERLEDIGT"
        ? { completionReportedAt: new Date(), completionReportedVia: "Portal" }
        : {}),
    },
  });
  await notifyCreatorStatusChange(ticketId, user);

  revalidatePath(`/vorgaenge/${ticketId}`);
  redirect(`/vorgaenge/${ticketId}`);
}

// Vorgang endgültig löschen (nur SuperAdmin). Für Test-/Fehleinträge. Der
// Regelweg ist „Schließen" (Status GESCHLOSSEN) – ein geschlossener Vorgang bleibt
// als Beleg erhalten. Löschen entfernt Kommentare, Anhänge und Rechnung per
// Kaskade; die zugehörigen Dateien im Storage werden aufgeräumt.
export async function deleteTicket(formData: FormData) {
  const verwalter = await requireVerwalter();
  if (!verwalter.isSuperAdmin) redirect("/vorgaenge");
  const ticketId = String(formData.get("ticketId") ?? "").trim();
  if (!ticketId) redirect("/vorgaenge");
  const ticket = await db.ticket.findUnique({
    where: { id: ticketId },
    select: {
      organizationId: true,
      propertyId: true,
      attachments: { select: { storedName: true } },
      invoice: { select: { storedName: true } },
    },
  });
  if (!ticket || ticket.organizationId !== verwalter.organizationId) redirect("/vorgaenge");
  if (!(await canVerwalterAccessProperty(verwalter, ticket.propertyId))) redirect("/vorgaenge");

  await db.ticket.delete({ where: { id: ticketId } });
  // Dateien nach erfolgreichem DB-Löschen entfernen (Anhänge + Handwerker-Rechnung).
  for (const a of ticket.attachments) await deleteBlob(a.storedName);
  if (ticket.invoice?.storedName) await deleteBlob(ticket.invoice.storedName);

  revalidatePath("/vorgaenge");
  redirect("/vorgaenge?geloescht=1");
}
