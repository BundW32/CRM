"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canVerwalterAccessProperty, canVoteOnProperty } from "@/lib/access";
import { db } from "@/lib/db";
import { getBrandingForOrg } from "@/lib/branding-server";
import { portalUrl, sendMail } from "@/lib/mailer";
import { requireUser, requireVerwalter } from "@/lib/session";
import { DOCUMENT_TYPES, deleteBlob, saveUpload } from "@/lib/storage";

const MAJORITIES = ["EINFACH", "DREIVIERTEL", "DOPPELT_QUALIFIZIERT", "ALLSTIMMIG"] as const;

const createSchema = z.object({
  propertyId: z.string().min(1),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(3).max(5000),
  deadline: z.string().optional(),
  // Umlaufbeschluss: Allstimmigkeit ist der gesetzliche Regelfall (§ 23 Abs. 3
  // Satz 1 WEG) — im Umlauf müssen ALLE zustimmen, nicht die Mehrheit. Der
  // Rückfall darf deshalb nicht „EINFACH" sein: Ein fehlendes Feld erzeugte
  // sonst still einen Beschluss, der die gesetzliche Hürde verfehlt und
  // angreifbar ist. Eine geringere Mehrheit ist nur mit vorherigem
  // Absenkungsbeschluss zulässig (§ 23 Abs. 3 Satz 2) — sie muss also bewusst
  // gewählt werden.
  majority: z.enum(MAJORITIES).default("ALLSTIMMIG"),
});

