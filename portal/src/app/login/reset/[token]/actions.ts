"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, revokeSessions } from "@/lib/session";

export async function resetPassword(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

  if (!token || password.length < 10 || password !== passwordConfirm) {
    redirect(`/login/reset/${token}?fehler=eingabe`);
  }

  const user = await db.user.findFirst({
    where: {
      passwordResetToken: token,
      passwordResetExpiry: { gt: new Date() },
      active: true,
    },
  });

  if (!user) {
    redirect(`/login/reset/${token}?fehler=abgelaufen`);
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(password, 12),
      passwordResetToken: null,
      passwordResetExpiry: null,
      // Wer den per E-Mail versandten Link nutzt, hat den Zugriff auf die
      // Adresse nachgewiesen → als verifiziert markieren (sofern noch nicht).
      emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
    },
  });

  // Ein Passwort-Reset ist der Weg zurueck in ein moeglicherweise uebernommenes
  // Konto. Er muss den Uebernehmer aussperren – sonst hat der Reset genau die
  // Wirkung nicht, wegen der er angefordert wurde.
  await revokeSessions(user.id);
  await createSession(user.id);
  redirect("/dashboard");
}
