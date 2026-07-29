"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, requireUser, revokeSessions } from "@/lib/session";

export async function setInitialPassword(formData: FormData) {
  const user = await requireUser();
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

  if (password.length < 10 || password !== passwordConfirm) {
    redirect("/passwort-festlegen?fehler=eingabe");
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(password, 12),
      mustChangePassword: false,
    },
  });
  // Das Erstpasswort aus dem Zugangsschreiben ist damit verbraucht: Wer es
  // unterwegs mitgelesen hat, verliert hier seinen Zugang.
  await revokeSessions(user.id);
  await createSession(user.id);

  redirect("/dashboard");
}
