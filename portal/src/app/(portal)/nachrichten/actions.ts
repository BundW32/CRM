"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  canVerwalterAccessProperty,
  canVerwalterManageUser,
  propertyWhereForVerwalter,
  userWhereForVerwalter,
} from "@/lib/access";
import { db } from "@/lib/db";
import { getBrandingForOrg } from "@/lib/branding-server";
import { portalUrl, sendMail } from "@/lib/mailer";
import { mailText } from "@/lib/mail-text";
import { sendPushToUsers } from "@/lib/push";
import { requireUser } from "@/lib/session";

export type RecipientResult = {
  id: string;
  name: string;
  role: "MIETER" | "EIGENTUEMER";
  propertyName: string | null;
  detail?: string; // z. B. Wohnungsbezeichnung (Mieter) oder "Eigentümer"
};

export type RecipientProperty = { id: string; name: string };

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
    parts.map(async (p) =>
      (async () => {
        const branding = await getBrandingForOrg(p.user.organizationId);
        return sendMail(
          p.user.email,
          `Neue Nachricht: ${subject}`,
          mailText({
            anrede: p.user.name,
            absaetze: [`Sie haben eine neue Nachricht im Kundenportal erhalten:`, `„${preview}"`],
            aktion: { label: "Nachricht lesen", url: link },
            branding,
          }),
          undefined,
          branding
        );
      })()
    )
  );
  await sendPushToUsers(
    parts.map((p) => p.userId),
    { title: `Neue Nachricht: ${subject}`, body: preview, url: `/nachrichten/${conversationId}` }
  );
}

// Empfänger-Objekte im Scope des Verwalters (für die strukturierte Auswahl).
export async function listRecipientProperties(): Promise<RecipientProperty[]> {
  const user = await requireUser();
  if (user.role !== "VERWALTER") return [];
  return db.property.findMany({
    where: await propertyWhereForVerwalter(user),
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

// Empfänger (Mieter + Eigentümer) eines konkreten Objekts – gedeckelt je Objekt,
// scope-geprüft. So bleibt die Auswahl auch bei sehr vielen Nutzern übersichtlich.
export async function recipientsForProperty(propertyId: string): Promise<RecipientResult[]> {
  const user = await requireUser();
  if (user.role !== "VERWALTER") return [];
  if (!propertyId || !(await canVerwalterAccessProperty(user, propertyId))) return [];

  const prop = await db.property.findUnique({
    where: { id: propertyId },
    select: { name: true },
  });
  const propName = prop?.name ?? null;

  const [owners, tenancies] = await Promise.all([
    db.ownership.findMany({
      where: { propertyId },
      include: { user: { select: { id: true, name: true, active: true } } },
      orderBy: { user: { name: "asc" } },
    }),
    db.tenancy.findMany({
      where: { active: true, unit: { propertyId } },
      include: {
        user: { select: { id: true, name: true, active: true } },
        unit: { select: { label: true } },
      },
      orderBy: { user: { name: "asc" } },
    }),
  ]);

  const map = new Map<string, RecipientResult>();
  for (const o of owners) {
    if (!o.user.active) continue;
    map.set(o.user.id, {
      id: o.user.id,
      name: o.user.name,
      role: "EIGENTUEMER",
      propertyName: propName,
      detail: "Eigentümer",
    });
  }
  for (const t of tenancies) {
    if (!t.user.active || map.has(t.user.id)) continue;
    map.set(t.user.id, {
      id: t.user.id,
      name: t.user.name,
      role: "MIETER",
      propertyName: propName,
      detail: t.unit.label,
    });
  }
  return [...map.values()];
}

// Neue Konversation starten. Verwalter kann mehrere Empfänger wählen – dann wird je
// Empfänger ein EIGENER Thread erstellt (Datenschutz: Empfänger sehen sich nicht
// gegenseitig). Mieter/Eigentümer schreiben an die Verwaltung (alle aktiven Verwalter).
export async function startConversation(formData: FormData) {
  const user = await requireUser();
  const subject = String(formData.get("subject") ?? "").trim().slice(0, 200);
  const body = String(formData.get("body") ?? "").trim().slice(0, 5000);

  // Der Rücksprung nimmt die Empfänger mit: Ohne sie fiele man auf die
  // Empfängerauswahl zurück und müsste sie ein zweites Mal zusammenklicken,
  // obwohl nur der Betreff gefehlt hat.
  const zurueck = (fehler: string) => {
    const ids = formData.getAll("recipientId").map((v) => String(v)).filter(Boolean);
    const p = new URLSearchParams();
    p.set("fehler", fehler);
    for (const id of ids) p.append("recipientId", id);
    return `/nachrichten/neu?${p.toString()}`;
  };

  if (subject.length < 2 || body.length < 1) {
    redirect(zurueck("eingabe"));
  }

  if (user.role === "VERWALTER") {
    const rawIds = formData.getAll("recipientId").map((v) => String(v)).filter(Boolean);
    const uniqueIds = [...new Set(rawIds)].filter((id) => id !== user.id);

    // Jeden Empfänger einzeln validieren (aktiv, kein Verwalter, im Scope).
    const valid: string[] = [];
    for (const rid of uniqueIds) {
      const recipient = await db.user.findUnique({ where: { id: rid } });
      if (!recipient || !recipient.active || recipient.role === "VERWALTER") continue;
      if (!(await canVerwalterManageUser(user, recipient.id))) continue;
      valid.push(recipient.id);
    }
    if (valid.length === 0) {
      redirect(zurueck("empfaenger"));
    }

    const createdIds: string[] = [];
    for (const rid of valid) {
      const conv = await db.conversation.create({
        data: {
          subject,
          organizationId: user.organizationId,
          participants: {
            create: [{ userId: user.id, lastReadAt: new Date() }, { userId: rid }],
          },
          messages: { create: { authorId: user.id, body } },
        },
      });
      await notifyParticipants(conv.id, user.id, subject, body);
      createdIds.push(conv.id);
    }

    revalidatePath("/nachrichten");
    if (createdIds.length === 1) {
      redirect(`/nachrichten/${createdIds[0]}`);
    }
    redirect(`/nachrichten?gesendet=${createdIds.length}`);
  }

  // Mieter/Eigentümer → Verwaltung (alle aktiven Verwalter der eigenen Org).
  const verwalter = await db.user.findMany({
    where: { role: "VERWALTER", active: true, organizationId: user.organizationId },
    select: { id: true },
  });
  const recipientIds = verwalter.map((v) => v.id).filter((id) => id !== user.id);
  if (recipientIds.length === 0) {
    redirect(zurueck("empfaenger"));
  }

  const conversation = await db.conversation.create({
    data: {
      subject,
      organizationId: user.organizationId,
      participants: {
        create: [
          { userId: user.id, lastReadAt: new Date() },
          ...recipientIds.map((id) => ({ userId: id })),
        ],
      },
      messages: { create: { authorId: user.id, body } },
    },
  });

  await notifyParticipants(conversation.id, user.id, subject, body);

  revalidatePath("/nachrichten");
  redirect(`/nachrichten/${conversation.id}?flash=gespeichert`);
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
  redirect(`/nachrichten/${conversationId}?flash=gesendet`);
}
