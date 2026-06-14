// Benachrichtigungen zu Vorgängen. Bewusst "fire and forget":
// Fehler werden geloggt, blockieren aber keine Nutzeraktion.
import type { Ticket, User } from "@/generated/prisma/client";
import { db } from "./db";
import { portalUrl, sendMail } from "./mailer";
import { ticketStatusLabels, ticketTypeLabels, tradeLabels } from "./labels";

export async function notifyVerwalterNewTicket(ticket: Ticket, createdBy: User) {
  const verwalter = await db.user.findMany({
    where: { role: "VERWALTER", active: true },
  });
  const link = portalUrl(`/vorgaenge/${ticket.id}`);
  await Promise.all(
    verwalter.map((v) =>
      sendMail(
        v.email,
        `Neuer Vorgang #${ticket.number}: ${ticket.title}`,
        `${createdBy.name} hat einen neuen Vorgang gemeldet.\n\n` +
          `Art: ${ticketTypeLabels[ticket.type]}\n` +
          (ticket.trade
            ? `Kategorie: ${tradeLabels[ticket.trade]}\n`
            : ticket.category
              ? `Kategorie: ${ticket.category}\n`
              : "") +
          `Betreff: ${ticket.title}\n\n` +
          `Zum Vorgang: ${link}`
      )
    )
  );
}

export async function notifyCreatorStatusChange(ticketId: string, actor: User) {
  const ticket = await db.ticket.findUnique({
    where: { id: ticketId },
    include: { createdBy: true },
  });
  if (!ticket || ticket.createdById === actor.id || !ticket.createdBy.active) return;
  await sendMail(
    ticket.createdBy.email,
    `Vorgang #${ticket.number}: Status jetzt „${ticketStatusLabels[ticket.status]}“`,
    `Der Status Ihres Vorgangs „${ticket.title}“ wurde auf ` +
      `„${ticketStatusLabels[ticket.status]}“ geändert.\n\n` +
      `Zum Vorgang: ${portalUrl(`/vorgaenge/${ticket.id}`)}`
  );
}

export async function notifyCreatorNewComment(ticketId: string, actor: User) {
  const ticket = await db.ticket.findUnique({
    where: { id: ticketId },
    include: { createdBy: true },
  });
  if (!ticket || ticket.createdById === actor.id || !ticket.createdBy.active) return;
  await sendMail(
    ticket.createdBy.email,
    `Neue Antwort zu Vorgang #${ticket.number}`,
    `${actor.name} hat auf Ihren Vorgang „${ticket.title}“ geantwortet.\n\n` +
      `Zum Vorgang: ${portalUrl(`/vorgaenge/${ticket.id}`)}`
  );
}

export async function notifyAssignee(ticketId: string, assignee: User) {
  const ticket = await db.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket || !assignee.active) return;
  await sendMail(
    assignee.email,
    `Ihnen wurde Vorgang #${ticket.number} zugewiesen`,
    `Vorgang „${ticket.title}“ wurde Ihnen zugewiesen.\n\n` +
      `Zum Vorgang: ${portalUrl(`/vorgaenge/${ticket.id}`)}`
  );
}

export async function notifyWelcome(user: User) {
  await sendMail(
    user.email,
    "Ihr Zugang zum B&W Kundenportal",
    `Guten Tag ${user.name},\n\n` +
      `für Sie wurde ein Zugang zum Kundenportal der B&W Immobilien Management UG angelegt.\n` +
      `Anmeldung: ${portalUrl("/login")}\n` +
      `Benutzername: ${user.email}\n\n` +
      `Ihr Start-Passwort erhalten Sie persönlich von Ihrer Verwaltung. ` +
      `Bitte ändern Sie es nach der ersten Anmeldung unter „Konto“.\n\n` +
      `Mit freundlichen Grüßen\nB&W Immobilien Management UG`
  );
}
