"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { User } from "@/generated/prisma/client";
import { canAdministerProperty, canVoteOnProperty } from "@/lib/access";
import { db } from "@/lib/db";
import { getBrandingForOrg } from "@/lib/branding-server";
import { portalUrl, sendMail } from "@/lib/mailer";
import { getOrganization, requireUser, requireVerwalter } from "@/lib/session";

const MOTION_TYPES = ["BESCHLUSSANTRAG", "VERSAMMLUNG"] as const;

const submitSchema = z.object({
  propertyId: z.string().min(1),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(3).max(5000),
  type: z.enum(MOTION_TYPES).default("BESCHLUSSANTRAG"),
});

// Eigentümer reicht einen Antrag ein (nur selbstverwaltete WEG, eigenes Objekt).
export async function submitMotion(formData: FormData) {
  const user = await requireUser();
  const org = await getOrganization();
  if (org?.accountType !== "selbstverwalter") redirect("/dashboard");

  const parsed = submitSchema.safeParse({
    propertyId: formData.get("propertyId"),
    title: formData.get("title"),
    description: formData.get("description"),
    type: formData.get("type") || undefined,
  });
  if (!parsed.success) redirect("/antraege?fehler=eingabe");

  // Nur Eigentümer des Objekts dürfen für dieses Objekt einreichen.
  if (!(await canVoteOnProperty(user.id, parsed.data.propertyId))) {
    redirect("/antraege?fehler=eingabe");
  }
  // Anträge gibt es nur für WEG-Objekte der eigenen Organisation.
  const property = await db.property.findFirst({
    where: { id: parsed.data.propertyId, organizationId: user.organizationId },
    select: { managementType: true },
  });
  if (!property || property.managementType !== "WEG") redirect("/antraege?fehler=keinweg");

  await db.ownerMotion.create({
    data: {
      organizationId: user.organizationId,
      propertyId: parsed.data.propertyId,
      submittedById: user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      type: parsed.data.type,
    },
  });
  revalidatePath("/antraege");
  redirect("/antraege?eingereicht=1");
}

// Lädt einen Antrag und stellt sicher, dass der Verwalter das Objekt
// administrieren darf und der Antrag noch offen (EINGEREICHT) ist.
async function loadOpenMotionForAdmin(verwalter: User, formData: FormData) {
  const motionId = String(formData.get("motionId") ?? "").trim();
  if (!motionId) return null;
  const motion = await db.ownerMotion.findFirst({
    where: {
      id: motionId,
      organizationId: verwalter.organizationId,
      status: "EINGEREICHT",
    },
    include: { submittedBy: { select: { name: true, email: true } } },
  });
  if (!motion) return null;
  if (!(await canAdministerProperty(verwalter, motion.propertyId))) return null;
  return { verwalter, motion };
}

// Beansprucht einen noch offenen Antrag atomar (EINGEREICHT → neuer Status).
// Verhindert Doppel-Entscheidungen (Doppelklick/zwei Verwalter): nur der erste
// updateMany trifft eine Zeile. Rückgabe: true = beansprucht, false = zu spät.
async function claimMotion(
  motionId: string,
  data: { status: "UEBERNOMMEN" | "ABGELEHNT"; decidedById: string; decisionNote?: string | null },
): Promise<boolean> {
  const res = await db.ownerMotion.updateMany({
    where: { id: motionId, status: "EINGEREICHT" },
    data: { ...data, decidedAt: new Date() },
  });
  return res.count === 1;
}

// Benachrichtigt den Einreicher über die Entscheidung zu seinem Antrag.
async function notifySubmitter(
  organizationId: string,
  email: string | null | undefined,
  subject: string,
  body: string,
) {
  if (!email) return;
  const branding = await getBrandingForOrg(organizationId);
  await sendMail(email, subject, body, undefined, branding).catch(() => {});
}