export async function createResolution(formData: FormData) {
  const user = await requireVerwalter();
  const parsed = createSchema.safeParse({
    propertyId: formData.get("propertyId"),
    title: formData.get("title"),
    description: formData.get("description"),
    deadline: formData.get("deadline") || undefined,
    majority: formData.get("majority") || undefined,
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
  // Fristen in der Vergangenheit sind sinnlos (es könnte nie abgestimmt werden).
  if (deadline && !Number.isNaN(deadline.getTime()) && deadline < new Date()) {
    redirect("/beschluesse?fehler=frist");
  }

  const resolution = await db.resolution.create({
    data: {
      propertyId: parsed.data.propertyId,
      title: parsed.data.title,
      description: parsed.data.description,
      majority: parsed.data.majority,
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

/**
 * Gehört dieser Beschluss zu einer noch bevorstehenden Versammlung?
 *
 * Ein Beschluss-Tagesordnungspunkt legt sofort einen offenen Beschluss an. Über ihn
 * wird aber in der Versammlung abgestimmt (§ 23 Abs. 1 WEG) und nicht vorab im
 * Portal – der Umlaufbeschluss ist ein eigenes Verfahren mit eigenen Anforderungen
 * (§ 23 Abs. 3 WEG). Ohne diese Prüfung ließe sich die Sperre umgehen, indem man
 * das Formular einer laufenden Abstimmung auf eine andere Beschluss-Id umbiegt.
 *
 * Nach der Versammlung greift die Sperre nicht mehr: Dann trägt die Verwaltung das
 * dort gefasste Ergebnis ein.
 */
async function istVersammlungsBeschluss(resolutionId: string): Promise<boolean> {
  const top = await db.meetingAgendaItem.findFirst({
    where: {
      resolutionId,
      meeting: { status: { in: ["GEPLANT", "EINBERUFEN"] } },
    },
    select: { id: true },
  });
  return top !== null;
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
  // Mandanten-Wand: nur Beschlüsse der eigenen Organisation.
  if (resolution.organizationId !== user.organizationId) redirect("/beschluesse");

  // Frist hart durchsetzen: nach Ablauf keine Stimmabgabe/-änderung mehr.
  if (resolution.deadline && resolution.deadline < new Date()) {
    redirect(`/beschluesse?fehler=frist#${resolutionId}`);
  }

  if (await istVersammlungsBeschluss(resolutionId)) {
    redirect(`/beschluesse?fehler=versammlung#${resolutionId}`);
  }

  // Stimmberechtigt ist ausschließlich, wer Eigentümer des Objekts ist
  // (rollenunabhängig: auch der interne Verwalter, sofern er Eigentum hält).
  if (!(await canVoteOnProperty(user.id, resolution.propertyId))) redirect("/beschluesse");

  // Stimme schreiben und den Status DANACH erneut prüfen (in einer Transaktion):
  // Schließt der Verwalter den Beschluss zwischen unserer Statusprüfung oben und
  // dem Schreiben, sieht die Nachprüfung (READ COMMITTED) den neuen Status und
  // die Transaktion rollt die Stimme zurück – so kann keine Stimme mehr auf
  // einem bereits geschlossenen Beschluss landen und die im PDF festgehaltenen
  // Zählungen nachträglich verändern.
  let closedMeanwhile = false;
  try {
    await db.$transaction(async (tx) => {
      await tx.resolutionVote.upsert({
        where: { resolutionId_userId: { resolutionId, userId: user.id } },
        create: { resolutionId, userId: user.id, choice, comment },
        // Stimmt der Eigentümer selbst ab, ist ein früherer Stellvertreter-Vermerk
        // (inkl. Nachweis) gegenstandslos → zurücksetzen.
        update: {
          choice,
          comment,
          castByUserId: null,
          proofStoredName: null,
          proofFileName: null,
          proofMimeType: null,
        },
      });
      const still = await tx.resolution.findFirst({
        where: { id: resolutionId, status: "OFFEN" },
        select: { id: true },
      });
      if (!still) throw new Error("RESOLUTION_CLOSED");
    });
  } catch (err) {
    if (err instanceof Error && err.message === "RESOLUTION_CLOSED") {
      closedMeanwhile = true;
    } else {
      throw err;
    }
  }
  if (closedMeanwhile) redirect(`/beschluesse?fehler=geschlossen#${resolutionId}`);

  revalidatePath("/beschluesse");
  redirect(`/beschluesse#${resolutionId}?flash=gespeichert`);
}

// Stellvertretende Stimmabgabe durch den Verwalter (Notiz 8): trägt für einen
// Eigentümer, der die App nicht nutzt, dessen schriftliche Stimme ein – mit
// optionalem Nachweis (Bild/PDF des unterschriebenen Stimmzettels).
export async function castVoteForOwner(formData: FormData) {
  const verwalter = await requireVerwalter();
  const resolutionId = String(formData.get("resolutionId") ?? "");
  const ownerId = String(formData.get("ownerId") ?? "");
  const choiceRaw = String(formData.get("choice") ?? "");
  const comment = String(formData.get("comment") ?? "").trim().slice(0, 1000) || null;

  if (!["JA", "NEIN", "ENTHALTUNG"].includes(choiceRaw)) redirect("/beschluesse");
  const choice = choiceRaw as "JA" | "NEIN" | "ENTHALTUNG";

  const resolution = await db.resolution.findUnique({ where: { id: resolutionId } });
  if (!resolution || resolution.status !== "OFFEN") redirect("/beschluesse");
  if (resolution.organizationId !== verwalter.organizationId) redirect("/beschluesse");
  if (!(await canVerwalterAccessProperty(verwalter, resolution.propertyId))) redirect("/beschluesse");
  if (resolution.deadline && resolution.deadline < new Date()) {
    redirect(`/beschluesse?fehler=frist#${resolutionId}`);
  }
  if (await istVersammlungsBeschluss(resolutionId)) {
    redirect(`/beschluesse?fehler=versammlung#${resolutionId}`);
  }

  // Eingetragen werden darf nur für einen tatsächlichen Eigentümer des Objekts.
  if (!ownerId || !(await canVoteOnProperty(ownerId, resolution.propertyId))) {
    redirect(`/beschluesse?fehler=eigentuemer#${resolutionId}`);
  }

  // Optionaler Nachweis (Bild/PDF). Fehlerhafte Uploads brechen die Aktion ab.
  let proofStoredName: string | null = null;
  let proofFileName: string | null = null;
  let proofMimeType: string | null = null;
  const file = formData.get("proof");
  if (file instanceof File && file.size > 0) {
    const saved = await saveUpload(file, DOCUMENT_TYPES);
    proofStoredName = saved.storedName;
    proofFileName = saved.fileName;
    proofMimeType = saved.mimeType;
  }

  // Vorhandenen Nachweis merken, um ihn nach erfolgreichem Ersetzen zu löschen.
  const existing = await db.resolutionVote.findUnique({
    where: { resolutionId_userId: { resolutionId, userId: ownerId } },
    select: { proofStoredName: true },
  });

  let closedMeanwhile = false;
  try {
    await db.$transaction(async (tx) => {
      await tx.resolutionVote.upsert({
        where: { resolutionId_userId: { resolutionId, userId: ownerId } },
        create: {
          resolutionId,
          userId: ownerId,
          choice,
          comment,
          castByUserId: verwalter.id,
          proofStoredName,
          proofFileName,
          proofMimeType,
        },
        // Nachweis nur überschreiben, wenn ein neuer hochgeladen wurde.
        update: {
          choice,
          comment,
          castByUserId: verwalter.id,
          ...(proofStoredName ? { proofStoredName, proofFileName, proofMimeType } : {}),
        },
      });
      const still = await tx.resolution.findFirst({
        where: { id: resolutionId, status: "OFFEN" },
        select: { id: true },
      });
      if (!still) throw new Error("RESOLUTION_CLOSED");
    });
  } catch (err) {
    if (err instanceof Error && err.message === "RESOLUTION_CLOSED") {
      closedMeanwhile = true;
    } else {
      throw err;
    }
  }
  if (closedMeanwhile) {
    // Hochgeladenen (nun verwaisten) Nachweis wieder entfernen.
    if (proofStoredName) await deleteBlob(proofStoredName);
    redirect(`/beschluesse?fehler=geschlossen#${resolutionId}`);
  }
  // Alten Nachweis erst nach erfolgreichem Ersetzen löschen.
  if (proofStoredName && existing?.proofStoredName && existing.proofStoredName !== proofStoredName) {
    await deleteBlob(existing.proofStoredName);
  }

  revalidatePath("/beschluesse");
  redirect(`/beschluesse#${resolutionId}?flash=gespeichert`);
}

export async function closeResolution(formData: FormData) {
  const user = await requireVerwalter();
  const id = String(formData.get("id") ?? "");
  const resolution = await db.resolution.findUnique({
    where: { id },
    select: { id: true, status: true, propertyId: true },
  });
  if (!resolution || resolution.status !== "OFFEN") redirect("/beschluesse");
  if (!(await canVerwalterAccessProperty(user, resolution.propertyId))) redirect("/beschluesse");

  // Das Ergebnis MUSS vom Verwalter ausdrücklich festgestellt werden (die
  // Oberfläche schlägt es anhand Stimmprinzip + Mehrheit vor). Kein Fallback auf
  // Kopf-Mehrheit – der würde Mehrheitstyp und Stimmprinzip ignorieren.
  const confirmed = String(formData.get("result") ?? "");
  if (confirmed !== "ANGENOMMEN" && confirmed !== "ABGELEHNT") {
    redirect(`/beschluesse?fehler=ergebnis#${id}`);
  }
  const status: "ANGENOMMEN" | "ABGELEHNT" = confirmed;

  // Laufende Nummer für die Beschluss-Sammlung vergeben – fortlaufend PRO OBJEKT
  // (§ 24 Abs. 7 WEG: je WEG eine eigene Sammlung). Zählen + Schreiben atomar in
  // einer Transaktion; der Unique-Index [propertyId, number] verhindert Doppel-
  // nummern (Prisma-Transaktionen laufen auf READ COMMITTED, daher können zwei
  // gleichzeitige Schließungen dieselbe Nummer lesen) – bei P2002 neu versuchen.
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      await db.$transaction(async (tx) => {
        const current = await tx.resolution.findFirst({
          where: { id, status: "OFFEN" },
          select: { id: true },
        });
        if (!current) return; // zwischenzeitlich bereits geschlossen
        const last = await tx.resolution.findFirst({
          where: { propertyId: resolution.propertyId, number: { not: null } },
          orderBy: { number: "desc" },
          select: { number: true },
        });
        const nextNumber = (last?.number ?? 0) + 1;
        await tx.resolution.update({
          where: { id },
          data: { status, decidedAt: new Date(), number: nextNumber },
        });
      });
      break; // erfolgreich (oder bereits geschlossen) – keine Wiederholung
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "P2002" && attempt < 3) continue; // Nummer-Kollision → neu vergeben
      throw err;
    }
  }
  revalidatePath("/beschluesse");
  redirect(`/beschluesse#${id}?flash=gespeichert`);
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
  redirect("/beschluesse?flash=gespeichert");
}

export async function deleteResolution(formData: FormData) {
  const user = await requireVerwalter();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/beschluesse");

  const resolution = await db.resolution.findUnique({
    where: { id },
    select: { propertyId: true, status: true, number: true },
  });
  if (!resolution || !(await canVerwalterAccessProperty(user, resolution.propertyId))) {
    redirect("/beschluesse");
  }
  // Ein bereits gefasster Beschluss (ANGENOMMEN/ABGELEHNT, hat eine laufende
  // Nummer) darf NICHT gelöscht werden – §24 VII WEG verlangt eine stabile,
  // lückenlose Beschluss-Sammlung, und ein Löschen würde die Nummer wiederverwenden.
  if (resolution.number != null || (resolution.status !== "OFFEN" && resolution.status !== "ZURUECKGEZOGEN")) {
    redirect("/beschluesse?fehler=gefasst");
  }
  await db.resolution.delete({ where: { id } });
  revalidatePath("/beschluesse");
  redirect("/beschluesse?flash=geloescht");
}
