"use server";

import { redirect } from "next/navigation";
import type { Craftsman, Ticket } from "@/generated/prisma/client";
import { AUDIT, logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getBrandingForOrg } from "@/lib/branding-server";
import { portalUrl, sendMail } from "@/lib/mailer";
import { parseEuroToCents } from "@/lib/money";
import { sendPushToUsers } from "@/lib/push";
import { DOCUMENT_TYPES, MEDIA_TYPES, saveUpload } from "@/lib/storage";

// Token + Ticket prüfen: der Handwerker darf nur seine eigenen Aufträge bearbeiten
async function authorize(
  token: string,
  ticketId: string
): Promise<{ craftsman: Craftsman; ticket: Ticket } | null> {
  if (!token || !ticketId) return null;
  const craftsman = await db.craftsman.findUnique({ where: { accessToken: token } });
  if (!craftsman || !craftsman.active) return null;
  const ticket = await db.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket || ticket.craftsmanId !== craftsman.id) return null;
  return { craftsman, ticket };
}

async function notifyVerwalter(ticket: Ticket, text: string) {
  // Nur Verwalter der Org des Vorgangs benachrichtigen.
  const verwalter = await db.user.findMany({
    where: { role: "VERWALTER", active: true, organizationId: ticket.organizationId },
    select: { id: true, email: true },
  });
  const branding = await getBrandingForOrg(ticket.organizationId);
  const link = portalUrl(`/vorgaenge/${ticket.id}`);
  await Promise.all(
    verwalter.map((v) =>
      sendMail(
        v.email,
        `Vorgang #${ticket.number}: Update vom Handwerker`,
        `${text}\n\nZum Vorgang: ${link}`,
        undefined,
        branding
      )
    )
  );
  await sendPushToUsers(
    verwalter.map((v) => v.id),
    { title: `Vorgang #${ticket.number}: Update vom Handwerker`, body: text, url: `/vorgaenge/${ticket.id}` }
  );
}

async function addCraftsmanComment(ticketId: string, craftsmanId: string, body: string) {
  await db.$transaction([
    db.ticketComment.create({ data: { ticketId, craftsmanAuthorId: craftsmanId, body } }),
    db.ticket.update({ where: { id: ticketId }, data: { updatedAt: new Date() } }),
  ]);
}

export async function craftsmanAccept(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const ticketId = String(formData.get("ticketId") ?? "");
  const auth = await authorize(token, ticketId);
  if (!auth) redirect(`/auftraege/${token}`);

  await addCraftsmanComment(ticketId, auth.craftsman.id, "Auftrag angenommen.");
  await notifyVerwalter(
    auth.ticket,
    `${auth.craftsman.name} hat den Auftrag „${auth.ticket.title}" angenommen.`
  );
  redirect(`/auftraege/${token}`);
}

export async function craftsmanDecline(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const ticketId = String(formData.get("ticketId") ?? "");
  const auth = await authorize(token, ticketId);
  if (!auth) redirect(`/auftraege/${token}`);

  // Kommentar + Zuordnung lösen + Status atomisch zurücksetzen
  await db.$transaction([
    db.ticketComment.create({ data: { ticketId, craftsmanAuthorId: auth.craftsman.id, body: "Auftrag abgelehnt." } }),
    db.ticket.update({ where: { id: ticketId }, data: { craftsmanId: null, status: "NEU", updatedAt: new Date() } }),
  ]);
  await notifyVerwalter(
    auth.ticket,
    `${auth.craftsman.name} hat den Auftrag „${auth.ticket.title}" ABGELEHNT. Bitte neu zuordnen.`
  );
  redirect(`/auftraege/${token}`);
}

export async function craftsmanAppointment(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const ticketId = String(formData.get("ticketId") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 300);
  const auth = await authorize(token, ticketId);
  if (!auth) redirect(`/auftraege/${token}`);
  if (!note) redirect(`/auftraege/${token}`);

  // Terminvorschlag + Kommentar atomisch – Bestätigung erst nach Verwalter-Freigabe wirksam
  await db.$transaction([
    db.ticket.update({
      where: { id: ticketId },
      data: { appointmentNote: note, appointmentConfirmedAt: null, appointmentConfirmedById: null, updatedAt: new Date() },
    }),
    db.ticketComment.create({ data: { ticketId, craftsmanAuthorId: auth.craftsman.id, body: `Terminvorschlag: ${note}` } }),
  ]);
  await notifyVerwalter(
    auth.ticket,
    `${auth.craftsman.name} schlägt einen Termin vor: ${note} (bitte bestätigen)`
  );
  redirect(`/auftraege/${token}`);
}

