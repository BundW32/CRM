"use server";

import bcrypt from "bcryptjs";
import crypto from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { User } from "@/generated/prisma/client";
import { canVerwalterManageUser, propertyIdsForVerwalter } from "@/lib/access";
import { generatePassword, generateUsername } from "@/lib/credentials";
import { db } from "@/lib/db";
import { getBrandingForOrg } from "@/lib/branding-server";
import { portalUrlFromRequest, sendMail } from "@/lib/mailer";
import { requireVerwalter } from "@/lib/session";
import { IMAGE_TYPES, deleteBlob, saveBuffer } from "@/lib/storage";
import { errorMessage, isNextControlFlowError } from "@/lib/errors";
import { AUDIT, logAudit } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

// ── Rücksprung ──────────────────────────────────────────────────────
// Dieselben Aktionen laufen von zwei Oberflächen: der Nutzerliste und der
// Kontakt-Detailseite. Ohne mitgeführten Pfad landete man nach dem Speichern
// immer in der Nutzerliste – auch wenn man von einem Kontakt kam.
//
// Der Wert kommt aus einem versteckten Formularfeld, wird aber NICHT blind
// übernommen: Nur die beiden bekannten Muster sind erlaubt, sonst könnte über
// ein untergeschobenes Feld auf eine fremde Adresse weitergeleitet werden.
const ZURUECK_ERLAUBT = /^\/verwaltung\/(nutzer|kontakte(\/[A-Za-z0-9_-]+)?)$/;

function zurueckZu(formData: FormData, suffix = ""): string {
  const raw = String(formData.get("zurueck") ?? "").trim();
  const base = ZURUECK_ERLAUBT.test(raw) ? raw : "/verwaltung/nutzer";
  return base + suffix;
}

// ── Scope-Wächter ───────────────────────────────────────────────────
// Eingeschränkte Verwalter (kein SuperAdmin) dürfen nur Nutzer/Objekte
// im eigenen Zuständigkeitsbereich berühren. Verstößt eine Aktion dagegen,
// wird kommentarlos zur Nutzerliste zurückgeleitet.
async function ensureCanManageUser(actor: User, targetUserId: string) {
  if (!(await canVerwalterManageUser(actor, targetUserId))) {
    redirect("/verwaltung/nutzer");
  }
}

async function ensurePropertyInScope(actor: User, propertyId: string) {
  // Mandanten-Wand IMMER prüfen – auch für SuperAdmin (sonst ließe sich ein
  // Objekt einer fremden Org zuordnen). Danach die Zuweisungs-Beschränkung.
  const prop = await db.property.findUnique({
    where: { id: propertyId },
    select: { organizationId: true },
  });
  if (!prop || prop.organizationId !== actor.organizationId) redirect("/verwaltung/nutzer");
  const ids = await propertyIdsForVerwalter(actor);
  if (ids !== null && !ids.includes(propertyId)) redirect("/verwaltung/nutzer");
}

async function ensureUnitInScope(actor: User, unitId: string) {
  // Org der Einheit (über das Objekt) IMMER prüfen – auch für SuperAdmin.
  const unit = await db.unit.findUnique({
    where: { id: unitId },
    select: { propertyId: true, property: { select: { organizationId: true } } },
  });
  if (!unit || unit.property.organizationId !== actor.organizationId) redirect("/verwaltung/nutzer");
  const ids = await propertyIdsForVerwalter(actor);
  if (ids !== null && !ids.includes(unit.propertyId)) redirect("/verwaltung/nutzer");
}

// Der Begünstigte (z. B. neuer Eigentümer/Mieter) muss zur selben Organisation
// gehören. canVerwalterManageUser greift hier NICHT, weil ein noch nicht
// zugeordneter Nutzer erst DURCH diese Aktion in den Scope kommt – daher
// genügt (und gilt) der reine Mandanten-Abgleich.
async function ensureUserInOrg(actor: User, userId: string) {
  const target = await db.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });
  if (!target || target.organizationId !== actor.organizationId) redirect("/verwaltung/nutzer");
}

