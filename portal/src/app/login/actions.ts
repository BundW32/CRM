"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, destroySession } from "@/lib/session";

export async function login(formData: FormData) {
  const kennung = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  // Anmeldung per E-Mail-Adresse oder per Benutzername (Zugänge ohne E-Mail)
  let user = null;
  if (kennung) {
    user = kennung.includes("@")
      ? await db.user.findUnique({ where: { email: kennung } })
      : await db.user.findUnique({ where: { username: kennung } });
  }

  if (
    !user ||
    !user.active ||
    !(await bcrypt.compare(password, user.passwordHash))
  ) {
    redirect("/login?fehler=1");
  }

  await createSession(user.id);

  // Erst-Passwort aus dem Zugangsschreiben: zur Passwortänderung zwingen
  if (user.mustChangePassword) {
    redirect("/passwort-festlegen");
  }

  redirect("/dashboard");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