export async function craftsmanComment(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const ticketId = String(formData.get("ticketId") ?? "");
  const body = String(formData.get("body") ?? "").trim().slice(0, 5000);
  const auth = await authorize(token, ticketId);
  if (!auth) redirect(`/auftraege/${token}`);

  const files = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0)
    .slice(0, 10);
  const uploads = [];
  for (const file of files) {
    try {
      uploads.push(await saveUpload(file, MEDIA_TYPES));
    } catch {
      redirect(`/auftraege/${token}`);
    }
  }

  if (!body && uploads.length === 0) redirect(`/auftraege/${token}`);

  await db.$transaction([
    db.ticketComment.create({
      data: {
        ticketId,
        craftsmanAuthorId: auth.craftsman.id,
        body: body || "(Foto/Dokument)",
        ...(uploads.length > 0
          ? { attachments: { create: uploads.map((u) => ({ ...u, ticketId })) } }
          : {}),
      },
    }),
    db.ticket.update({ where: { id: ticketId }, data: { updatedAt: new Date() } }),
  ]);
  await notifyVerwalter(
    auth.ticket,
    `${auth.craftsman.name} hat eine Nachricht/Foto zum Auftrag „${auth.ticket.title}" hinterlassen.`
  );
  redirect(`/auftraege/${token}`);
}

// Digitale Rechnung einreichen (Abschluss des Auftrags-Relays). Betrag + Datei
// (PDF/Bild). Eine Rechnung je Vorgang — eine erneute Einreichung ersetzt die
// vorherige und setzt den Status zurück auf EINGEREICHT.
export async function craftsmanSubmitInvoice(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const ticketId = String(formData.get("ticketId") ?? "");
  const auth = await authorize(token, ticketId);
  if (!auth) redirect(`/auftraege/${token}`);

  const amountCents = parseEuroToCents(String(formData.get("amount") ?? ""));
  if (amountCents === null || amountCents <= 0) redirect(`/auftraege/${token}?fehler=betrag`);
  const invoiceNumber = String(formData.get("invoiceNumber") ?? "").trim().slice(0, 60) || null;
  const dateRaw = String(formData.get("invoiceDate") ?? "").trim();
  const invoiceDate = dateRaw ? new Date(dateRaw) : null;
  const note = String(formData.get("note") ?? "").trim().slice(0, 500) || null;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) redirect(`/auftraege/${token}?fehler=datei`);
  let upload;
  try {
    upload = await saveUpload(file, DOCUMENT_TYPES);
  } catch {
    redirect(`/auftraege/${token}?fehler=datei`);
  }

  await db.craftsmanInvoice.upsert({
    where: { ticketId },
    create: {
      organizationId: auth.ticket.organizationId,
      ticketId,
      craftsmanId: auth.craftsman.id,
      amountCents,
      invoiceNumber,
      invoiceDate: invoiceDate && !Number.isNaN(invoiceDate.getTime()) ? invoiceDate : null,
      note,
      ...upload,
    },
    update: {
      amountCents,
      invoiceNumber,
      invoiceDate: invoiceDate && !Number.isNaN(invoiceDate.getTime()) ? invoiceDate : null,
      note,
      status: "EINGEREICHT",
      reviewedAt: null,
      reviewedById: null,
      ...upload,
    },
  });
  await addCraftsmanComment(ticketId, auth.craftsman.id, `Rechnung eingereicht: ${(amountCents / 100).toFixed(2).replace(".", ",")} €`);
  await logAudit({
    action: AUDIT.HANDWERKER_INVOICE_SUBMITTED,
    targetType: "Ticket",
    targetId: ticketId,
    meta: { craftsmanId: auth.craftsman.id, amountCents },
  });
  await notifyVerwalter(
    auth.ticket,
    `${auth.craftsman.name} hat eine Rechnung zum Auftrag „${auth.ticket.title}" eingereicht (${(amountCents / 100).toFixed(2).replace(".", ",")} €). Bitte prüfen.`,
  );
  redirect(`/auftraege/${token}?rechnung=1`);
}

export async function craftsmanDone(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const ticketId = String(formData.get("ticketId") ?? "");
  const auth = await authorize(token, ticketId);
  if (!auth) redirect(`/auftraege/${token}`);

  // Status-Update + Kommentar atomisch – Abnahme/Schließung durch den Verwalter
  await db.$transaction([
    db.ticket.update({
      where: { id: ticketId },
      data: { status: "ERLEDIGT", completionReportedAt: new Date(), completionReportedVia: "Portal", updatedAt: new Date() },
    }),
    db.ticketComment.create({ data: { ticketId, craftsmanAuthorId: auth.craftsman.id, body: "Auftrag als erledigt gemeldet." } }),
  ]);
  await notifyVerwalter(
    auth.ticket,
    `${auth.craftsman.name} hat den Auftrag „${auth.ticket.title}" als ERLEDIGT gemeldet. Bitte Abschluss bestätigen.`
  );
  redirect(`/auftraege/${token}`);
}
