"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
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

  // Router-Cache leeren, damit nach einem Nutzerwechsel keine Inhalte aus
  // einer früheren Session (anderer Name/Rolle) angezeigt werden.
  revalidatePath("/", "layout");

  // Erst-Passwort aus dem Zugangsschreiben: zur Passwortänderung zwingen
  if (user.mustChangePassword) {
    redirect("/passwort-festlegen");
  }

  redirect("/dashboard");
}

export async function logout() {
  await destroySession();
  // Gesamten Router-Cache invalidieren (siehe login)
  revalidatePath("/", "layout");
  redirect("/login");
}
