"use server";

import bcrypt from "bcryptjs";
import crypto from "crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { portalUrl, sendMail } from "@/lib/mailer";
import { requireVerwalter } from "@/lib/session";

const personSchema = z.object({
  name: z.string().trim().min(2).max(200),
  email: z.email(),
  phone: z.string().trim().max(50).optional(),
});

async function createInvitedUser(
  data: { name: string; email: string; phone?: string; role: "EIGENTUEMER" | "MIETER" },
  link: string
) {
  const existing = await db.user.findUnique({ where: { email: data.email } });
  if (existing) return existing;

  const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12);
  const inviteToken = crypto.randomBytes(32).toString("hex");
  const inviteExpiry = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

  const user = await db.user.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      role: data.role,
      passwordHash,
      passwordResetToken: inviteToken,
      passwordResetExpiry: inviteExpiry,
    },
  });

  const inviteLink = portalUrl(`/login/reset/${inviteToken}?einladung=1`);
  await sendMail(
    user.email,
    "Ihr Zugang zum B&W Kundenportal",
    `Guten Tag ${user.name},\n\n` +
      `Sie wurden zum Kundenportal der B&W Immobilien Management UG eingeladen.\n\n` +
      `Klicken Sie auf folgenden Link, um Ihren Zugang einzurichten (gültig 7 Tage):\n` +
      `${inviteLink}\n\n` +
      `Nach der Einrichtung können Sie sich jederzeit unter ${link} anmelden.\n\n` +
      `Mit freundlichen Grüßen\nB&W Immobilien Management UG`
  );

  return user;
}

export async function schnelleinrichtung(formData: FormData) {
  await requireVerwalter();

  // Objekt
  const name = String(formData.get("name") ?? "").trim();
  const street = String(formData.get("street") ?? "").trim();
  const zip = String(formData.get("zip") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  if (!name || !street || !zip || !city) {
    redirect("/verwaltung/schnelleinrichtung?fehler=objekt");
  }

  const property = await db.property.create({ data: { name, street, zip, city } });

  const loginUrl = portalUrl("/login");

  // Eigentümer (optional)
  const eigName = String(formData.get("eigName") ?? "").trim();
  const eigEmail = String(formData.get("eigEmail") ?? "").trim();
  if (eigName && eigEmail) {
    const parsedEig = personSchema.safeParse({
      name: eigName,
      email: eigEmail,
      phone: formData.get("eigPhone") || undefined,
    });
    if (parsedEig.success) {
      const eig = await createInvitedUser(
        { ...parsedEig.data, role: "EIGENTUEMER" },
        loginUrl
      );
      await db.ownership.upsert({
        where: { userId_propertyId: { userId: eig.id, propertyId: property.id } },
        update: {},
        create: { userId: eig.id, propertyId: property.id },
      });
    }
  }

  // Einheiten + Mieter (bis zu 8)
  for (let i = 1; i <= 8; i++) {
    const unitLabel = String(formData.get(`unit${i}Label`) ?? "").trim();
    if (!unitLabel) continue;

    const unit = await db.unit.create({
      data: {
        propertyId: property.id,
        label: unitLabel,
        floor: String(formData.get(`unit${i}Floor`) ?? "").trim() || undefined,
      },
    });

    const mName = String(formData.get(`unit${i}MieterName`) ?? "").trim();
    const mEmail = String(formData.get(`unit${i}MieterEmail`) ?? "").trim();
    if (mName && mEmail) {
      const parsedM = personSchema.safeParse({
        name: mName,
        email: mEmail,
        phone: formData.get(`unit${i}MieterPhone`) || undefined,
      });
      if (parsedM.success) {
        const mieter = await createInvitedUser(
          { ...parsedM.data, role: "MIETER" },
          loginUrl
        );
        await db.tenancy.upsert({
          where: { userId_unitId: { userId: mieter.id, unitId: unit.id } },
          update: {},
          create: { userId: mieter.id, unitId: unit.id },
        });
      }
    }
  }

  redirect(`/verwaltung/objekte?eingerichtet=1`);
}
