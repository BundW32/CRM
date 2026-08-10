// Versand des E-Mail-Zweitfaktors — beim Login und bei der Einrichtung.
// Getrennt von lib/mfa.ts, damit jenes ohne Datenbank und Mailer testbar
// bleibt.

import { db } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import {
  EMAIL_CODE_GUELTIG_MINUTEN,
  hashEmailMfaCode,
  neuerEmailMfaCode,
} from "@/lib/mfa";

/**
 * Erzeugt einen frischen Code, speichert nur den Hash (mit Ablauf) und
 * schickt den Klartext an die Konto-Adresse. Ein neuer Versand entwertet den
 * vorigen Code — es gilt immer genau der letzte.
 */
export async function sendeEmailMfaCode(user: {
  id: string;
  email: string | null;
  name: string;
}): Promise<void> {
  if (!user.email) return;
  const code = neuerEmailMfaCode();
  await db.user.update({
    where: { id: user.id },
    data: {
      mfaEmailCodeHash: hashEmailMfaCode(code),
      mfaEmailCodeExpiresAt: new Date(Date.now() + EMAIL_CODE_GUELTIG_MINUTEN * 60_000),
    },
  });
  await sendMail(
    user.email,
    "Ihr Anmeldecode",
    `Guten Tag ${user.name},\n\n` +
      `Ihr Bestätigungscode lautet:\n\n` +
      `${code}\n\n` +
      `Er gilt ${EMAIL_CODE_GUELTIG_MINUTEN} Minuten. Geben Sie ihn niemals weiter — ` +
      `wir fragen Sie nie danach.\n\n` +
      `Falls Sie diesen Code nicht angefordert haben, wurde Ihr Passwort ` +
      `möglicherweise erraten. Ändern Sie es dann bitte umgehend im Portal unter „Konto“.`,
  );
}

/** Entwertet einen gespeicherten Code (nach Erfolg oder beim Abschalten). */
export async function loescheEmailMfaCode(userId: string): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { mfaEmailCodeHash: null, mfaEmailCodeExpiresAt: null },
  });
}
