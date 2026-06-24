"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canVerwalterManageUser } from "@/lib/access";
import { db } from "@/lib/db";
import { portalUrl, sendMail } from "@/lib/mailer";
import { sendPushToUsers } from "@/lib/push";
import { requireUser } from "@/lib/session";

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
    const verwalter = await db.user.findMany({
      where: { role: "VERWALTER", active: true },
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
