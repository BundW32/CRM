// Legt einen Mieter/Eigentümer als Portal-Nutzer an – entweder per E-Mail-
// Einladung (Reset-Link) ODER, ohne E-Mail, mit Erst-Passwort für ein druckbares
// Zugangsschreiben. Existiert die E-Mail bereits in DERSELBEN Organisation, wird
// der bestehende Nutzer wiederverwendet (kein Cross-Org-Link).
//
// Rückgabe: { id, pw } – pw ist leer bei E-Mail-Einladung, sonst das Erst-Passwort
// (Zugangsschreiben). null, wenn die E-Mail zu einer FREMDEN Organisation gehört.
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "./db";
import { getBrandingForOrg } from "./branding-server";
import { generatePassword, generateUsername } from "./credentials";
import { portalUrlFromRequest, sendMail } from "./mailer";

const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 Tage

export async function inviteOrLetter(opts: {
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  email: string | null;
  phone: string | null;
  role: "EIGENTUEMER" | "MIETER";
  organizationId: string;
}): Promise<{ id: string; pw: string } | null> {
  if (opts.email) {
    const exists = await db.user.findUnique({
      where: { email: opts.email },
      select: { id: true, organizationId: true },
    });
    if (exists) {
      return exists.organizationId === opts.organizationId ? { id: exists.id, pw: "" } : null;
    }
  }

  if (opts.email) {
    const inviteToken = crypto.randomBytes(32).toString("hex");
    const user = await db.user.create({
      data: {
        name: opts.name,
        firstName: opts.firstName ?? undefined,
        lastName: opts.lastName ?? undefined,
        email: opts.email,
        phone: opts.phone ?? undefined,
        role: opts.role,
        passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12),
        passwordResetToken: inviteToken,
        passwordResetExpiry: new Date(Date.now() + INVITE_TTL_MS),
        organizationId: opts.organizationId,
      },
    });
    const branding = await getBrandingForOrg(opts.organizationId);
    await sendMail(
      opts.email,
      "Ihr Zugang zum Kundenportal",
      `Guten Tag ${opts.name},\n\n` +
        `Sie wurden zum Kundenportal der ${branding.legalName} eingeladen.\n\n` +
        `Zugang einrichten (gültig 7 Tage):\n` +
        `${await portalUrlFromRequest(`/login/reset/${inviteToken}?einladung=1`)}\n\n` +
        `Mit freundlichen Grüßen\n${branding.legalName}`,
      undefined,
      branding
    );
    return { id: user.id, pw: "" };
  }

  // Ohne E-Mail: Zugangsschreiben mit Benutzername + Erst-Passwort
  const tempPassword = generatePassword(10);
  const username = await generateUsername(opts.name);
  const user = await db.user.create({
    data: {
      name: opts.name,
      firstName: opts.firstName ?? undefined,
      lastName: opts.lastName ?? undefined,
      username,
      phone: opts.phone ?? undefined,
      role: opts.role,
      passwordHash: await bcrypt.hash(tempPassword, 12),
      mustChangePassword: true,
      organizationId: opts.organizationId,
    },
  });
  return { id: user.id, pw: tempPassword };
}
