"use server";

import bcrypt from "bcryptjs";
import crypto from "crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";

const setupSchema = z.object({
  name: z.string().trim().min(2).max(200),
  email: z.email(),
  password: z.string().min(10).max(200),
});

// Legt den ersten Verwalter-Zugang an — nur möglich, solange noch kein Nutzer existiert.
export async function createFirstAdmin(formData: FormData) {
  const userCount = await db.user.count();
  if (userCount > 0) {
    redirect("/login");
  }

  const parsed = setupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    redirect("/setup?fehler=1");
  }

  // Bootstrap: zuerst die Organisation (Mandant) anlegen, dann den Gründer-Admin
  // als SuperAdmin dieser Org. (Self-Service-Onboarding weiterer Mandanten: Phase 5.)
  const slugBase =
    parsed.data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "org";
  const org = await db.organization.create({
    data: { slug: `${slugBase}-${crypto.randomBytes(3).toString("hex")}`, name: parsed.data.name },
  });

  const user = await db.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      role: "VERWALTER",
      passwordHash: await bcrypt.hash(parsed.data.password, 12),
      organizationId: org.id,
      isSuperAdmin: true,
    },
  });

  await createSession(user.id);
  redirect("/dashboard");
}
