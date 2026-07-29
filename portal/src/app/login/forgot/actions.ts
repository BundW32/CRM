"use server";

import crypto from "crypto";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getBrandingForOrg } from "@/lib/branding-server";
import { mailText } from "@/lib/mail-text";
import { portalUrlFromRequest, sendMail } from "@/lib/mailer";
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

    const link = await portalUrlFromRequest(`/login/reset/${token}`);
    const branding = await getBrandingForOrg(user.organizationId);
    await sendMail(
      user.email,
      "Passwort zurücksetzen – Kundenportal",
      mailText({
        anrede: user.name,
        absaetze: [
          `Sie haben eine Anfrage zum Zurücksetzen Ihres Passworts gestellt.`,
          `Über den folgenden Link vergeben Sie ein neues Passwort. Er ist 2 Stunden gültig.`,
          `Falls Sie keine Anfrage gestellt haben, ignorieren Sie diese E-Mail. ` +
            `Ihr Passwort bleibt dann unverändert.`,
        ],
        aktion: { label: "Neues Passwort vergeben", url: link },
        branding,
      }),
      undefined,
      branding
    );
    await logAudit({ action: AUDIT.PASSWORD_RESET_REQUEST, meta: { email }, ip });
  }

  redirect("/login/forgot?gesendet=1");
}
