"use server";

import { redirect } from "next/navigation";
import type { Craftsman, Ticket } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { portalUrl, sendMail } from "@/lib/mailer";
import { sendPushToUsers } from "@/lib/push";
import { MEDIA_TYPES, saveUpload } from "@/lib/storage";

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
  const verwalter = await db.user.findMany({
    where: { role: "VERWALTER", active: true },
    select: { id: true, email: true },
  });
  const link = portalUrl(`/vorgaenge/${ticket.id}`);
  await Promise.all(
    verwalter.map((v) =>
      sendMail(v.email, `Vorgang #${ticket.number}: Update vom Handwerker`, `${text}\n\nZum Vorgang: ${link}`)
    )
  );
  await sendPushToUsers(
    verwalter.map((v) => v.id),
    { title: `Vorgang #${ticket.number}: Update vom Handwerker`, body: text, url: `/vorgaenge/${ticket.id}` }
  );
}

async function addCraftsmanComment(ticketId: string, craftsmanId: string, body: string) {
  await db.ticketComment.create({
    data: { ticketId, craftsmanAuthorId: craftsmanId, body },
  });
  await db.ticket.update({ where: { id: ticketId }, data: { updatedAt: new Date() } });
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

  await addCraftsmanComment(ticketId, auth.craftsman.id, "Auftrag abgelehnt.");
  // Zuordnung lösen und Vorgang zurück in die Verwalter-Warteschlange
  await db.ticket.update({
    where: { id: ticketId },
    data: { craftsmanId: null, status: "NEU" },
  });
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

  // Neuer Vorschlag → Bestätigung zurücksetzen; wird erst wirksam, wenn der
  // Verwalter ihn bestätigt.
  await db.ticket.update({
    where: { id: ticketId },
    data: { appointmentNote: note, appointmentConfirmedAt: null, appointmentConfirmedById: null },
  });
  await addCraftsmanComment(ticketId, auth.craftsman.id, `Terminvorschlag: ${note}`);
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

  await db.ticketComment.create({
    data: {
      ticketId,
      craftsmanAuthorId: auth.craftsman.id,
      body: body || "(Foto/Dokument)",
      ...(uploads.length > 0
        ? { attachments: { create: uploads.map((u) => ({ ...u, ticketId })) } }
        : {}),
    },
  });
  await db.ticket.update({ where: { id: ticketId }, data: { updatedAt: new Date() } });
  await notifyVerwalter(
    auth.ticket,
    `${auth.craftsman.name} hat eine Nachricht/Foto zum Auftrag „${auth.ticket.title}" hinterlassen.`
  );
  redirect(`/auftraege/${token}`);
}

export async function craftsmanDone(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const ticketId = String(formData.get("ticketId") ?? "");
  const auth = await authorize(token, ticketId);
  if (!auth) redirect(`/auftraege/${token}`);

  // Erledigung wird GEMELDET – die Abnahme/Schließung erfolgt durch den Verwalter.
  await db.ticket.update({
    where: { id: ticketId },
    data: { status: "ERLEDIGT", completionReportedAt: new Date(), completionReportedVia: "Portal" },
  });
  await addCraftsmanComment(ticketId, auth.craftsman.id, "Auftrag als erledigt gemeldet.");
  await notifyVerwalter(
    auth.ticket,
    `${auth.craftsman.name} hat den Auftrag „${auth.ticket.title}" als ERLEDIGT gemeldet. Bitte Abschluss bestätigen.`
  );
  redirect(`/auftraege/${token}`);
}
