"use server";

import crypto from "crypto";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { portalUrl, sendMail } from "@/lib/mailer";
import { AUDIT, logAudit } from "@/lib/audit";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!email) redirect("/login/forgot?fehler=eingabe");

  const ip = await getClientIp();

  // Rate limit: 3 Anfragen pro E-Mail-Adresse pro Stunde (verhindert Spam-Versand)
  if (!(await checkRateLimit(`forgot:${email}`, 3, 3600))) {
    redirect("/login/forgot?gesendet=1"); // Kein Rate-Limit verraten
  }

  const user = await db.user.findUnique({ where: { email } });

  // Always redirect to the same success page (don't leak whether email exists)
  if (user && user.active) {
    const token = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 1000 * 60 * 60 * 2); // 2 hours

    await db.user.update({
      where: { id: user.id },
      data: { passwordResetToken: token, passwordResetExpiry: expiry },
    });

    const link = portalUrl(`/login/reset/${token}`);
    await sendMail(
      user.email,
      "Passwort zurücksetzen – B&W Kundenportal",
      `Guten Tag ${user.name},\n\n` +
        `Sie haben eine Anfrage zum Zurücksetzen Ihres Passworts gestellt.\n\n` +
        `Klicken Sie auf folgenden Link, um ein neues Passwort zu vergeben (gültig 2 Stunden):\n` +
        `${link}\n\n` +
        `Falls Sie keine Anfrage gestellt haben, ignorieren Sie diese E-Mail.\n\n` +
        `Mit freundlichen Grüßen\nB&W Immobilien Management UG`
    );
    await logAudit({ action: AUDIT.PASSWORD_RESET_REQUEST, meta: { email }, ip });
  }

  redirect("/login/forgot?gesendet=1");
}