// Anschrift (Eigentümer = Wohnungsgeber) und Unterschriftsbild für Bescheinigungen
export async function uploadStammdaten(formData: FormData) {
  // Alles in einem äußeren try/catch, damit niemals die generische
  // „This page couldn't load"-Seite erscheint, sondern eine konkrete Meldung.
  try {
    const actor = await requireVerwalter();
    const id = String(formData.get("id") ?? "");
    await ensureCanManageUser(actor, id);
    const user = await db.user.findUnique({ where: { id } });
    if (!user) redirect(zurueckZu(formData));

    const data: {
      street: string | null;
      zip: string | null;
      city: string | null;
      signatureStoredName?: string;
    } = {
      street: String(formData.get("street") ?? "").trim().slice(0, 200) || null,
      zip: String(formData.get("zip") ?? "").trim().slice(0, 20) || null,
      city: String(formData.get("city") ?? "").trim().slice(0, 100) || null,
    };

    const signatureDataUrl = String(formData.get("signatureDataUrl") ?? "").trim();
    const DATA_URL_PREFIX = "data:image/png;base64,";
    if (signatureDataUrl.startsWith(DATA_URL_PREFIX)) {
      const base64 = signatureDataUrl.slice(DATA_URL_PREFIX.length);
      const buffer = Buffer.from(base64, "base64");
      if (buffer.byteLength > 0) {
        if (user.signatureStoredName) await deleteBlob(user.signatureStoredName);
        const upload = await saveBuffer(buffer, "unterschrift.png", "image/png", IMAGE_TYPES);
        data.signatureStoredName = upload.storedName;
      }
    }

    await db.user.update({ where: { id }, data });
    revalidatePath("/verwaltung/nutzer");
    redirect(zurueckZu(formData, "?stammdaten=1"));
  } catch (e) {
    if (isNextControlFlowError(e)) throw e; // redirect()/notFound() durchlassen
    redirect(zurueckZu(formData, `?fehler=stammdaten&msg=${encodeURIComponent(errorMessage(e))}`));
  }
}

const userSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  salutation: z.string().trim().optional(),
  email: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
  // Kein HANDWERKER: Handwerker haben kein Portalkonto (Magic-Link per E-Mail).
  // Der Rollenwert bleibt im Datenmodell für Altbestände erhalten, ist aber nicht
  // mehr anlegbar – serverseitig durchgesetzt, nicht nur im Formular.
  role: z.enum(["VERWALTER", "EIGENTUEMER", "MIETER"]),
  phone: z.string().trim().max(50).optional(),
  preferredContact: z.enum(["EMAIL", "TELEFON", "MOBIL", "POST"]).optional().or(z.literal("")),
  unitId: z.string().optional(),
  propertyId: z.string().optional(),
  method: z.enum(["email", "schreiben"]),
});

function pcOrNull(v: string | undefined | null) {
  return v && v !== "" ? (v as "EMAIL" | "TELEFON" | "MOBIL" | "POST") : null;
}

async function assignRole(
  userId: string,
  role: string,
  unitId?: string,
  propertyId?: string
) {
  if (role === "MIETER" && unitId) {
    await db.tenancy.create({ data: { userId, unitId } });
  }
  if (role === "EIGENTUEMER" && propertyId) {
    await db.ownership.create({ data: { userId, propertyId } });
  }
}

