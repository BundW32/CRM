"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { User } from "@/generated/prisma/client";
import { canVerwalterAccessProperty } from "@/lib/access";
import { db } from "@/lib/db";
import { getBrandingForOrg } from "@/lib/branding-server";
import { portalUrl, sendMail } from "@/lib/mailer";
import { saveBuffer } from "@/lib/storage";
import { requireVerwalter } from "@/lib/session";
import { generateMeetingProtocol } from "@/lib/documents/meeting-protocol";

// Lädt eine Versammlung und prüft, dass das Objekt im Scope des Verwalters liegt.
async function meetingInScope(verwalter: User, meetingId: string) {
  if (!meetingId) return null;
  const meeting = await db.ownersMeeting.findFirst({
    where: { id: meetingId, organizationId: verwalter.organizationId },
  });
  if (!meeting) return null;
  if (!(await canVerwalterAccessProperty(verwalter, meeting.propertyId))) return null;
  return meeting;
}

export async function createMeeting(formData: FormData) {
  const verwalter = await requireVerwalter();
  const propertyId = String(formData.get("propertyId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim().slice(0, 200);
  const scheduledStr = String(formData.get("scheduledAt") ?? "");
  const location = String(formData.get("location") ?? "").trim().slice(0, 200) || null;
  if (!propertyId || !title || !scheduledStr) redirect("/versammlungen?fehler=eingabe");

  if (!(await canVerwalterAccessProperty(verwalter, propertyId))) redirect("/versammlungen");
  const property = await db.property.findUnique({ where: { id: propertyId }, select: { managementType: true } });
  if (!property || property.managementType !== "WEG") redirect("/versammlungen?fehler=keinweg");

  const scheduledAt = new Date(scheduledStr);
  if (Number.isNaN(scheduledAt.getTime())) redirect("/versammlungen?fehler=eingabe");

  const meeting = await db.ownersMeeting.create({
    data: {
      organizationId: verwalter.organizationId,
      propertyId,
      title,
      scheduledAt,
      location,
      createdById: verwalter.id,
    },
  });
  revalidatePath("/versammlungen");
  redirect(`/versammlungen/${meeting.id}`);
}

export async function addAgendaItem(formData: FormData) {
  const verwalter = await requireVerwalter();
  const meetingId = String(formData.get("meetingId") ?? "").trim();
  const meeting = await meetingInScope(verwalter, meetingId);
  if (!meeting) redirect("/versammlungen");

  const title = String(formData.get("title") ?? "").trim().slice(0, 200);
  const description = String(formData.get("description") ?? "").trim().slice(0, 2000) || null;
  const type = String(formData.get("type") ?? "INFO") === "BESCHLUSS" ? "BESCHLUSS" : "INFO";
  if (!title) redirect(`/versammlungen/${meetingId}`);

  const count = await db.meetingAgendaItem.count({ where: { meetingId } });

  // Beschluss-TOP: verknüpften Beschluss (OFFEN) anlegen → vorhandene Abstimmlogik.
  let resolutionId: string | null = null;
  if (type === "BESCHLUSS") {
    const resolution = await db.resolution.create({
      data: {
        propertyId: meeting.propertyId,
        title,
        description: description ?? title,
        createdById: verwalter.id,
        organizationId: verwalter.organizationId,
      },
    });
    resolutionId = resolution.id;
  }

  await db.meetingAgendaItem.create({
    data: { meetingId, sortOrder: count, title, description, type, resolutionId },
  });
  revalidatePath(`/versammlungen/${meetingId}`);
  redirect(`/versammlungen/${meetingId}`);
}

export async function deleteAgendaItem(formData: FormData) {
  const verwalter = await requireVerwalter();
  const meetingId = String(formData.get("meetingId") ?? "").trim();
  const itemId = String(formData.get("itemId") ?? "").trim();
  const meeting = await meetingInScope(verwalter, meetingId);
  if (!meeting || !itemId) redirect("/versammlungen");

  // Kind an die validierte meetingId binden.
  const item = await db.meetingAgendaItem.findFirst({
    where: { id: itemId, meetingId },
    select: { resolutionId: true },
  });
  if (item) {
    await db.meetingAgendaItem.deleteMany({ where: { id: itemId, meetingId } });
    // Verknüpften, noch offenen Beschluss mit aufräumen.
    if (item.resolutionId) {
      await db.resolution.deleteMany({ where: { id: item.resolutionId, status: "OFFEN" } });
    }
  }
  revalidatePath(`/versammlungen/${meetingId}`);
  redirect(`/versammlungen/${meetingId}`);
}

export async function updateAgendaItem(formData: FormData) {
  const verwalter = await requireVerwalter();
  const meetingId = String(formData.get("meetingId") ?? "").trim();
  const itemId = String(formData.get("itemId") ?? "").trim();
  const meeting = await meetingInScope(verwalter, meetingId);
  if (!meeting || !itemId) redirect("/versammlungen");

  const title = String(formData.get("title") ?? "").trim().slice(0, 200);
  const description = String(formData.get("description") ?? "").trim().slice(0, 2000) || null;
  if (!title) redirect(`/versammlungen/${meetingId}`);

  const item = await db.meetingAgendaItem.findFirst({
    where: { id: itemId, meetingId },
    select: { resolutionId: true },
  });
  if (!item) redirect(`/versammlungen/${meetingId}`);

  // Kind an die validierte meetingId binden.
  await db.meetingAgendaItem.updateMany({
    where: { id: itemId, meetingId },
    data: { title, description },
  });
  // Verknüpften, noch offenen Beschluss titelgleich halten.
  if (item.resolutionId) {
    await db.resolution.updateMany({
      where: { id: item.resolutionId, status: "OFFEN" },
      data: { title, description: description ?? title },
    });
  }
  revalidatePath(`/versammlungen/${meetingId}`);
  redirect(`/versammlungen/${meetingId}`);
}

// TOP nach oben/unten verschieben (sortOrder mit Nachbarn tauschen).
export async function moveAgendaItem(formData: FormData) {
  const verwalter = await requireVerwalter();
  const meetingId = String(formData.get("meetingId") ?? "").trim();
  const itemId = String(formData.get("itemId") ?? "").trim();
  const dir = String(formData.get("direction") ?? "");
  const meeting = await meetingInScope(verwalter, meetingId);
  if (!meeting || !itemId || (dir !== "up" && dir !== "down")) redirect("/versammlungen");

  const items = await db.meetingAgendaItem.findMany({
    where: { meetingId },
    orderBy: { sortOrder: "asc" },
    select: { id: true, sortOrder: true },
  });
  const idx = items.findIndex((it) => it.id === itemId);
  const swapIdx = dir === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swapIdx < 0 || swapIdx >= items.length) {
    redirect(`/versammlungen/${meetingId}`);
  }
  const a = items[idx];
  const b = items[swapIdx];
  await db.$transaction([
    db.meetingAgendaItem.updateMany({ where: { id: a.id, meetingId }, data: { sortOrder: b.sortOrder } }),
    db.meetingAgendaItem.updateMany({ where: { id: b.id, meetingId }, data: { sortOrder: a.sortOrder } }),
  ]);
  revalidatePath(`/versammlungen/${meetingId}`);
  redirect(`/versammlungen/${meetingId}`);
}

// Versammlung absagen (Status ABGESAGT).
export async function cancelMeeting(formData: FormData) {
  const verwalter = await requireVerwalter();
  const meetingId = String(formData.get("meetingId") ?? "").trim();
  const meeting = await meetingInScope(verwalter, meetingId);
  if (!meeting) redirect("/versammlungen");
  await db.ownersMeeting.update({ where: { id: meetingId }, data: { status: "ABGESAGT" } });
  revalidatePath(`/versammlungen/${meetingId}`);
  redirect(`/versammlungen/${meetingId}`);
}

// Eckdaten ändern (Titel/Termin/Ort). Eine abgesagte Versammlung wird dabei
// wieder auf „Geplant" gesetzt.
export async function updateMeeting(formData: FormData) {
  const verwalter = await requireVerwalter();
  const meetingId = String(formData.get("meetingId") ?? "").trim();
  const meeting = await meetingInScope(verwalter, meetingId);
  if (!meeting) redirect("/versammlungen");

  const title = String(formData.get("title") ?? "").trim().slice(0, 200);
  const scheduledStr = String(formData.get("scheduledAt") ?? "");
  const location = String(formData.get("location") ?? "").trim().slice(0, 200) || null;
  if (!title || !scheduledStr) redirect(`/versammlungen/${meetingId}?fehler=eingabe`);
  const scheduledAt = new Date(scheduledStr);
  if (Number.isNaN(scheduledAt.getTime())) redirect(`/versammlungen/${meetingId}?fehler=eingabe`);

  await db.ownersMeeting.update({
    where: { id: meetingId },
    data: {
      title,
      scheduledAt,
      location,
      ...(meeting.status === "ABGESAGT" ? { status: "GEPLANT" as const } : {}),
    },
  });
  revalidatePath(`/versammlungen/${meetingId}`);
  redirect(`/versammlungen/${meetingId}`);
}

// Anwesenheits-/Vertretungsvermerk speichern (fürs Protokoll).
export async function updateAttendance(formData: FormData) {
  const verwalter = await requireVerwalter();
  const meetingId = String(formData.get("meetingId") ?? "").trim();
  const meeting = await meetingInScope(verwalter, meetingId);
  if (!meeting) redirect("/versammlungen");
  const note = String(formData.get("attendanceNote") ?? "").trim().slice(0, 1000) || null;
  await db.ownersMeeting.update({ where: { id: meetingId }, data: { attendanceNote: note } });
  revalidatePath(`/versammlungen/${meetingId}`);
  redirect(`/versammlungen/${meetingId}`);
}

export async function sendInvitation(formData: FormData) {
  const verwalter = await requireVerwalter();
  const meetingId = String(formData.get("meetingId") ?? "").trim();
  const meeting = await meetingInScope(verwalter, meetingId);
  if (!meeting) redirect("/versammlungen");

  const [property, items, owners, branding] = await Promise.all([
    db.property.findUnique({ where: { id: meeting.propertyId }, select: { name: true } }),
    db.meetingAgendaItem.findMany({ where: { meetingId }, orderBy: { sortOrder: "asc" } }),
    db.ownership.findMany({ where: { propertyId: meeting.propertyId }, include: { user: true } }),
    getBrandingForOrg(verwalter.organizationId),
  ]);

  const dt = meeting.scheduledAt;
  const when = `${String(dt.getDate()).padStart(2, "0")}.${String(dt.getMonth() + 1).padStart(2, "0")}.${dt.getFullYear()}, ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")} Uhr`;
  const agenda = items.map((it, i) => `${i + 1}. ${it.title}${it.type === "BESCHLUSS" ? " (Beschluss)" : ""}`).join("\n");
  const link = portalUrl("/versammlungen");

  await Promise.all(
    owners.map((o) =>
      sendMail(
        o.user.email,
        `Einladung zur Eigentümerversammlung – ${property?.name ?? ""}`,
        `Guten Tag ${o.user.name},\n\n` +
          `hiermit laden wir Sie zur Eigentümerversammlung ein.\n\n` +
          `Objekt: ${property?.name ?? ""}\n` +
          `Termin: ${when}\n` +
          (meeting.location ? `Ort: ${meeting.location}\n` : "") +
          `\nTagesordnung:\n${agenda || "(wird noch ergänzt)"}\n\n` +
          `Details im Portal: ${link}\n\n` +
          `Mit freundlichen Grüßen\n${branding.legalName}`,
        undefined,
        branding,
      ).catch(() => {}),
    ),
  );

  await db.ownersMeeting.update({
    where: { id: meetingId },
    data: { invitationSentAt: new Date(), status: "EINBERUFEN" },
  });
  revalidatePath(`/versammlungen/${meetingId}`);
  redirect(`/versammlungen/${meetingId}?eingeladen=${owners.length}`);
}

export async function generateProtocol(formData: FormData) {
  const verwalter = await requireVerwalter();
  const meetingId = String(formData.get("meetingId") ?? "").trim();
  const meeting = await meetingInScope(verwalter, meetingId);
  if (!meeting) redirect("/versammlungen");

  const [property, items, branding] = await Promise.all([
    db.property.findUnique({ where: { id: meeting.propertyId }, select: { name: true } }),
    db.meetingAgendaItem.findMany({
      where: { meetingId },
      orderBy: { sortOrder: "asc" },
      include: { resolution: { include: { votes: { select: { choice: true } } } } },
    }),
    getBrandingForOrg(verwalter.organizationId),
  ]);

  const statusLabel: Record<string, string> = {
    ANGENOMMEN: "Angenommen",
    ABGELEHNT: "Abgelehnt",
    ZURUECKGEZOGEN: "Zurückgezogen",
    OFFEN: "offen",
  };

  const pdf = await generateMeetingProtocol({
    propertyName: property?.name ?? "",
    issuer: {
      legalName: branding.legalName,
      contactLine: [branding.addressLine, branding.email].filter(Boolean).join(" · "),
    },
    meetingTitle: meeting.title,
    scheduledAt: meeting.scheduledAt,
    location: meeting.location,
    attendance: meeting.attendanceNote,
    items: items.map((it, i) => {
      let result: string | null = null;
      if (it.type === "BESCHLUSS" && it.resolution) {
        const r = it.resolution;
        const ja = r.votes.filter((v) => v.choice === "JA").length;
        const nein = r.votes.filter((v) => v.choice === "NEIN").length;
        const enth = r.votes.filter((v) => v.choice === "ENTHALTUNG").length;
        result = `${statusLabel[r.status] ?? r.status} (Ja ${ja} · Nein ${nein} · Enthaltung ${enth})`;
      }
      return {
        index: i + 1,
        title: it.title,
        description: it.description,
        type: it.type as "INFO" | "BESCHLUSS",
        result,
      };
    }),
    generatedAt: new Date(),
  });

  const upload = await saveBuffer(pdf, `Protokoll_${meeting.title}.pdf`, "application/pdf", [
    "application/pdf",
  ]);
  const doc = await db.document.create({
    data: {
      title: `Versammlungsprotokoll – ${meeting.title}`,
      category: "PROTOKOLL",
      audience: "EIGENTUEMER",
      propertyId: meeting.propertyId,
      uploadedById: verwalter.id,
      organizationId: verwalter.organizationId,
      ...upload,
    },
  });

  await db.ownersMeeting.update({
    where: { id: meetingId },
    data: { protocolDocumentId: doc.id, status: "DURCHGEFUEHRT" },
  });
  revalidatePath(`/versammlungen/${meetingId}`);
  redirect(`/versammlungen/${meetingId}?protokoll=1`);
}

export async function deleteMeeting(formData: FormData) {
  const verwalter = await requireVerwalter();
  const meetingId = String(formData.get("meetingId") ?? "").trim();
  const meeting = await meetingInScope(verwalter, meetingId);
  if (!meeting) redirect("/versammlungen");
  await db.ownersMeeting.delete({ where: { id: meetingId } });
  revalidatePath("/versammlungen");
  redirect("/versammlungen");
}
