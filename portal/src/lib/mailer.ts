// E-Mail-Versand über SMTP. Ohne SMTP_HOST ist der Versand deaktiviert —
// alle Aufrufer dürfen den Versand daher nie als gegeben voraussetzen.
import nodemailer from "nodemailer";

function transport() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
}

export function portalUrl(path: string) {
  const base = process.env.PORTAL_BASE_URL ?? "http://localhost:3000";
  return base.replace(/\/$/, "") + path;
}

export async function sendMail(
  to: string | null | undefined,
  subject: string,
  text: string
) {
  if (!to) {
    // Zugänge ohne E-Mail-Adresse (Zugangsschreiben) erhalten keine Mails
    return;
  }
  const t = transport();
  if (!t) {
    console.log(`[mail deaktiviert] an=${to} betreff=${subject}`);
    return;
  }
  try {
    await t.sendMail({
      from: process.env.MAIL_FROM ?? "B&W Kundenportal <no-reply@bundwimmobilien.de>",
      to,
      subject,
      text,
    });
  } catch (error) {
    // Versandfehler dürfen nie eine Nutzeraktion blockieren
    console.error("E-Mail-Versand fehlgeschlagen:", error);
  }
}