export async function createUser(formData: FormData) {
  const actor = await requireVerwalter();

  const parsed = userSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    salutation: formData.get("salutation") || undefined,
    email: formData.get("email") || undefined,
    role: formData.get("role"),
    phone: formData.get("phone") || undefined,
    preferredContact: formData.get("preferredContact") || undefined,
    unitId: formData.get("unitId") || undefined,
    propertyId: formData.get("propertyId") || undefined,
    method: formData.get("method") || "email",
  });
  if (!parsed.success) {
    redirect(zurueckZu(formData, "?fehler=eingabe"));
  }

  // Eingeschränkte Verwalter dürfen nur Mieter/Eigentümer im eigenen
  // Zuständigkeitsbereich anlegen – keine Verwalter/Handwerker.
  if (!actor.isSuperAdmin) {
    if (parsed.data.role !== "MIETER" && parsed.data.role !== "EIGENTUEMER") {
      redirect(zurueckZu(formData, "?fehler=eingabe"));
    }
  }
  // Mandanten-Wand für Ziel-Objekt/-Einheit IMMER (auch SuperAdmin): verhindert,
  // dass ein neuer Mieter/Eigentümer an ein Objekt einer fremden Org gehängt wird.
  if (parsed.data.unitId) await ensureUnitInScope(actor, parsed.data.unitId);
  if (parsed.data.propertyId) await ensurePropertyInScope(actor, parsed.data.propertyId);

  const email = parsed.data.email && parsed.data.email !== "" ? parsed.data.email : null;
  const name = `${parsed.data.firstName} ${parsed.data.lastName}`.trim();

  // E-Mail-Einladung setzt eine E-Mail-Adresse voraus
  if (parsed.data.method === "email" && !email) {
    redirect(zurueckZu(formData, "?fehler=email_fehlt"));
  }
  if (email) {
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      redirect(zurueckZu(formData, "?fehler=email"));
    }
  }

  // ── Variante A: Einladung per E-Mail ──────────────────────────────
  if (parsed.data.method === "email") {
    const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12);
    const inviteToken = crypto.randomBytes(32).toString("hex");
    const inviteExpiry = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

    const user = await db.user.create({
      data: {
        name,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        salutation: parsed.data.salutation || null,
        email,
        phone: parsed.data.phone,
        preferredContact: pcOrNull(parsed.data.preferredContact),
        role: parsed.data.role,
        passwordHash,
        passwordResetToken: inviteToken,
        passwordResetExpiry: inviteExpiry,
        organizationId: actor.organizationId,
      },
    });
    await assignRole(user.id, parsed.data.role, parsed.data.unitId, parsed.data.propertyId);

    const link = await portalUrlFromRequest(`/login/reset/${inviteToken}?einladung=1`);
    const loginLink = await portalUrlFromRequest("/login");
    const greeting =
      parsed.data.salutation === "Herr"
        ? `Sehr geehrter Herr ${parsed.data.lastName},`
        : parsed.data.salutation === "Frau"
        ? `Sehr geehrte Frau ${parsed.data.lastName},`
        : `Guten Tag ${name},`;
    const branding = await getBrandingForOrg(actor.organizationId);
    await sendMail(
      email!,
      "Ihr Zugang zum Kundenportal",
      `${greeting}\n\n` +
        `Sie wurden zum Kundenportal der ${branding.legalName} eingeladen.\n\n` +
        `Klicken Sie auf folgenden Link, um Ihren Zugang einzurichten (gültig 7 Tage):\n` +
        `${link}\n\n` +
        `Nach der Einrichtung können Sie sich jederzeit unter ${loginLink} anmelden.\n\n` +
        `Mit freundlichen Grüßen\n${branding.legalName}`,
      undefined,
      branding
    );

    revalidatePath("/verwaltung/nutzer");
    redirect(zurueckZu(formData, "?eingeladen=1"));
  }

  // ── Variante B: Zugangsschreiben zum Ausdrucken ───────────────────
  // Erst-Passwort wird generiert, muss bei der ersten Anmeldung geändert werden.
  const tempPassword = generatePassword(10);
  const username = email ? null : await generateUsername(name);

  const user = await db.user.create({
    data: {
      name,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      salutation: parsed.data.salutation || null,
      email,
      username,
      phone: parsed.data.phone,
      preferredContact: pcOrNull(parsed.data.preferredContact),
      role: parsed.data.role,
      passwordHash: await bcrypt.hash(tempPassword, 12),
      mustChangePassword: true,
      organizationId: actor.organizationId,
    },
  });
  await assignRole(user.id, parsed.data.role, parsed.data.unitId, parsed.data.propertyId);

  revalidatePath("/verwaltung/nutzer");
  redirect(`/zugangsschreiben/${user.id}?pw=${encodeURIComponent(tempPassword)}`);
}