// Übernimmt einen Antrag als Umlaufbeschluss (vorhandene Abstimmlogik).
export async function adoptMotionAsResolution(formData: FormData) {
  const verwalter = await requireVerwalter();
  const loaded = await loadOpenMotionForAdmin(verwalter, formData);
  if (!loaded) redirect("/antraege");
  const { motion } = loaded;

  // Ein Verlangen einer Versammlung ist kein Beschlusstext – es kann nicht als
  // Umlaufbeschluss übernommen werden (nur auf eine Versammlung gesetzt werden).
  if (motion.type === "VERSAMMLUNG") redirect("/antraege?fehler=typ");

  // Antrag zuerst atomar beanspruchen (verhindert Doppel-Übernahme).
  if (!(await claimMotion(motion.id, { status: "UEBERNOMMEN", decidedById: verwalter.id }))) {
    redirect("/antraege");
  }

  const resolution = await db.resolution.create({
    data: {
      propertyId: motion.propertyId,
      title: motion.title,
      description: motion.description,
      createdById: verwalter.id,
      organizationId: verwalter.organizationId,
    },
  });

  // resolutionId am (bereits beanspruchten) Antrag nachtragen.
  await db.ownerMotion.update({
    where: { id: motion.id },
    data: { resolutionId: resolution.id },
  });

  // Eigentümer über die neue Abstimmung informieren (wie bei createResolution).
  const owners = await db.ownership.findMany({
    where: { propertyId: motion.propertyId },
    include: { user: { select: { email: true } } },
  });
  const link = portalUrl("/beschluesse");
  const branding = await getBrandingForOrg(verwalter.organizationId);
  await Promise.all(
    owners.map((o) =>
      sendMail(
        o.user.email,
        `Neue Abstimmung: ${motion.title}`,
        `Aus einem Eigentümer-Antrag wurde ein Umlaufbeschluss zur Abstimmung erstellt:\n\n` +
          `${motion.title}\n\n` +
          `Bitte stimmen Sie im Portal ab: ${link}`,
        undefined,
        branding,
      ).catch(() => {}),
    ),
  );

  revalidatePath("/antraege");
  revalidatePath("/beschluesse");
  redirect("/antraege?uebernommen=1");
}

// Fügt einen Antrag als Tagesordnungspunkt einer bestehenden Versammlung hinzu.
export async function adoptMotionToMeeting(formData: FormData) {
  const verwalter = await requireVerwalter();
  const loaded = await loadOpenMotionForAdmin(verwalter, formData);
  if (!loaded) redirect("/antraege");
  const { motion } = loaded;

  const meetingId = String(formData.get("meetingId") ?? "").trim();
  if (!meetingId) redirect("/antraege?fehler=versammlung");
  // Versammlung muss zur eigenen Org, zum selben Objekt und noch planbar sein.
  const meeting = await db.ownersMeeting.findFirst({
    where: {
      id: meetingId,
      organizationId: verwalter.organizationId,
      propertyId: motion.propertyId,
      status: { in: ["GEPLANT", "EINBERUFEN"] },
    },
    select: { id: true },
  });
  if (!meeting) redirect("/antraege?fehler=versammlung");

  // Antrag zuerst atomar beanspruchen (verhindert Doppel-Übernahme).
  if (!(await claimMotion(motion.id, { status: "UEBERNOMMEN", decidedById: verwalter.id }))) {
    redirect("/antraege");
  }

  const isBeschluss = motion.type === "BESCHLUSSANTRAG";

  // Beschluss-TOP: verknüpften Beschluss (OFFEN) anlegen.
  let resolutionId: string | null = null;
  if (isBeschluss) {
    const resolution = await db.resolution.create({
      data: {
        propertyId: motion.propertyId,
        title: motion.title,
        description: motion.description,
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
      data: {
        meetingId,
        sortOrder: nextSort,
        title: motion.title,
        description: motion.description,
        type: isBeschluss ? "BESCHLUSS" : "INFO",
        resolutionId,
      },
    });
  });

  // Verknüpfungen (Versammlung + ggf. Beschluss) am Antrag nachtragen.
  await db.ownerMotion.update({
    where: { id: motion.id },
    data: { meetingId, resolutionId },
  });

  await notifySubmitter(
    verwalter.organizationId,
    motion.submittedBy.email,
    `Ihr Antrag wurde auf die Tagesordnung gesetzt: ${motion.title}`,
    `Guten Tag,\n\nIhr Antrag „${motion.title}" wurde als Tagesordnungspunkt einer ` +
      `Eigentümerversammlung aufgenommen.\n\nDetails im Portal: ${portalUrl("/versammlungen")}`,
  );

  revalidatePath("/antraege");
  revalidatePath(`/versammlungen/${meetingId}`);
  redirect("/antraege?uebernommen=1");
}

// Lehnt einen Antrag ab (mit Begründung) und informiert den Einreicher.
export async function rejectMotion(formData: FormData) {
  const verwalter = await requireVerwalter();
  const loaded = await loadOpenMotionForAdmin(verwalter, formData);
  if (!loaded) redirect("/antraege");
  const { motion } = loaded;

  const note = String(formData.get("note") ?? "").trim().slice(0, 2000) || null;

  // Atomar beanspruchen (verhindert Ablehnung eines bereits übernommenen Antrags).
  if (!(await claimMotion(motion.id, { status: "ABGELEHNT", decidedById: verwalter.id, decisionNote: note }))) {
    redirect("/antraege");
  }

  await notifySubmitter(
    verwalter.organizationId,
    motion.submittedBy.email,
    `Ihr Antrag wurde abgelehnt: ${motion.title}`,
    `Guten Tag,\n\nIhr Antrag „${motion.title}" wurde nicht übernommen.\n\n` +
      (note ? `Begründung: ${note}\n\n` : "") +
      `Bei Rückfragen wenden Sie sich bitte an die Verwaltung.`,
  );

  revalidatePath("/antraege");
  redirect("/antraege?abgelehnt=1");
}
