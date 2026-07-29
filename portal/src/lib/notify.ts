// Benachrichtigungen zu Vorgängen. Bewusst "fire and forget":
// Fehler werden geloggt, blockieren aber keine Nutzeraktion.
import type { Ticket, User } from "@/generated/prisma/client";
import { db } from "./db";
import { getBrandingForOrg } from "./branding-server";
import { portalUrl, sendMail } from "./mailer";
import { datenblock, mailText } from "./mail-text";
import { sendPush, sendPushToUsers } from "./push";
import { ticketStatusLabels, ticketTypeLabels, tradeLabels } from "./labels";

// Sendet eine verständliche Statusmail an den/die Mieter der betreffenden
// Einheit – übersetzt technische Statusbezeichnungen in Alltagssprache.
// Schickt nur an Mieter mit E-Mail-Adresse; überspringt den Ticket-Ersteller
// (der bekommt die Benachrichtigung ohnehin über notifyCreatorStatusChange).
export async function notifyTenantStatusChange(
  ticketId: string,
  subject: string,
  body: string
): Promise<void> {
  try {
    const ticket = await db.ticket.findUnique({
      where: { id: ticketId },
      select: { unitId: true, createdById: true, number: true, organizationId: true },
    });
    if (!ticket?.unitId) return;
    const branding = await getBrandingForOrg(ticket.organizationId);

    const tenancies = await db.tenancy.findMany({
      where: { unitId: ticket.unitId, active: true },
      select: { user: { select: { id: true, email: true, name: true } } },
    });

    await Promise.all(
      tenancies
        .map((t) => t.user)
        .filter((u) => u.email && u.id !== ticket.createdById)
        .map((u) =>
          sendMail(
            u.email!,
            subject,
            mailText({ anrede: u.name, absaetze: [body], branding }),
            undefined,
            branding
          ).catch(() => {})
        )
    );
  } catch {
    // Fehler dürfen die Hauptaktion nicht unterbrechen
  }
}

export async function notifyVerwalterNewTicket(ticket: Ticket, createdBy: User) {
  // Nur Verwalter der EIGENEN Org benachrichtigen (keine Cross-Org-Mails).
  const verwalter = await db.user.findMany({
    where: { role: "VERWALTER", active: true, organizationId: ticket.organizationId },
  });
  const branding = await getBrandingForOrg(ticket.organizationId);
  const link = portalUrl(`/vorgaenge/${ticket.id}`);
  await Promise.all(
    verwalter.map((v) =>
      sendMail(
        v.email,
        `Neuer Vorgang #${ticket.number}: ${ticket.title}`,
        mailText({
          anrede: v.name,
          absaetze: [
            `${createdBy.name} hat einen neuen Vorgang gemeldet.`,
            datenblock([
              ["Art", ticketTypeLabels[ticket.type]],
              ["Kategorie", ticket.trade ? tradeLabels[ticket.trade] : ticket.category],
              ["Betreff", ticket.title],
            ]),
          ],
          aktion: { label: "Vorgang öffnen", url: link },
          branding,
        }),
        undefined,
        branding
      )
    )
  );
  await sendPushToUsers(
    verwalter.map((v) => v.id),
    {
      title: `Neuer Vorgang #${ticket.number}`,
      body: `${createdBy.name}: ${ticket.title}`,
      url: `/vorgaenge/${ticket.id}`,
    }
  );
}

export async function notifyCreatorStatusChange(ticketId: string, actor: User) {
  const ticket = await db.ticket.findUnique({
    where: { id: ticketId },
    include: { createdBy: true },
  });
  if (!ticket || ticket.createdById === actor.id || !ticket.createdBy.active) return;
  const statusBranding = await getBrandingForOrg(ticket.organizationId);
  await sendMail(
    ticket.createdBy.email,
    `Vorgang #${ticket.number}: Status jetzt „${ticketStatusLabels[ticket.status]}“`,
    mailText({
      anrede: ticket.createdBy.name,
      absaetze: [
        `der Status Ihres Vorgangs „${ticket.title}“ wurde auf ` +
          `„${ticketStatusLabels[ticket.status]}“ geändert.`,
      ],
      aktion: { label: "Vorgang öffnen", url: portalUrl(`/vorgaenge/${ticket.id}`) },
      branding: statusBranding,
    }),
    undefined,
    statusBranding
  );
  await sendPush(ticket.createdById, {
    title: `Vorgang #${ticket.number}: ${ticketStatusLabels[ticket.status]}`,
    body: ticket.title,
    url: `/vorgaenge/${ticket.id}`,
  });
}

export async function notifyCreatorNewComment(ticketId: string, actor: User) {
  const ticket = await db.ticket.findUnique({
    where: { id: ticketId },
    include: { createdBy: true },
  });
  if (!ticket || ticket.createdById === actor.id || !ticket.createdBy.active) return;
  const kommentarBranding = await getBrandingForOrg(ticket.organizationId);
  await sendMail(
    ticket.createdBy.email,
    `Neue Antwort zu Vorgang #${ticket.number}`,
    mailText({
      anrede: ticket.createdBy.name,
      absaetze: [`${actor.name} hat auf Ihren Vorgang „${ticket.title}“ geantwortet.`],
      aktion: { label: "Antwort lesen", url: portalUrl(`/vorgaenge/${ticket.id}`) },
      branding: kommentarBranding,
    }),
    undefined,
    kommentarBranding
  );
  await sendPush(ticket.createdById, {
    title: `Neue Antwort zu Vorgang #${ticket.number}`,
    body: `${actor.name}: ${ticket.title}`,
    url: `/vorgaenge/${ticket.id}`,
  });
}