// DSGVO-Löschung durch Anonymisierung: personenbezogene Daten werden entfernt,
// referenzierte Vorgänge/Belege bleiben aus Dokumentationsgründen erhalten.
export async function anonymizeUser(formData: FormData) {
  const verwalter = await requireVerwalter();
  // DSGVO-Löschung ist unwiderruflich und rechtlich sensibel: nur SuperAdmin.
  if (!verwalter.isSuperAdmin) redirect(zurueckZu(formData));
  const id = String(formData.get("id") ?? "");
  if (!id || id === verwalter.id) {
    redirect(zurueckZu(formData));
  }
  const user = await db.user.findUnique({ where: { id } });
  if (!user) redirect(zurueckZu(formData));

  // DSGVO Art. 17: Blobs mit personenbezogenen Daten löschen
  if (user.signatureStoredName) {
    await deleteBlob(user.signatureStoredName);
  }
  const handoversWithPdf = await db.handover.findMany({
    where: { createdById: id, pdfStoredName: { not: null } },
    select: { id: true, pdfStoredName: true },
  });
  for (const h of handoversWithPdf) {
    if (h.pdfStoredName) {
      await deleteBlob(h.pdfStoredName);
      await db.handover.update({ where: { id: h.id }, data: { pdfStoredName: null } });
    }
  }

  const ip = await getClientIp();
  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.USER_ANONYMIZED,
    targetType: "User",
    targetId: id,
    // DSGVO: keine Klardaten des Gelöschten dauerhaft im Audit-Log speichern.
    meta: { targetUserId: id },
    ip,
  });

  await db.$transaction([
    db.acknowledgement.deleteMany({ where: { userId: id } }),
    db.conversationParticipant.deleteMany({ where: { userId: id } }),
    // Verwaiste Eigentümer-/Mietverhältnisse entfernen: ein gelöschter Nutzer soll
    // nicht länger als „Gelöschter Nutzer" in Eigentümer-/Kontaktlisten erscheinen.
    db.ownership.deleteMany({ where: { userId: id } }),
    db.tenancy.deleteMany({ where: { userId: id } }),
    // Interne Notizen ÜBER die gelöschte Person entfernen.
    db.note.deleteMany({ where: { targetUserId: id } }),
    db.user.update({
      where: { id },
      data: {
        name: "Gelöschter Nutzer",
        firstName: null,
        lastName: null,
        salutation: null,
        email: null,
        username: null,
        phone: null,
        preferredContact: null,
        street: null,
        zip: null,
        city: null,
        active: false,
        anonymizedAt: new Date(),
        mustChangePassword: false,
        passwordResetToken: null,
        passwordResetExpiry: null,
        signatureStoredName: null,
        passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12),
      },
    }),
  ]);

  // DSGVO Art. 17: In Wohnungsübergabe-Protokollen werden Personendaten als
  // Freitext-Schnappschuss gespeichert (kein Fremdschlüssel auf den Nutzer). Diese
  // Kopien anhand der (jetzt gelöschten) E-Mail-Adresse mitlöschen – je Rolle nur die
  // Felder, deren E-Mail übereinstimmt.
  const oldEmail = user.email;
  if (oldEmail) {
    const org = user.organizationId;
    await db.$transaction([
      db.handover.updateMany({
        where: { organizationId: org, tenantEmail: oldEmail },
        data: {
          tenantName: null,
          tenantEmail: null,
          tenantPhone: null,
          tenantAddress: null,
          tenantBirthDate: null,
          tenantSignature: null,
          // Zweiter Mieter im selben Protokoll (kein eigenes E-Mail-Feld) mitlöschen.
          tenant2Name: null,
          tenant2BirthDate: null,
          tenant2Signature: null,
        },
      }),
      db.handover.updateMany({
        where: { organizationId: org, ownerEmail: oldEmail },
        data: { ownerName: null, ownerEmail: null, ownerPhone: null },
      }),
      db.handover.updateMany({
        where: { organizationId: org, managerEmail: oldEmail },
        data: { managerName: null, managerEmail: null, managerPhone: null },
      }),
    ]);
  }

  revalidatePath("/verwaltung/nutzer");
  redirect(zurueckZu(formData, "?anonymisiert=1"));
}

export async function toggleUserActive(formData: FormData) {
  const verwalter = await requireVerwalter();
  const id = String(formData.get("id") ?? "");
  if (id && id !== verwalter.id) {
    await ensureCanManageUser(verwalter, id);
    const user = await db.user.findUnique({ where: { id } });
    if (user) {
      await db.user.update({ where: { id }, data: { active: !user.active } });
    }
  }
  revalidatePath("/verwaltung/nutzer");
  redirect(zurueckZu(formData));
}

