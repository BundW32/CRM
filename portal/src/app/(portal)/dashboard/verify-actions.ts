"use server";

import crypto from "crypto";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { brandingFromOrg, signOffName } from "@/lib/branding";
import { portalUrl, sendMail } from "@/lib/mailer";
import { requireUser } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { hashToken } from "@/lib/token-hash";

// Sendet die Bestätigungs-E-Mail erneut (für noch nicht verifizierte Konten).
export async function resendVerification() {
  const user = await requireUser();
  if (!user.email || user.emailVerifiedAt) {
    redirect("/dashboard");
  }
  // Missbrauchsschutz: max. 3 erneute Sendungen pro Konto und Stunde.
  if (!(await checkRateLimit(`verify-resend:${user.id}`, 3, 3600))) {
    redirect("/dashboard?verify=limit");
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiry = new Date(Date.now() + 1000 * 60 * 60 * 24 * 3);
  await db.user.update({
    where: { id: user.id },
    // Nur der Hash landet in der Datenbank – der Rohwert bleibt allein im Link.
    data: { emailVerifyToken: hashToken(token), emailVerifyExpiry: expiry },
  });

  const org = await db.organization.findUnique({ where: { id: user.organizationId } });
  const branding = brandingFromOrg(org);
  const link = portalUrl(`/registrieren/bestaetigen/${token}`);
  await sendMail(
    user.email,
    "Bitte bestätigen Sie Ihre E-Mail-Adresse",
    `Guten Tag ${user.name},\n\n` +
      `bitte bestätigen Sie Ihre E-Mail-Adresse über diesen Link (gültig 3 Tage):\n` +
      `${link}\n\n` +
      `Mit freundlichen Grüßen\n${signOffName(branding)}`,
    undefined,
    branding
  );

  redirect("/dashboard?verify=gesendet");
}
