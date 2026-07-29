"use server";

import crypto from "crypto";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { brandingFromOrg } from "@/lib/branding";
import { portalUrl, sendMail } from "@/lib/mailer";
import { mailText } from "@/lib/mail-text";
import { requireUser } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";

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
    data: { emailVerifyToken: token, emailVerifyExpiry: expiry },
  });

  const org = await db.organization.findUnique({ where: { id: user.organizationId } });
  const branding = brandingFromOrg(org);
  const link = portalUrl(`/registrieren/bestaetigen/${token}`);
  await sendMail(
    user.email,
    "Bitte bestätigen Sie Ihre E-Mail-Adresse",
    mailText({
      anrede: user,
      absaetze: [
        `bitte bestätigen Sie Ihre E-Mail-Adresse über den folgenden Link. ` +
          `Er ist 3 Tage gültig.`,
      ],
      aktion: { label: "E-Mail-Adresse bestätigen", url: link },
      branding,
    }),
    undefined,
    branding
  );

  redirect("/dashboard?verify=gesendet");
}
