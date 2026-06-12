"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";

const userSchema = z.object({
  name: z.string().trim().min(2).max(200),
  email: z.email(),
  password: z.string().min(8).max(200),
  role: z.enum(["VERWALTER", "EIGENTUEMER", "MIETER"]),
  phone: z.string().trim().max(50).optional(),
  unitId: z.string().optional(),
  propertyId: z.string().optional(),
});

export async function createUser(formData: FormData) {
  await requireVerwalter();

  const parsed = userSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
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

  const user = await db.user.create({
    data: {
      name: parsed.data.name,
      email,
      phone: parsed.data.phone,
      role: parsed.data.role,
      passwordHash: await bcrypt.hash(parsed.data.password, 12),
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

  revalidatePath("/verwaltung/nutzer");
  redirect("/verwaltung/nutzer");
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
