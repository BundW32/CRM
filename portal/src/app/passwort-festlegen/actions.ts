"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export async function setInitialPassword(formData: FormData) {
  const user = await requireUser();
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

  if (password.length < 8 || password !== passwordConfirm) {
    redirect("/passwort-festlegen?fehler=eingabe");
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(password, 12),
      mustChangePassword: false,
    },
  });

  redirect("/dashboard");
}
