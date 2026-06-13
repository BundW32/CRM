"use server";

import bcrypt from "bcryptjs";
import crypto from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { portalUrl, sendMail } from "@/lib/mailer";
import { requireVerwalter } from "@/lib/session";

const userSchema = z.object({
  name: z.string().trim().min(2).max(200),
  email: z.email(),
  role: z.enum(["VERWALTER", "EIGENTUEMER", "MIETER", "HANDWERKER"]),
  phone: z.string().trim().max(50).optional(),
  unitId: z.string().optional(),
  propertyId: z.string().optional(),
});

export async function createUser(formData: FormData) {
  await requireVerwalter();

  const parsed = userSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
    phone: formData.get("phone") || undefined,
    unitId: formData.get("unitId") || undefined,
    propertyId: formData.get("propertyId") || undefined,
  });
  if (!parsed.success) {
    redirect("/verwaltung/nutzer?fehler=eingabe");
  }

  const email = parsed.data.email.toLowerCase();
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    redirect("/verwaltung/nutzer?fehler=email");
  }

  // Zufälliges Passwort-Hash (nie verwendbar) + Einladungstoken
  const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12);
  const inviteToken = crypto.randomBytes(32).toString("hex");
  const inviteExpiry = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 Tage

  const user = await db.user.create({
    data: {
      name: parsed.data.name,
      email,
      phone: parsed.data.phone,
      role: parsed.data.role,
      passwordHash,
      passwordResetToken: inviteToken,
      passwordResetExpiry: inviteExpiry,
    },
  });

  if (parsed.data.role === "MIETER" && parsed.data.unitId) {
    await db.tenancy.create({
      data: { userId: user.id, unitId: parsed.data.unitId },
    });
  }
  if (parsed.data.role === "EIGENTUEMER" && parsed.data.propertyId) {
    await db.ownership.create({
      data: { userId: user.id, propertyId: parsed.data.propertyId },
    });
  }

  const link = portalUrl(`/login/reset/${inviteToken}?einladung=1`);
  await sendMail(
    user.email,
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
  if (!user || !user.active) redirect("/verwaltung/nutzer");

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
