"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canVerwalterManageUser, userWhereForVerwalter } from "@/lib/access";
import { db } from "@/lib/db";
import { portalUrl, sendMail } from "@/lib/mailer";
import { sendPushToUsers } from "@/lib/push";
import { requireUser } from "@/lib/session";

export type RecipientResult = {
  id: string;
  name: string;
  role: "MIETER" | "EIGENTUEMER";
  propertyName: string | null;
};

const RECIPIENT_PAGE_SIZE = 25;

/**
 * Sucht Empfänger (Mieter/Eigentümer) für einen Verwalter **serverseitig** und
 * gedeckelt – statt alle (potenziell zehntausende) Empfänger ins Formular zu
 * laden. Ohne Suchbegriff werden die ersten Treffer im Scope geliefert.
 */
export async function searchRecipients(query: string): Promise<RecipientResult[]> {
  const user = await requireUser();
  if (user.role !== "VERWALTER") return [];
  const q = query.trim();

  const raw = await db.user.findMany({
    where: {
      AND: [
        { role: { in: ["MIETER", "EIGENTUEMER"] }, active: true },
        ...(q ? [{ name: { contains: q, mode: "insensitive" as const } }] : []),
        await userWhereForVerwalter(user),
      ],
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    take: RECIPIENT_PAGE_SIZE,
    include: {
      tenancies: {
        where: { active: true },
        include: { unit: { include: { property: { select: { name: true } } } } },
        take: 1,
      },
      ownerships: { include: { property: { select: { name: true } } }, take: 1 },
    },
  });

  return raw.map((r) => ({
    id: r.id,
    name: r.name,
    role: r.role as "MIETER" | "EIGENTUEMER",
    propertyName:
      r.tenancies[0]?.unit.property.name ?? r.ownerships[0]?.property.name ?? null,
  }));
}

async function notifyParticipants(
  conversationId: string,
  authorId: string,
  subject: string,
  preview: string
) {
  const parts = await db.conversationParticipant.findMany({
    where: { conversationId, userId: { not: authorId } },
    include: { user: true },
  });
  const link = portalUrl(`/nachrichten/${conversationId}`);
  await Promise.all(
    parts.map((p) =>
      sendMail(
        p.user.email,
        `Neue Nachricht: ${subject}`,
        `Sie haben eine neue Nachricht im B&W Kundenportal erhalten:\n\n` +
          `„${preview}"\n\n` +
          `Zur Nachricht: ${link}`
      )
    )
  );
  await sendPushToUsers(
    parts.map((p) => p.userId),
    { title: `Neue Nachricht: ${subject}`, body: preview, url: `/nachrichten/${conversationId}` }
  );
}

// Neue Konversation starten. Verwalter wählt einen Empfänger; Mieter/Eigentümer
// schreiben an die Verwaltung (alle aktiven Verwalter).
export async function startConversation(formData: FormData) {
  const user = await requireUser();
  const subject = String(formData.get("subject") ?? "").trim().slice(0, 200);
  const body = String(formData.get("body") ?? "").trim().slice(0, 5000);
  if (subject.length < 2 || body.length < 1) {
    redirect("/nachrichten?fehler=eingabe");
  }

  // Empfänger bestimmen
  const recipientIds = new Set<string>();
  if (user.role === "VERWALTER") {
    const recipientId = String(formData.get("recipientId") ?? "");
    const recipient = recipientId
      ? await db.user.findUnique({ where: { id: recipientId } })
      : null;
    if (!recipient || !recipient.active || recipient.role === "VERWALTER") {
      redirect("/nachrichten?fehler=empfaenger");
    }
    // Eingeschränkte Verwalter dürfen nur Empfänger im eigenen
    // Zuständigkeitsbereich anschreiben (SuperAdmin: immer erlaubt).
    if (!(await canVerwalterManageUser(user, recipient.id))) {
      redirect("/nachrichten?fehler=empfaenger");
    }
    recipientIds.add(recipient.id);
  } else {
    // Mieter/Eigentümer schreiben an die Verwaltung – nur Verwalter der EIGENEN Org.
    const verwalter = await db.user.findMany({
      where: { role: "VERWALTER", active: true, organizationId: user.organizationId },
      select: { id: true },
    });
    verwalter.forEach((v) => recipientIds.add(v.id));
  }
  recipientIds.delete(user.id);
  if (recipientIds.size === 0) {
    redirect("/nachrichten?fehler=empfaenger");
  }

  const conversation = await db.conversation.create({
    data: {
      subject,
      organizationId: user.organizationId,
      participants: {
        create: [
          { userId: user.id, lastReadAt: new Date() },
          ...[...recipientIds].map((id) => ({ userId: id })),
        ],
      },
      messages: { create: { authorId: user.id, body } },
    },
  });

  await notifyParticipants(conversation.id, user.id, subject, body);

  revalidatePath("/nachrichten");
  redirect(`/nachrichten/${conversation.id}`);
}

// Antwort in einer bestehenden Konversation senden
export async function sendMessage(formData: FormData) {
  const user = await requireUser();
  const conversationId = String(formData.get("conversationId") ?? "");
  const body = String(formData.get("body") ?? "").trim().slice(0, 5000);

  const participant = await db.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId: user.id } },
    include: { conversation: true },
  });
  if (!participant) redirect("/nachrichten");
  if (body.length < 1) redirect(`/nachrichten/${conversationId}`);

  await db.message.create({ data: { conversationId, authorId: user.id, body } });
  await db.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });
  await db.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId: user.id } },
    data: { lastReadAt: new Date() },
  });

  await notifyParticipants(conversationId, user.id, participant.conversation.subject, body);

  revalidatePath(`/nachrichten/${conversationId}`);
  revalidatePath("/nachrichten");
  redirect(`/nachrichten/${conversationId}`);
}