export async function notifyAssignee(ticketId: string, assignee: User) {
  const ticket = await db.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket || !assignee.active) return;
  const zuweisungBranding = await getBrandingForOrg(ticket.organizationId);
  await sendMail(
    assignee.email,
    `Ihnen wurde Vorgang #${ticket.number} zugewiesen`,
    mailText({
      anrede: assignee.name,
      absaetze: [`der Vorgang „${ticket.title}“ wurde Ihnen zugewiesen.`],
      aktion: { label: "Vorgang öffnen", url: portalUrl(`/vorgaenge/${ticket.id}`) },
      branding: zuweisungBranding,
    }),
    undefined,
    zuweisungBranding
  );
  await sendPush(assignee.id, {
    title: `Vorgang #${ticket.number} zugewiesen`,
    body: ticket.title,
    url: `/vorgaenge/${ticket.id}`,
  });
}

// Benachrichtigt Mieter/Eigentümer über ein neu bereitgestelltes Dokument.
// Wichtig: NUR im Objekt-/Einheiten-Scope. Bei objektlosen ("globalen") Dokumenten
// wird bewusst NICHT benachrichtigt, um Benachrichtigungs-Spam zu vermeiden.
export async function notifyDocumentPublished(documentId: string): Promise<void> {
  try {
    const doc = await db.document.findUnique({ where: { id: documentId } });
    if (!doc) return;

    type Recipient = { id: string; email: string | null; name: string; active: boolean };
    const recipients = new Map<string, Recipient>();

    // Gezielte Freigabe: sind Empfänger gesetzt, NUR diese benachrichtigen –
    // unabhängig von audience/Objekt (auch bei objektlosen Dokumenten).
    const explicit = await db.documentRecipient.findMany({
      where: { documentId },
      select: { user: { select: { id: true, email: true, name: true, active: true } } },
    });

    if (explicit.length > 0) {
      for (const r of explicit) recipients.set(r.user.id, r.user);
    } else {
      // Ohne Objekt-/Einheiten-Bezug keine Massenmail an alle Nutzer
      if (!doc.propertyId && !doc.unitId) return;

      const wantMieter = doc.audience === "MIETER" || doc.audience === "ALLE";
      const wantEigentuemer = doc.audience === "EIGENTUEMER" || doc.audience === "ALLE";

      if (wantMieter) {
        const tenancies = await db.tenancy.findMany({
          where: {
            active: true,
            ...(doc.unitId
              ? { unitId: doc.unitId }
              : { unit: { propertyId: doc.propertyId! } }),
          },
          select: { user: { select: { id: true, email: true, name: true, active: true } } },
        });
        for (const t of tenancies) recipients.set(t.user.id, t.user);
      }

      if (wantEigentuemer && doc.propertyId) {
        const ownerships = await db.ownership.findMany({
          where: { propertyId: doc.propertyId },
          select: { user: { select: { id: true, email: true, name: true, active: true } } },
        });
        for (const o of ownerships) recipients.set(o.user.id, o.user);
      }
    }

    // Hochladenden Verwalter ausschließen, Inaktive überspringen
    const targets = [...recipients.values()].filter(
      (u) => u.active && u.id !== doc.uploadedById
    );
    if (targets.length === 0) return;

    const branding = await getBrandingForOrg(doc.organizationId);
    const link = portalUrl("/dokumente");
    await Promise.all(
      targets
        .filter((u) => u.email)
        .map((u) =>
          sendMail(
            u.email!,
            `Neues Dokument verfügbar: ${doc.title}`,
            mailText({
              anrede: u.name,
              absaetze: [
                `Ihre Hausverwaltung hat ein neues Dokument für Sie bereitgestellt:`,
                `„${doc.title}"`,
              ],
              aktion: { label: "Dokument ansehen", url: link },
              branding,
            }),
            undefined,
            branding
          ).catch(() => {})
        )
    );
    await sendPushToUsers(
      targets.map((u) => u.id),
      { title: "Neues Dokument verfügbar", body: doc.title, url: "/dokumente" }
    );
  } catch {
    // Benachrichtigung darf den Upload nie blockieren
  }
}

export async function notifyWelcome(user: User) {
  const branding = await getBrandingForOrg(user.organizationId);
  await sendMail(
    user.email,
    "Ihr Zugang zum Kundenportal",
    mailText({
      anrede: user.name,
      absaetze: [
        `für Sie wurde ein Zugang zum Kundenportal der ${branding.legalName} angelegt.`,
        datenblock([["Benutzername", user.email]]),
        `Ihr Start-Passwort erhalten Sie persönlich von Ihrer Verwaltung. ` +
          `Bitte ändern Sie es nach der ersten Anmeldung unter „Konto“.`,
      ],
      aktion: { label: "Jetzt anmelden", url: portalUrl("/login") },
      branding,
    }),
    undefined,
    branding
  );
}