export async function resendInvite(formData: FormData) {
  const actor = await requireVerwalter();
  const id = String(formData.get("id") ?? "");
  await ensureCanManageUser(actor, id);
  const user = await db.user.findUnique({ where: { id } });
  if (!user || !user.active || !user.email) redirect(zurueckZu(formData));

  const inviteToken = crypto.randomBytes(32).toString("hex");
  const inviteExpiry = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
  await db.user.update({
    where: { id },
    data: { passwordResetToken: inviteToken, passwordResetExpiry: inviteExpiry },
  });

  const link = await portalUrlFromRequest(`/login/reset/${inviteToken}?einladung=1`);
  const branding = await getBrandingForOrg(user.organizationId);
  await sendMail(
    user.email,
    "Ihr Zugang zum Kundenportal (Erinnerung)",
    `Guten Tag ${user.name},\n\n` +
      `Hier ist Ihr Einladungslink zum Kundenportal (gültig 7 Tage):\n` +
      `${link}\n\n` +
      `Mit freundlichen Grüßen\n${branding.legalName}`,
    undefined,
    branding
  );

  revalidatePath("/verwaltung/nutzer");
  redirect(zurueckZu(formData, "?eingeladen=1"));
}

export async function addOwnership(formData: FormData) {
  const actor = await requireVerwalter();
  const userId = String(formData.get("userId") ?? "").trim();
  const propertyId = String(formData.get("propertyId") ?? "").trim();
  if (!userId || !propertyId) redirect(zurueckZu(formData));
  await ensurePropertyInScope(actor, propertyId);
  await ensureUserInOrg(actor, userId); // Begünstigte userId validieren (deferred-fix)
  await db.ownership.upsert({
    where: { userId_propertyId: { userId, propertyId } },
    create: { userId, propertyId },
    update: {},
  });
  revalidatePath("/verwaltung/nutzer");
  redirect(zurueckZu(formData));
}

export async function removeOwnership(formData: FormData) {
  const actor = await requireVerwalter();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect(zurueckZu(formData));
  const ownership = await db.ownership.findUnique({ where: { id }, select: { propertyId: true } });
  if (!ownership) redirect(zurueckZu(formData));
  await ensurePropertyInScope(actor, ownership.propertyId);
  await db.ownership.delete({ where: { id } });
  revalidatePath("/verwaltung/nutzer");
  redirect(zurueckZu(formData));
}

export async function addTenancy(formData: FormData) {
  const actor = await requireVerwalter();
  const userId = String(formData.get("userId") ?? "").trim();
  const unitId = String(formData.get("unitId") ?? "").trim();
  if (!userId || !unitId) redirect(zurueckZu(formData));
  await ensureUnitInScope(actor, unitId);
  await ensureUserInOrg(actor, userId); // Begünstigte userId validieren (deferred-fix)
  await db.tenancy.upsert({
    where: { userId_unitId: { userId, unitId } },
    create: { userId, unitId },
    update: { active: true },
  });
  revalidatePath("/verwaltung/nutzer");
  redirect(zurueckZu(formData));
}

export async function removeTenancy(formData: FormData) {
  const actor = await requireVerwalter();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect(zurueckZu(formData));
  const tenancy = await db.tenancy.findUnique({
    where: { id },
    select: { unit: { select: { propertyId: true } } },
  });
  if (!tenancy) redirect(zurueckZu(formData));
  await ensurePropertyInScope(actor, tenancy.unit.propertyId);
  await db.tenancy.delete({ where: { id } });
  revalidatePath("/verwaltung/nutzer");
  redirect(zurueckZu(formData));
}

export async function addPropertyAssignment(formData: FormData) {
  // Zuständigkeiten anderer Verwalter dürfen nur SuperAdmins ändern,
  // sonst könnte sich ein Verwalter selbst weitere Objekte zuweisen.
  const actor = await requireVerwalter();
  if (!actor.isSuperAdmin) redirect(zurueckZu(formData));
  const userId = String(formData.get("userId") ?? "").trim();
  const propertyIds = formData.getAll("propertyId").map((p) => String(p).trim()).filter(Boolean);
  if (!userId || propertyIds.length === 0) redirect(zurueckZu(formData));
  await ensureUserInOrg(actor, userId);
  // Nur Objekte der eigenen Org dürfen zugewiesen werden.
  const validProps = await db.property.findMany({
    where: { id: { in: propertyIds }, organizationId: actor.organizationId },
    select: { id: true },
  });
  if (validProps.length === 0) redirect(zurueckZu(formData));
  await db.propertyAssignment.createMany({
    data: validProps.map((p) => ({ userId, propertyId: p.id })),
    skipDuplicates: true,
  });
  revalidatePath("/verwaltung/nutzer");
  redirect(zurueckZu(formData));
}

