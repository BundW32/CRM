"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, destroySession } from "@/lib/session";

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  const user = email
    ? await db.user.findUnique({ where: { email } })
    : null;

  if (
    !user ||
    !user.active ||
    !(await bcrypt.compare(password, user.passwordHash))
  ) {
    redirect("/login?fehler=1");
  }

  await createSession(user.id);
  redirect("/dashboard");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
