"use server";

import bcrypt from "bcryptjs";
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

  const user = await db.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      role: "VERWALTER",
      passwordHash: await bcrypt.hash(parsed.data.password, 12),
    },
  });

  await createSession(user.id);
  redirect("/dashboard");
}
