"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { createSession, revokeSessions } from "@/lib/session";
import { hashToken } from "@/lib/token-hash";

export async function resetPassword(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

  // Grenze auch auf das EINLÖSEN, nicht nur auf das Anfordern (P1-6b): Bei
  // 256 Bit Token-Zufall ist Durchprobieren akademisch — aber die Grenze
  // kostet nichts und macht den Endpunkt als Orakel unbrauchbar.
  const ip = await getClientIp();
  if (!(await checkRateLimit(`reset-einloesen:${ip}`, 10, 3600))) {
    redirect(`/login/reset/${token}?fehler=limit`);
  }

  if (!token || password.length < 10 || password !== passwordConfirm) {
    redirect(`/login/reset/${token}?fehler=eingabe`);
  }

  const user = await db.user.findFirst({
    where: {
      // NUR gegen den Hash prüfen – nie zusätzlich gegen den Rohwert. Eine
      // Zeit lang stand hier ein "Hash ODER Rohwert", um Links weiterhin
      // einzulösen, die ein noch nicht umgestellter zweiter Erzeuger im
      // Klartext gespeichert hatte. Das öffnete dieselbe Lücke wieder: Wer den
      // gespeicherten Hash kennt (z. B. aus genau dem DB-Leck, das die
      // Umstellung verhindern soll), reicht ihn einfach als "Rohwert" ein und
      // träfe über die ODER-Bedingung direkt auf sich selbst.
      passwordResetToken: hashToken(token),
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
