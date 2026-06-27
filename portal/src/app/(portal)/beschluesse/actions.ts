"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canVerwalterAccessProperty } from "@/lib/access";
import { db } from "@/lib/db";
import { getBrandingForOrg } from "@/lib/branding-server";
import { portalUrl, sendMail } from "@/lib/mailer";
import { requireUser, requireVerwalter } from "@/lib/session";

const createSchema = z.object({
  propertyId: z.string().min(1),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(3).max(5000),
  deadline: z.string().optional(),
});

export async function createResolution(formData: FormData) {
  const user = await requireVerwalter();
  const parsed = createSchema.safeParse({
    propertyId: formData.get("propertyId"),
    title: formData.get("title"),
    description: formData.get("description"),
    deadline: formData.get("deadline") || undefined,
  });
  if (!parsed.success) {
    redirect("/beschluesse?fehler=eingabe");
  }

  // Scope-Prüfung: nur Objekte im Zuständigkeitsbereich des Verwalters
  if (!(await canVerwalterAccessProperty(user, parsed.data.propertyId))) {
    redirect("/beschluesse?fehler=eingabe");
  }

  // Umlaufbeschlüsse gibt es nur für WEG-Objekte, nicht für Mietverwaltung
  const property = await db.property.findUnique({ where: { id: parsed.data.propertyId } });
  if (!property || property.managementType !== "WEG") {
    redirect("/beschluesse?fehler=keinweg");
  }

  const deadline = parsed.data.deadline ? new Date(parsed.data.deadline) : null;

  const resolution = await db.resolution.create({
    data: {
      propertyId: parsed.data.propertyId,
      title: parsed.data.title,
      description: parsed.data.description,
      deadline: deadline && !Number.isNaN(deadline.getTime()) ? deadline : null,
      createdById: user.id,
      organizationId: user.organizationId,
    },
  });

  // Eigentümer des Objekts per E-Mail über die Abstimmung informieren
  const owners = await db.ownership.findMany({
    where: { propertyId: parsed.data.propertyId },
    include: { user: true },
  });
  const link = portalUrl("/beschluesse");
  const branding = await getBrandingForOrg(user.organizationId);
  await Promise.all(
    owners.map((o) =>
      sendMail(
        o.user.email,
        `Neue Abstimmung: ${parsed.data.title}`,
        `Es liegt ein neuer Umlaufbeschluss zur Abstimmung vor:\n\n` +
          `„${parsed.data.title}"\n\n` +
          `Bitte stimmen Sie im Portal ab: ${link}`,
        undefined,
        branding
      )
    )
  );

  revalidatePath("/beschluesse");
  redirect(`/beschluesse#${resolution.id}`);
}

export async function castVote(formData: FormData) {
  const user = await requireUser();
  const resolutionId = String(formData.get("resolutionId") ?? "");
  const choiceRaw = String(formData.get("choice") ?? "");
  const comment = String(formData.get("comment") ?? "").trim().slice(0, 1000) || null;

  if (!["JA", "NEIN", "ENTHALTUNG"].includes(choiceRaw)) {
    redirect("/beschluesse");
  }
  const choice = choiceRaw as "JA" | "NEIN" | "ENTHALTUNG";

  const resolution = await db.resolution.findUnique({ where: { id: resolutionId } });
  if (!resolution || resolution.status !== "OFFEN") redirect("/beschluesse");

  // Nur Eigentümer des betreffenden Objekts dürfen abstimmen
  const ownership = await db.ownership.findFirst({
    where: { userId: user.id, propertyId: resolution.propertyId },
  });
  if (!ownership && user.role !== "VERWALTER") redirect("/beschluesse");
  if (!ownership) redirect("/beschluesse"); // Verwalter ohne Eigentum stimmt nicht ab

  await db.resolutionVote.upsert({
    where: { resolutionId_userId: { resolutionId, userId: user.id } },
    create: { resolutionId, userId: user.id, choice, comment },
    update: { choice, comment },
  });

  revalidatePath("/beschluesse");
  redirect(`/beschluesse#${resolutionId}`);
}

export async function closeResolution(formData: FormData) {
  const user = await requireVerwalter();
  const id = String(formData.get("id") ?? "");
  const resolution = await db.resolution.findUnique({
    where: { id },
    include: { votes: true },
  });
  if (!resolution || resolution.status !== "OFFEN") redirect("/beschluesse");
  if (!(await canVerwalterAccessProperty(user, resolution.propertyId))) redirect("/beschluesse");

  const ja = resolution.votes.filter((v) => v.choice === "JA").length;
  const nein = resolution.votes.filter((v) => v.choice === "NEIN").length;
  const status = ja > nein ? "ANGENOMMEN" : "ABGELEHNT";

  // Laufende Nummer für die Beschlusssammlung vergeben (pro Mandant getrennt)
  const decidedCount = await db.resolution.count({
    where: { number: { not: null }, organizationId: user.organizationId },
  });

  await db.resolution.update({
    where: { id },
    data: { status, decidedAt: new Date(), number: decidedCount + 1 },
  });
  revalidatePath("/beschluesse");
  redirect(`/beschluesse#${id}`);
}

export async function withdrawResolution(formData: FormData) {
  const user = await requireVerwalter();
  const id = String(formData.get("id") ?? "");
  const resolution = await db.resolution.findUnique({ where: { id } });
  if (
    resolution &&
    resolution.status === "OFFEN" &&
    (await canVerwalterAccessProperty(user, resolution.propertyId))
  ) {
    await db.resolution.update({
      where: { id },
      data: { status: "ZURUECKGEZOGEN", decidedAt: new Date() },
    });
  }
  revalidatePath("/beschluesse");
  redirect("/beschluesse");
}

export async function deleteResolution(formData: FormData) {
  const user = await requireVerwalter();
  const id = String(formData.get("id") ?? "");
  if (id) {
    // Scope-Prüfung vor dem Löschen (verhindert objektübergreifendes Löschen)
    const resolution = await db.resolution.findUnique({
      where: { id },
      select: { propertyId: true },
    });
    if (resolution && (await canVerwalterAccessProperty(user, resolution.propertyId))) {
      await db.resolution.delete({ where: { id } }).catch(() => {});
    }
  }
  revalidatePath("/beschluesse");
  redirect("/beschluesse");
}
