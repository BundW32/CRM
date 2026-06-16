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

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// URLs im Text klickbar machen
function linkify(escaped: string) {
  return escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" style="color:#0c534a;word-break:break-all;">$1</a>'
  );
}

// Markenkonformes HTML-Layout mit Logo und Signatur (Kontaktdaten)
export function renderHtml(subject: string, text: string) {
  const base = (process.env.PORTAL_BASE_URL ?? "").replace(/\/$/, "");
  const logo = base ? `${base}/bw-logo.png` : "";
  const bodyHtml = linkify(escapeHtml(text)).replace(/\r?\n/g, "<br>");

  return `<!doctype html>
<html lang="de">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
        <!-- Kopf -->
        <tr><td style="background:#003630;height:6px;line-height:6px;font-size:6px;">&nbsp;</td></tr>
        <tr><td align="center" style="padding:24px 24px 8px;">
          ${logo ? `<img src="${logo}" alt="B&amp;W Immobilien Management" width="170" style="display:block;width:170px;max-width:60%;height:auto;">` : `<div style="font-size:20px;font-weight:bold;color:#003630;">B &amp; W Immobilien Management</div>`}
        </td></tr>
        <tr><td align="center" style="padding:0 24px 8px;color:#9ca3af;font-size:12px;letter-spacing:.04em;text-transform:uppercase;">Kundenportal</td></tr>

        <!-- Inhalt -->
        <tr><td style="padding:8px 28px 4px;">
          <h1 style="margin:0 0 12px;font-size:18px;color:#111827;">${escapeHtml(subject)}</h1>
          <div style="font-size:15px;line-height:1.6;color:#374151;">${bodyHtml}</div>
        </td></tr>

        <!-- Signatur / Footer -->
        <tr><td style="padding:20px 28px 0;"><hr style="border:none;border-top:1px solid #e5e7eb;margin:0;"></td></tr>
        <tr><td style="padding:16px 28px 24px;font-size:13px;line-height:1.6;color:#6b7280;">
          <strong style="color:#003630;">B &amp; W Immobilien Management UG (haftungsbeschränkt)</strong><br>
          Goethestraße 42 · 45964 Gladbeck<br>
          Tel.: <a href="tel:+4915129468127" style="color:#0c534a;text-decoration:none;">+49 151 29468127</a> ·
          <a href="mailto:info@bundwimmobilien.de" style="color:#0c534a;text-decoration:none;">info@bundwimmobilien.de</a><br>
          <a href="https://www.bundwimmobilien.de" style="color:#0c534a;text-decoration:none;">www.bundwimmobilien.de</a>
          ${base ? ` · <a href="${base}/impressum" style="color:#9ca3af;text-decoration:none;">Impressum</a> · <a href="${base}/datenschutz" style="color:#9ca3af;text-decoration:none;">Datenschutz</a>` : ""}
        </td></tr>
      </table>
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td align="center" style="padding:12px;color:#9ca3af;font-size:11px;font-family:Arial,Helvetica,sans-serif;">
          Diese E-Mail wurde automatisch vom B&amp;W Kundenportal versendet.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
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
      html: renderHtml(subject, text),
    });
  } catch (error) {
    // Versandfehler dürfen nie eine Nutzeraktion blockieren
    console.error("E-Mail-Versand fehlgeschlagen:", error);
  }
}
