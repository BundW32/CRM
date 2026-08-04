"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { User } from "@/generated/prisma/client";
import { canVerwalterAccessProperty } from "@/lib/access";
import { AUDIT, logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getBrandingForOrg } from "@/lib/branding-server";
import { briefkopfAus } from "@/lib/documents/briefkopf";
import { portalUrl, sendMail } from "@/lib/mailer";
import { deleteBlob, saveBuffer } from "@/lib/storage";
import { requireVerwalter } from "@/lib/session";
import { generateMeetingProtocol } from "@/lib/documents/meeting-protocol";
import { MEETING_AGENDA_TEMPLATES } from "@/lib/weg/meeting-agenda-templates";

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

// Eine durchgeführte oder abgesagte Versammlung ist „abgeschlossen": Tagesordnung
// und Einladung sind eingefroren, sonst würde ein bereits veröffentlichtes
// Protokoll von der Realität abweichen.
function isMeetingClosed(status: string): boolean {
  return status === "DURCHGEFUEHRT" || status === "ABGESAGT";
}

export async function createMeeting(formData: FormData) {
  const verwalter = await requireVerwalter();
  const propertyId = String(formData.get("propertyId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim().slice(0, 200);
  const scheduledStr = String(formData.get("scheduledAt") ?? "");
  const location = String(formData.get("location") ?? "").trim().slice(0, 200);
  const videoLinkInput = String(formData.get("videoLink") ?? "").trim().slice(0, 500) || null;
  const saveVideoDefault = formData.get("saveVideoDefault") === "on";
  // Ort ist Pflicht (§24 WEG: die Einladung muss den Versammlungsort nennen). Bei
  // reiner Video-Versammlung hier z. B. „Online / Videokonferenz" eintragen.
  if (!propertyId || !title || !scheduledStr || !location) redirect("/versammlungen/neu?fehler=eingabe");

  if (!(await canVerwalterAccessProperty(verwalter, propertyId))) redirect("/versammlungen");
  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: { managementType: true, defaultVideoLink: true },
  });
  if (!property || property.managementType !== "WEG") redirect("/versammlungen/neu?fehler=keinweg");

  const scheduledAt = new Date(scheduledStr);
  if (Number.isNaN(scheduledAt.getTime())) redirect("/versammlungen/neu?fehler=eingabe");

  // Leer gelassen → Standard-Videolink des Objekts (falls hinterlegt). Auf Wunsch
  // wird der eingegebene Link als neuer Standard des Objekts gespeichert.
  const videoLink = videoLinkInput ?? property.defaultVideoLink;
  if (saveVideoDefault && videoLinkInput && videoLinkInput !== property.defaultVideoLink) {
    await db.property.update({ where: { id: propertyId }, data: { defaultVideoLink: videoLinkInput } });
  }

  const meeting = await db.ownersMeeting.create({
    data: {
      organizationId: verwalter.organizationId,
      propertyId,
      title,
      scheduledAt,
      location,
      videoLink,
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

  if (isMeetingClosed(meeting.status)) redirect(`/versammlungen/${meetingId}?fehler=gesperrt`);

  const title = String(formData.get("title") ?? "").trim().slice(0, 200);
  const description = String(formData.get("description") ?? "").trim().slice(0, 2000) || null;
  const type = String(formData.get("type") ?? "INFO") === "BESCHLUSS" ? "BESCHLUSS" : "INFO";
  if (!title) redirect(`/versammlungen/${meetingId}`);

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

  // sortOrder atomar bestimmen (max+1), sonst kollidieren parallele TOP-Anlagen.
  await db.$transaction(async (tx) => {
    const max = await tx.meetingAgendaItem.aggregate({
      where: { meetingId },
      _max: { sortOrder: true },
    });
    const nextSort = (max._max.sortOrder ?? -1) + 1;
    await tx.meetingAgendaItem.create({
      data: { meetingId, sortOrder: nextSort, title, description, type, resolutionId },
    });
  });
  revalidatePath(`/versammlungen/${meetingId}`);
  redirect(`/versammlungen/${meetingId}?flash=erstellt`);
}

export async function deleteAgendaItem(formData: FormData) {
  const verwalter = await requireVerwalter();
  const meetingId = String(formData.get("meetingId") ?? "").trim();
  const itemId = String(formData.get("itemId") ?? "").trim();
  const meeting = await meetingInScope(verwalter, meetingId);
  if (!meeting || !itemId) redirect("/versammlungen");
  if (isMeetingClosed(meeting.status)) redirect(`/versammlungen/${meetingId}?fehler=gesperrt`);

  // Kind an die validierte meetingId binden; Stimmzahl des verknüpften Beschlusses
  // laden, um bereits abgegebene Stimmen nicht zu vernichten.
  const item = await db.meetingAgendaItem.findFirst({
    where: { id: itemId, meetingId },
    select: { resolutionId: true, resolution: { select: { status: true, _count: { select: { votes: true } } } } },
  });
  if (item) {
    await db.$transaction(async (tx) => {
      await tx.meetingAgendaItem.deleteMany({ where: { id: itemId, meetingId } });
      if (item.resolutionId && item.resolution?.status === "OFFEN") {
        if (item.resolution._count.votes > 0) {
          // Es wurde schon abgestimmt → Beschluss zurückziehen statt löschen
          // (Stimmen bleiben nachvollziehbar erhalten).
          await tx.resolution.updateMany({
            where: { id: item.resolutionId, status: "OFFEN" },
            data: { status: "ZURUECKGEZOGEN", decidedAt: new Date() },
          });
        } else {
          await tx.resolution.deleteMany({ where: { id: item.resolutionId, status: "OFFEN" } });
        }
      }
    });
  }
  revalidatePath(`/versammlungen/${meetingId}`);
  redirect(`/versammlungen/${meetingId}?flash=geloescht`);
}

export async function updateAgendaItem(formData: FormData) {
  const verwalter = await requireVerwalter();
  const meetingId = String(formData.get("meetingId") ?? "").trim();
  const itemId = String(formData.get("itemId") ?? "").trim();
  const meeting = await meetingInScope(verwalter, meetingId);
  if (!meeting || !itemId) redirect("/versammlungen");
  if (isMeetingClosed(meeting.status)) redirect(`/versammlungen/${meetingId}?fehler=gesperrt`);

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
  redirect(`/versammlungen/${meetingId}?flash=aktualisiert`);
}

// TOP nach oben/unten verschieben (sortOrder mit Nachbarn tauschen).
export async function moveAgendaItem(formData: FormData) {
  const verwalter = await requireVerwalter();
  const meetingId = String(formData.get("meetingId") ?? "").trim();
  const itemId = String(formData.get("itemId") ?? "").trim();
  const dir = String(formData.get("direction") ?? "");
  const meeting = await meetingInScope(verwalter, meetingId);
  if (!meeting || !itemId || (dir !== "up" && dir !== "down")) redirect("/versammlungen");
  if (isMeetingClosed(meeting.status)) redirect(`/versammlungen/${meetingId}?fehler=gesperrt`);

  const items = await db.meetingAgendaItem.findMany({
    where: { meetingId },
    // Deterministische Reihenfolge auch bei doppelten sortOrder-Werten.
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  const idx = items.findIndex((it) => it.id === itemId);
  const swapIdx = dir === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swapIdx < 0 || swapIdx >= items.length) {
    redirect(`/versammlungen/${meetingId}`);
  }
  // Ziel-Reihenfolge bilden und ALLE TOPs lückenlos 0..n-1 neu nummerieren –
  // heilt eventuelle Duplikate/Lücken statt nur zwei Werte zu tauschen.
  const reordered = items.map((it) => it.id);
  [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
  await db.$transaction(
    reordered.map((id, i) =>
      db.meetingAgendaItem.updateMany({ where: { id, meetingId }, data: { sortOrder: i } }),
    ),
  );
  revalidatePath(`/versammlungen/${meetingId}`);
  redirect(`/versammlungen/${meetingId}?flash=aktualisiert`);
}

// Versammlung absagen (Status ABGESAGT).
export async function cancelMeeting(formData: FormData) {
  const verwalter = await requireVerwalter();
  const meetingId = String(formData.get("meetingId") ?? "").trim();
  const meeting = await meetingInScope(verwalter, meetingId);
  if (!meeting) redirect("/versammlungen");
  // Eine durchgeführte Versammlung (mit Protokoll) kann nicht abgesagt werden.
  if (meeting.status === "DURCHGEFUEHRT") redirect(`/versammlungen/${meetingId}?fehler=durchgefuehrt`);
  if (meeting.status === "ABGESAGT") redirect(`/versammlungen/${meetingId}`);

  // Absagen + offene Beschluss-TOPs zurückziehen (keine Abstimmung für eine
  // abgesagte Versammlung) – in einer Transaktion.
  await db.$transaction(async (tx) => {
    await tx.ownersMeeting.update({ where: { id: meetingId }, data: { status: "ABGESAGT" } });
    const items = await tx.meetingAgendaItem.findMany({
      where: { meetingId, resolutionId: { not: null } },
      select: { resolutionId: true },
    });
    const resIds = items.map((it) => it.resolutionId!).filter(Boolean);
    if (resIds.length > 0) {
      await tx.resolution.updateMany({
        where: { id: { in: resIds }, status: "OFFEN" },
        data: { status: "ZURUECKGEZOGEN", decidedAt: new Date() },
      });
    }
  });

  // Wurde bereits eingeladen, die Eigentümer über die Absage informieren.
  if (meeting.invitationSentAt) {
    const [property, owners, branding] = await Promise.all([
      db.property.findUnique({ where: { id: meeting.propertyId }, select: { name: true } }),
      db.ownership.findMany({ where: { propertyId: meeting.propertyId }, include: { user: true } }),
      getBrandingForOrg(verwalter.organizationId),
    ]);
    await Promise.all(
      owners.map((o) =>
        sendMail(
          o.user.email,
          `Absage der Eigentümerversammlung – ${property?.name ?? ""}`,
          `Guten Tag ${o.user.name},\n\n` +
            `die für „${meeting.title}" geplante Eigentümerversammlung wurde abgesagt.\n\n` +
            `Mit freundlichen Grüßen\n${branding.legalName}`,
          undefined,
          branding,
        ).catch(() => {}),
      ),
    );
  }
  revalidatePath(`/versammlungen/${meetingId}`);
  redirect(`/versammlungen/${meetingId}?flash=gespeichert`);
}

// Eckdaten ändern (Titel/Termin/Ort). Eine abgesagte Versammlung wird dabei
// wieder auf „Geplant" gesetzt.
export async function updateMeeting(formData: FormData) {
  const verwalter = await requireVerwalter();
  const meetingId = String(formData.get("meetingId") ?? "").trim();
  const meeting = await meetingInScope(verwalter, meetingId);
  if (!meeting) redirect("/versammlungen");
  // Eine durchgeführte Versammlung nicht mehr umdatieren (Protokoll ist fix).
  if (meeting.status === "DURCHGEFUEHRT") redirect(`/versammlungen/${meetingId}?fehler=durchgefuehrt`);

  const title = String(formData.get("title") ?? "").trim().slice(0, 200);
  const scheduledStr = String(formData.get("scheduledAt") ?? "");
  const location = String(formData.get("location") ?? "").trim().slice(0, 200);
  const videoLink = String(formData.get("videoLink") ?? "").trim().slice(0, 500) || null;
  const saveVideoDefault = formData.get("saveVideoDefault") === "on";
  // Ort bleibt auch bei Änderung Pflicht (siehe createMeeting).
  if (!title || !scheduledStr || !location) redirect(`/versammlungen/${meetingId}?fehler=eingabe`);
  const scheduledAt = new Date(scheduledStr);
  if (Number.isNaN(scheduledAt.getTime())) redirect(`/versammlungen/${meetingId}?fehler=eingabe`);

  // Auf Wunsch den Link als Standard des Objekts übernehmen (für künftige Termine).
  if (saveVideoDefault && videoLink) {
    await db.property.update({
      where: { id: meeting.propertyId },
      data: { defaultVideoLink: videoLink },
    });
  }

  await db.ownersMeeting.update({
    where: { id: meetingId },
    data: {
      title,
      scheduledAt,
      location,
      videoLink,
      ...(meeting.status === "ABGESAGT" ? { status: "GEPLANT" as const } : {}),
    },
  });
  // Wurde bereits eingeladen und der Termin geändert → Hinweis, erneut einzuladen.
  const rescheduled =
    meeting.status === "EINBERUFEN" && scheduledAt.getTime() !== meeting.scheduledAt.getTime();
  revalidatePath(`/versammlungen/${meetingId}`);
  // Der Hinweis auf die Neuterminierung ist bedingt – der Flash-Parameter darf
  // ihm nicht mit „&" folgen, wenn gar kein Querystring entstanden ist.
  redirect(
    `/versammlungen/${meetingId}?flash=aktualisiert${rescheduled ? "&hinweis=neuterminieren" : ""}`,
  );
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
  redirect(`/versammlungen/${meetingId}?flash=aktualisiert`);
}

export async function sendInvitation(formData: FormData) {
  const verwalter = await requireVerwalter();
  const meetingId = String(formData.get("meetingId") ?? "").trim();
  const meeting = await meetingInScope(verwalter, meetingId);
  if (!meeting) redirect("/versammlungen");
  // Einladungen nur für planbare Versammlungen (nicht abgesagt/durchgeführt).
  if (isMeetingClosed(meeting.status)) redirect(`/versammlungen/${meetingId}?fehler=gesperrt`);

  // Doppelklick-/Mehrfachversand-Schutz: den Versand-Zeitstempel ATOMAR
  // beanspruchen (nur wer die Sperrfrist von 2 Minuten „gewinnt", verschickt).
  // Verhindert doppelte Massen-Mails an die gesamte WEG.
  const claimed = await db.ownersMeeting.updateMany({
    where: {
      id: meetingId,
      OR: [
        { invitationSentAt: null },
        { invitationSentAt: { lt: new Date(Date.now() - 2 * 60 * 1000) } },
      ],
    },
    data: { invitationSentAt: new Date() },
  });
  if (claimed.count !== 1) redirect(`/versammlungen/${meetingId}?fehler=gerade_versendet`);

  const [property, items, owners, branding] = await Promise.all([
    db.property.findUnique({ where: { id: meeting.propertyId }, select: { name: true } }),
    db.meetingAgendaItem.findMany({ where: { meetingId }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
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

  // invitationSentAt wurde bereits beim atomaren Claim gesetzt; hier nur noch
  // der Status-Übergang: nur aus „Geplant" heraus einberufen – eine bereits
  // durchgeführte Versammlung darf nicht zurückgestuft werden.
  if (meeting.status === "GEPLANT") {
    await db.ownersMeeting.updateMany({
      where: { id: meetingId, status: "GEPLANT" },
      data: { status: "EINBERUFEN" },
    });
  }
  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_MEETING_INVITE_SENT,
    targetType: "OwnersMeeting",
    targetId: meetingId,
    meta: { recipients: owners.length },
  });
  revalidatePath(`/versammlungen/${meetingId}`);
  redirect(`/versammlungen/${meetingId}?eingeladen=${owners.length}`);
}

// Zero-Key-Fallback zum E-Mail-Versand: „Als versendet markieren". Der Verwalter
// druckt die Einladungs-PDFs selbst aus und verschickt sie postalisch; dieser
// Schritt setzt das Versanddatum, ab dem der Fristenrechner rechnet, ohne eine
// einzige E-Mail zu senden. Gleicher atomarer Doppelklick-Schutz wie beim Versand.
export async function markInvitationSent(formData: FormData) {
  const verwalter = await requireVerwalter();
  const meetingId = String(formData.get("meetingId") ?? "").trim();
  const meeting = await meetingInScope(verwalter, meetingId);
  if (!meeting) redirect("/versammlungen");
  if (isMeetingClosed(meeting.status)) redirect(`/versammlungen/${meetingId}?fehler=gesperrt`);

  const claimed = await db.ownersMeeting.updateMany({
    where: {
      id: meetingId,
      OR: [
        { invitationSentAt: null },
        { invitationSentAt: { lt: new Date(Date.now() - 2 * 60 * 1000) } },
      ],
    },
    data: { invitationSentAt: new Date() },
  });
  if (claimed.count !== 1) redirect(`/versammlungen/${meetingId}?fehler=gerade_versendet`);

  if (meeting.status === "GEPLANT") {
    await db.ownersMeeting.updateMany({
      where: { id: meetingId, status: "GEPLANT" },
      data: { status: "EINBERUFEN" },
    });
  }
  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_MEETING_INVITE_MARKED,
    targetType: "OwnersMeeting",
    targetId: meetingId,
  });
  revalidatePath(`/versammlungen/${meetingId}`);
  redirect(`/versammlungen/${meetingId}?markiert=1`);
}

// Fügt einen Tagesordnungspunkt aus dem Vorlagenkatalog hinzu. Beschluss-Vorlagen
// erzeugen — wie ein manueller Beschluss-TOP — automatisch eine Abstimmung.
export async function addAgendaFromTemplate(formData: FormData) {
  const verwalter = await requireVerwalter();
  const meetingId = String(formData.get("meetingId") ?? "").trim();
  const key = String(formData.get("templateKey") ?? "").trim();
  const meeting = await meetingInScope(verwalter, meetingId);
  if (!meeting) redirect("/versammlungen");
  if (isMeetingClosed(meeting.status)) redirect(`/versammlungen/${meetingId}?fehler=gesperrt`);

  const tpl = MEETING_AGENDA_TEMPLATES.find((t) => t.key === key);
  if (!tpl) redirect(`/versammlungen/${meetingId}`);

  let resolutionId: string | null = null;
  if (tpl.type === "BESCHLUSS") {
    const resolution = await db.resolution.create({
      data: {
        propertyId: meeting.propertyId,
        title: tpl.title,
        description: tpl.description,
        createdById: verwalter.id,
        organizationId: verwalter.organizationId,
      },
    });
    resolutionId = resolution.id;
  }

  await db.$transaction(async (tx) => {
    const max = await tx.meetingAgendaItem.aggregate({
      where: { meetingId },
      _max: { sortOrder: true },
    });
    const nextSort = (max._max.sortOrder ?? -1) + 1;
    await tx.meetingAgendaItem.create({
      data: {
        meetingId,
        sortOrder: nextSort,
        title: tpl.title,
        description: tpl.description,
        type: tpl.type,
        resolutionId,
      },
    });
  });
  revalidatePath(`/versammlungen/${meetingId}`);
  redirect(`/versammlungen/${meetingId}?flash=erstellt`);
}

export async function generateProtocol(formData: FormData) {
  const verwalter = await requireVerwalter();
  const meetingId = String(formData.get("meetingId") ?? "").trim();
  const meeting = await meetingInScope(verwalter, meetingId);
  if (!meeting) redirect("/versammlungen");
  // Für eine abgesagte Versammlung wird kein Protokoll erstellt.
  if (meeting.status === "ABGESAGT") redirect(`/versammlungen/${meetingId}?fehler=abgesagt`);

  try {
    await buildAndStoreProtocol(verwalter, meeting);
  } catch (err) {
    console.error("Protokoll-Erzeugung fehlgeschlagen", err);
    redirect(`/versammlungen/${meetingId}?fehler=protokoll`);
  }
  revalidatePath(`/versammlungen/${meetingId}`);
  redirect(`/versammlungen/${meetingId}?protokoll=1`);
}

// Erzeugt das Protokoll-PDF, legt es als Dokument ab und markiert die Versammlung
// als durchgeführt. Bricht das Meeting-Update ab (z. B. weil die Versammlung
// zwischenzeitlich gelöscht/abgesagt wurde), wird das gerade erzeugte Dokument
// wieder entfernt, damit kein verwaistes Protokoll zurückbleibt.
async function buildAndStoreProtocol(
  verwalter: User,
  meeting: { id: string; propertyId: string; title: string; scheduledAt: Date; location: string | null; videoLink: string | null; attendanceNote: string | null; protocolDocumentId: string | null },
) {
  const meetingId = meeting.id;
  const [property, items, branding, board] = await Promise.all([
    db.property.findUnique({ where: { id: meeting.propertyId }, select: { name: true } }),
    db.meetingAgendaItem.findMany({
      where: { meetingId },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      include: { resolution: { include: { votes: { select: { choice: true } } } } },
    }),
    getBrandingForOrg(verwalter.organizationId),
    db.ownership.findMany({
      where: { propertyId: meeting.propertyId, isBoardMember: true },
      select: { user: { select: { name: true } } },
      orderBy: { user: { name: "asc" } },
    }),
  ]);
  const boardMembers = board.map((b) => b.user.name);

  const statusLabel: Record<string, string> = {
    ANGENOMMEN: "Angenommen",
    ABGELEHNT: "Abgelehnt",
    ZURUECKGEZOGEN: "Zurückgezogen",
    OFFEN: "offen",
  };

  const kopf = await briefkopfAus(branding);
  const pdf = await generateMeetingProtocol({
    propertyName: property?.name ?? "",
    issuer: kopf.issuer,
    brand: kopf.brand,
    logo: kopf.logo,
    meetingTitle: meeting.title,
    scheduledAt: meeting.scheduledAt,
    location: meeting.location,
    videoLink: meeting.videoLink,
    attendance: meeting.attendanceNote,
    boardMembers,
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

  // Meeting-Update BEDINGT: nur wenn die Versammlung noch existiert und nicht
  // abgesagt ist. Schlägt das fehl (0 Zeilen), das gerade erzeugte Dokument samt
  // Blob wieder entfernen, statt ein verwaistes Protokoll zurückzulassen.
  const updated = await db.ownersMeeting.updateMany({
    where: { id: meetingId, status: { not: "ABGESAGT" } },
    data: { protocolDocumentId: doc.id, status: "DURCHGEFUEHRT" },
  });
  if (updated.count !== 1) {
    await deleteBlob(upload.storedName).catch(() => {});
    await db.document.delete({ where: { id: doc.id } }).catch(() => {});
    throw new Error("Versammlung nicht mehr aktualisierbar (abgesagt/gelöscht).");
  }

  // Idempotenz: ein zuvor erzeugtes Protokoll ERST NACH erfolgreichem Update
  // ersetzen, statt es als verwaistes, weiterhin herunterladbares Dokument
  // liegen zu lassen.
  const oldDocId = meeting.protocolDocumentId;
  if (oldDocId && oldDocId !== doc.id) {
    const old = await db.document.findFirst({
      where: { id: oldDocId, organizationId: verwalter.organizationId },
      select: { storedName: true },
    });
    if (old) {
      await deleteBlob(old.storedName).catch(() => {});
      await db.document.delete({ where: { id: oldDocId } }).catch(() => {});
    }
  }
}

export async function deleteMeeting(formData: FormData) {
  const verwalter = await requireVerwalter();
  const meetingId = String(formData.get("meetingId") ?? "").trim();
  const meeting = await meetingInScope(verwalter, meetingId);
  if (!meeting) redirect("/versammlungen");

  // Aufräumen VOR dem Löschen: verknüpfte offene Beschlüsse und das Protokoll-
  // Dokument. Entschiedene Beschlüsse bleiben (Beschluss-Sammlung, §24 VII WEG).
  const items = await db.meetingAgendaItem.findMany({
    where: { meetingId, resolutionId: { not: null } },
    select: { resolutionId: true },
  });
  const openResIds = items.map((it) => it.resolutionId!).filter(Boolean);

  // Blob des Protokoll-Dokuments vorab ermitteln (Löschen außerhalb der tx).
  let protocolBlob: string | null = null;
  if (meeting.protocolDocumentId) {
    const doc = await db.document.findFirst({
      where: { id: meeting.protocolDocumentId, organizationId: verwalter.organizationId },
      select: { storedName: true },
    });
    protocolBlob = doc?.storedName ?? null;
  }

  await db.$transaction(async (tx) => {
    if (openResIds.length > 0) {
      await tx.resolution.deleteMany({ where: { id: { in: openResIds }, status: "OFFEN" } });
    }
    if (meeting.protocolDocumentId) {
      await tx.document.deleteMany({
        where: { id: meeting.protocolDocumentId, organizationId: verwalter.organizationId },
      });
    }
    await tx.ownersMeeting.delete({ where: { id: meetingId } });
  });
  if (protocolBlob) await deleteBlob(protocolBlob).catch(() => {});

  revalidatePath("/versammlungen");
  redirect("/versammlungen?flash=geloescht");
}

/**
 * Setzt die Reihenfolge der Tagesordnung in einem Zug.
 *
 * `moveAgendaItem` tauscht zwei Nachbarn und lädt danach die Seite neu — bei
 * fünf TOPs wird das zur Klickerei, und jede Bewegung kostet einen
 * Seitenaufbau. Diese Aktion nimmt die fertige Reihenfolge entgegen, wie sie im
 * Sortier-Editor zusammengezogen wurde, und schreibt sie einmal.
 *
 * Es werden ALLE Positionen lückenlos neu vergeben (0..n-1) statt einzelne
 * Werte zu setzen — das heilt zugleich Duplikate und Lücken aus der Zeit
 * paralleler Einfügungen.
 */
export async function reorderAgendaItems(formData: FormData) {
  const verwalter = await requireVerwalter();
  const meetingId = String(formData.get("meetingId") ?? "").trim();
  const meeting = await meetingInScope(verwalter, meetingId);
  if (!meeting) redirect("/versammlungen");
  if (isMeetingClosed(meeting.status)) redirect(`/versammlungen/${meetingId}?fehler=gesperrt`);

  const gewuenscht = String(formData.get("order") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const vorhanden = await db.meetingAgendaItem.findMany({
    where: { meetingId },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  const erlaubt = new Set(vorhanden.map((i) => i.id));

  // Nur bekannte IDs übernehmen und fehlende hinten anhängen: Wer die Seite
  // offen liegen lässt, während anderswo ein TOP entsteht, darf ihn mit einem
  // veralteten Formular nicht verschwinden lassen.
  const gefiltert = gewuenscht.filter((id) => erlaubt.has(id));
  const fehlende = vorhanden.map((i) => i.id).filter((id) => !gefiltert.includes(id));
  const endgueltig = [...gefiltert, ...fehlende];

  await db.$transaction(
    endgueltig.map((id, index) =>
      db.meetingAgendaItem.update({ where: { id }, data: { sortOrder: index } }),
    ),
  );
  revalidatePath(`/versammlungen/${meetingId}`);
  redirect(`/versammlungen/${meetingId}?flash=gespeichert`);
}
