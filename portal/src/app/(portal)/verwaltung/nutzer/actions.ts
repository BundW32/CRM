"use server";

import bcrypt from "bcryptjs";
import crypto from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { generatePassword, generateUsername } from "@/lib/credentials";
import { db } from "@/lib/db";
import { portalUrl, sendMail } from "@/lib/mailer";
import { requireVerwalter } from "@/lib/session";

const userSchema = z.object({
  name: z.string().trim().min(2).max(200),
  email: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
  role: z.enum(["VERWALTER", "EIGENTUEMER", "MIETER", "HANDWERKER"]),
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
  await requireVerwalter();

  const parsed = userSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email") || undefined,
    role: formData.get("role"),
    phone: formData.get("phone") || undefined,
    preferredContact: formData.get("preferredContact") || undefined,
    unitId: formData.get("unitId") || undefined,
    propertyId: formData.get("propertyId") || undefined,
    method: formData.get("method") || "email",
  });
  if (!parsed.success) {
    redirect("/verwaltung/nutzer?fehler=eingabe");
  }

  const email = parsed.data.email && parsed.data.email !== "" ? parsed.data.email : null;

  // E-Mail-Einladung setzt eine E-Mail-Adresse voraus
  if (parsed.data.method === "email" && !email) {
    redirect("/verwaltung/nutzer?fehler=email_fehlt");
  }
  if (email) {
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      redirect("/verwaltung/nutzer?fehler=email");
    }
  }

  // ── Variante A: Einladung per E-Mail ──────────────────────────────
  if (parsed.data.method === "email") {
    const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12);
    const inviteToken = crypto.randomBytes(32).toString("hex");
    const inviteExpiry = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

    const user = await db.user.create({
      data: {
        name: parsed.data.name,
        email,
        phone: parsed.data.phone,
        preferredContact: pcOrNull(parsed.data.preferredContact),
        role: parsed.data.role,
        passwordHash,
        passwordResetToken: inviteToken,
        passwordResetExpiry: inviteExpiry,
      },
    });
    await assignRole(user.id, parsed.data.role, parsed.data.unitId, parsed.data.propertyId);

    const link = portalUrl(`/login/reset/${inviteToken}?einladung=1`);
    await sendMail(
      email!,
      "Ihr Zugang zum B&W Kundenportal",
      `Guten Tag ${user.name},\n\n` +
        `Sie wurden zum Kundenportal der B&W Immobilien Management UG eingeladen.\n\n` +
        `Klicken Sie auf folgenden Link, um Ihren Zugang einzurichten (gültig 7 Tage):\n` +
        `${link}\n\n` +
        `Nach der Einrichtung können Sie sich jederzeit unter ${portalUrl("/login")} anmelden.\n\n` +
        `Mit freundlichen Grüßen\nB&W Immobilien Management UG`
    );

    revalidatePath("/verwaltung/nutzer");
    redirect("/verwaltung/nutzer?eingeladen=1");
  }

  // ── Variante B: Zugangsschreiben zum Ausdrucken ───────────────────
  // Erst-Passwort wird generiert, muss bei der ersten Anmeldung geändert werden.
  const tempPassword = generatePassword(10);
  const username = email ? null : await generateUsername(parsed.data.name);

  const user = await db.user.create({
    data: {
      name: parsed.data.name,
      email,
      username,
      phone: parsed.data.phone,
      preferredContact: pcOrNull(parsed.data.preferredContact),
      role: parsed.data.role,
      passwordHash: await bcrypt.hash(tempPassword, 12),
      mustChangePassword: true,
    },
  });
  await assignRole(user.id, parsed.data.role, parsed.data.unitId, parsed.data.propertyId);

  revalidatePath("/verwaltung/nutzer");
  redirect(`/zugangsschreiben/${user.id}?pw=${encodeURIComponent(tempPassword)}`);
}

export async function toggleUserActive(formData: FormData) {
  const verwalter = await requireVerwalter();
  const id = String(formData.get("id") ?? "");
  if (id && id !== verwalter.id) {
    const user = await db.user.findUnique({ where: { id } });
    if (user) {
      await db.user.update({ where: { id }, data: { active: !user.active } });
    }
  }
  revalidatePath("/verwaltung/nutzer");
  redirect("/verwaltung/nutzer");
}

export async function resendInvite(formData: FormData) {
  await requireVerwalter();
  const id = String(formData.get("id") ?? "");
  const user = await db.user.findUnique({ where: { id } });
  if (!user || !user.active || !user.email) redirect("/verwaltung/nutzer");

  const inviteToken = crypto.randomBytes(32).toString("hex");
  const inviteExpiry = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
  await db.user.update({
    where: { id },
    data: { passwordResetToken: inviteToken, passwordResetExpiry: inviteExpiry },
  });

  const link = portalUrl(`/login/reset/${inviteToken}?einladung=1`);
  await sendMail(
    user.email,
    "Ihr Zugang zum B&W Kundenportal (Erinnerung)",
    `Guten Tag ${user.name},\n\n` +
      `Hier ist Ihr Einladungslink zum B&W Kundenportal (gültig 7 Tage):\n` +
      `${link}\n\n` +
      `Mit freundlichen Grüßen\nB&W Immobilien Management UG`
  );

  revalidatePath("/verwaltung/nutzer");
  redirect("/verwaltung/nutzer?eingeladen=1");
}

// Erzeugt für einen bestehenden Zugang ein neues Erst-Passwort (Zugangsschreiben neu drucken)
export async function regenerateAccessLetter(formData: FormData) {
  await requireVerwalter();
  const id = String(formData.get("id") ?? "");
  const user = await db.user.findUnique({ where: { id } });
  if (!user || !user.active) redirect("/verwaltung/nutzer");

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