export async function removePropertyAssignment(formData: FormData) {
  const actor = await requireVerwalter();
  if (!actor.isSuperAdmin) redirect(zurueckZu(formData));
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect(zurueckZu(formData));
  // Org-Constraint: nur Zuweisungen von Nutzern der eigenen Org löschen.
  const a = await db.propertyAssignment.findUnique({
    where: { id },
    select: { user: { select: { organizationId: true } } },
  });
  if (!a || a.user.organizationId !== actor.organizationId) redirect(zurueckZu(formData));
  await db.propertyAssignment.delete({ where: { id } });
  revalidatePath("/verwaltung/nutzer");
  redirect(zurueckZu(formData));
}

export async function addCraftsmanAssignment(formData: FormData) {
  // Handwerker-Freigaben anderer Verwalter dürfen nur SuperAdmins ändern.
  const actor = await requireVerwalter();
  if (!actor.isSuperAdmin) redirect(zurueckZu(formData));
  const userId = String(formData.get("userId") ?? "").trim();
  const craftsmanIds = formData.getAll("craftsmanId").map((c) => String(c).trim()).filter(Boolean);
  if (!userId || craftsmanIds.length === 0) redirect(zurueckZu(formData));
  await ensureUserInOrg(actor, userId);
  // Nur Handwerker der eigenen Org dürfen zugewiesen werden.
  const validCraftsmen = await db.craftsman.findMany({
    where: { id: { in: craftsmanIds }, organizationId: actor.organizationId },
    select: { id: true },
  });
  if (validCraftsmen.length === 0) redirect(zurueckZu(formData));
  await db.craftsmanAssignment.createMany({
    data: validCraftsmen.map((c) => ({ userId, craftsmanId: c.id })),
    skipDuplicates: true,
  });
  revalidatePath("/verwaltung/nutzer");
  redirect(zurueckZu(formData));
}

export async function removeCraftsmanAssignment(formData: FormData) {
  const actor = await requireVerwalter();
  if (!actor.isSuperAdmin) redirect(zurueckZu(formData));
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect(zurueckZu(formData));
  // Org-Constraint: nur Zuweisungen von Nutzern der eigenen Org löschen.
  const a = await db.craftsmanAssignment.findUnique({
    where: { id },
    select: { user: { select: { organizationId: true } } },
  });
  if (!a || a.user.organizationId !== actor.organizationId) redirect(zurueckZu(formData));
  await db.craftsmanAssignment.delete({ where: { id } });
  revalidatePath("/verwaltung/nutzer");
  redirect(zurueckZu(formData));
}

export async function toggleSuperAdmin(formData: FormData) {
  const actor = await requireVerwalter();
  if (!actor.isSuperAdmin) redirect(zurueckZu(formData));
  const id = String(formData.get("id") ?? "").trim();
  if (!id || id === actor.id) redirect(zurueckZu(formData));
  const target = await db.user.findUnique({ where: { id } });
  if (!target || target.role !== "VERWALTER") redirect(zurueckZu(formData));
  // Nur Verwalter der eigenen Org dürfen zum SuperAdmin (de)ernannt werden.
  if (target.organizationId !== actor.organizationId) redirect(zurueckZu(formData));
  await db.user.update({ where: { id }, data: { isSuperAdmin: !target.isSuperAdmin } });
  revalidatePath("/verwaltung/nutzer");
  redirect(zurueckZu(formData));
}

// Erzeugt für einen bestehenden Zugang ein neues Erst-Passwort (Zugangsschreiben neu drucken)
export async function regenerateAccessLetter(formData: FormData) {
  const actor = await requireVerwalter();
  const id = String(formData.get("id") ?? "");
  await ensureCanManageUser(actor, id);
  const user = await db.user.findUnique({ where: { id } });
  if (!user || !user.active) redirect(zurueckZu(formData));

  const tempPassword = generatePassword(10);
  // Falls weder E-Mail noch Benutzername existiert, jetzt einen Benutzernamen vergeben
  const username = user.username ?? (user.email ? null : await generateUsername(user.name));

  await db.user.update({
    where: { id },
    data: {
      passwordHash: await bcrypt.hash(tempPassword, 12),
      mustChangePassword: true,
      ...(username && !user.username ? { username } : {}),
    },
  });

  redirect(`/zugangsschreiben/${id}?pw=${encodeURIComponent(tempPassword)}`);
}
