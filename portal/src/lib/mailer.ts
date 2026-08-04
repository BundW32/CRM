// E-Mail-Versand über SMTP. Ohne SMTP_HOST ist der Versand deaktiviert —
// alle Aufrufer dürfen den Versand daher nie als gegeben voraussetzen.
import nodemailer from "nodemailer";
import { emailLogoUrl, type OrgBranding } from "./branding";
import { fallbackBranding } from "./branding-server";
export { portalUrl } from "./url";
export { portalUrlFromRequest } from "./url-server";

// Ist der E-Mail-Versand konfiguriert? (Ohne SMTP_HOST ein kontrollierter No-Op –
// die UI kann so einen Hinweis zeigen, statt einen stillen „Versand" vorzugaukeln.)
export function isMailEnabled(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

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

// Steht eine Adresse ALLEIN auf einer Zeile, ist sie die Handlungsaufforderung
// der Mail („Bitte bestätigen Sie über diesen Link:" + Adresse). Nur diese wird
// zum Knopf — Adressen mitten im Fließtext bleiben Verweise, sonst zerrisse ein
// beiläufig erwähnter Link den Absatz.
const CTA_LINE = /^[ \t]*(https?:\/\/[^\s<>"]+)[ \t]*$/m;

// Beschriftung aus dem Ziel ableiten. „Link öffnen" sagt nichts darüber, was
// danach passiert; bei einer Bestätigungsmail ist genau das die Frage.
function ctaLabel(url: string): string {
  if (url.includes("/registrieren/bestaetigen")) return "E-Mail-Adresse bestätigen";
  if (url.includes("/passwort") || url.includes("/reset")) return "Neues Passwort festlegen";
  if (url.includes("/auftraege/")) return "Auftrag ansehen";
  if (url.includes("/uebergabe/")) return "Übergabe ansehen";
  return "Im Portal öffnen";
}

// Knopf als Tabelle, nicht als gestyltes <a>: Outlook rendert Hintergrundfarben
// auf Inline-Elementen nicht zuverlässig. Die Adresse steht zusätzlich als Text
// darunter — Clients, die den Knopf verschlucken, lassen den Weg sonst zu.
function ctaButton(url: string, accent: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;">
            <tr><td align="center" style="border-radius:10px;background:${accent};">
              <a href="${url}" style="display:inline-block;padding:13px 26px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#00241f;text-decoration:none;border-radius:10px;">${ctaLabel(url)}</a>
            </td></tr>
            <tr><td style="padding-top:10px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.5;color:#9ca3af;">
              Falls der Knopf nicht funktioniert:<br>
              <a href="${url}" style="color:#9ca3af;word-break:break-all;">${url}</a>
            </td></tr>
          </table>`;
}

// Wortmarke „wegportal24" als HTML statt als Bilddatei. Grund: Für wegportal24
// liegt kein PNG im Build, und viele Mail-Programme blockieren Bilder ohnehin
// standardmäßig — ein Kopf, der erst nach „Bilder anzeigen" erscheint, ist keiner.
// Das Bildzeichen sind drei Rechtecke aus Tabellenzellen; wo `border-radius`
// fehlt (Outlook), bleiben es eckige Kästchen. Das trägt.
function wordmarkHtml(): string {
  const dark = "#00241f";
  const orange = "#f69018";
  const box = "font-size:0;line-height:0;";
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
            <tr>
              <td style="padding-right:7px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr><td style="width:12px;height:12px;background:${dark};border-radius:3px;${box}">&nbsp;</td></tr>
                  <tr><td style="height:4px;${box}">&nbsp;</td></tr>
                  <tr><td style="width:12px;height:12px;background:${dark};border-radius:3px;${box}">&nbsp;</td></tr>
                </table>
              </td>
              <td style="width:12px;height:28px;background:${orange};border-radius:3px;${box}">&nbsp;</td>
              <td style="padding-left:10px;font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:bold;letter-spacing:-.02em;color:${dark};white-space:nowrap;">wegportal<span style="color:${orange};">24</span></td>
            </tr>
          </table>`;
}

// Markenkonformes HTML-Layout mit Logo und Signatur (Kontaktdaten). Das
// Branding bestimmt Logo, Akzentfarbe und Fußzeile (Mandanten-spezifisch).
export function renderHtml(subject: string, text: string, branding: OrgBranding = fallbackBranding()) {
  const base = (process.env.PORTAL_BASE_URL ?? "").replace(/\/$/, "");
  const logo = emailLogoUrl(branding, base);
  const accent = branding.primaryColor;
  // Nur der Rückfall der WEG-SaaS trägt die Wortmarke. Eine echte WEG behält
  // ihren eigenen Namen im Kopf – die Mail kommt von IHRER Gemeinschaft.
  const isWegSaasBrand = branding.slug === "wegportal24";

  // Die Handlungsaufforderung wird an Ort und Stelle zum Knopf – der Text davor
  // („…über diesen Link:") behält damit seinen Bezug.
  const render = (s: string) => linkify(escapeHtml(s)).replace(/\r?\n/g, "<br>");
  const cta = text.match(CTA_LINE);
  const bodyHtml = cta
    ? render(text.slice(0, cta.index)) +
      ctaButton(cta[1], accent) +
      render(text.slice((cta.index ?? 0) + cta[0].length))
    : render(text);
  const link = "#0c534a";
  // Fußzeile aus den (vorhandenen) Kontaktdaten zusammensetzen.
  const contactParts: string[] = [];
  if (branding.telHref && branding.phone) {
    contactParts.push(
      `Tel.: <a href="tel:${branding.telHref}" style="color:${link};text-decoration:none;">${escapeHtml(branding.phone)}</a>`
    );
  }
  if (branding.email) {
    contactParts.push(
      `<a href="mailto:${branding.email}" style="color:${link};text-decoration:none;">${escapeHtml(branding.email)}</a>`
    );
  }
  const websiteHtml = branding.website
    ? `<a href="https://${branding.website.replace(/^https?:\/\//, "")}" style="color:${link};text-decoration:none;">${escapeHtml(branding.website)}</a>`
    : "";

  return `<!doctype html>
<html lang="de">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
        <!-- Kopf -->
        <tr><td style="background:${accent};height:6px;line-height:6px;font-size:6px;">&nbsp;</td></tr>
        <tr><td align="center" style="padding:24px 24px 8px;">
          ${
            logo
              ? `<img src="${logo}" alt="${escapeHtml(branding.displayName)}" width="170" style="display:block;width:170px;max-width:60%;height:auto;">`
              : isWegSaasBrand
                ? wordmarkHtml()
                : `<div style="font-size:20px;font-weight:bold;color:#003630;">${escapeHtml(branding.displayName)}</div>`
          }
        </td></tr>
        <tr><td align="center" style="padding:0 24px 8px;color:#9ca3af;font-size:12px;letter-spacing:.04em;text-transform:uppercase;">${isWegSaasBrand ? "Portal für selbstverwaltete WEGs" : "Kundenportal"}</td></tr>

        <!-- Inhalt -->
        <tr><td style="padding:8px 28px 4px;">
          <h1 style="margin:0 0 12px;font-size:18px;color:#111827;">${escapeHtml(subject)}</h1>
          <div style="font-size:15px;line-height:1.6;color:#374151;">${bodyHtml}</div>
        </td></tr>

        <!-- Signatur / Footer -->
        <tr><td style="padding:20px 28px 0;"><hr style="border:none;border-top:1px solid #e5e7eb;margin:0;"></td></tr>
        <tr><td style="padding:16px 28px 24px;font-size:13px;line-height:1.6;color:#6b7280;">
          <strong style="color:#003630;">${escapeHtml(branding.legalName)}</strong>${branding.addressLine ? `<br>${escapeHtml(branding.addressLine)}` : ""}
          ${contactParts.length ? `<br>${contactParts.join(" · ")}` : ""}
          ${websiteHtml ? `<br>${websiteHtml}` : ""}
          ${base ? `${websiteHtml || contactParts.length || branding.addressLine ? " · " : "<br>"}<a href="${base}/impressum" style="color:#9ca3af;text-decoration:none;">Impressum</a> · <a href="${base}/datenschutz" style="color:#9ca3af;text-decoration:none;">Datenschutz</a>` : ""}
        </td></tr>
      </table>
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td align="center" style="padding:12px;color:#9ca3af;font-size:11px;font-family:Arial,Helvetica,sans-serif;">
          Diese E-Mail wurde automatisch versendet.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export type MailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

// Absender, wenn MAIL_FROM nicht gesetzt ist. Bewusst aus dem Rückfall-Branding
// des Deployments – die Adresse muss zur SPF/DKIM-authentifizierten Domain
// passen, nicht zum Mandanten.
function fallbackFrom(): string {
  const b = fallbackBranding();
  return `${b.displayName} <${b.email ?? "no-reply@bundwimmobilien.de"}>`;
}

export async function sendMail(
  to: string | null | undefined,
  subject: string,
  text: string,
  attachments?: MailAttachment[],
  // Rückfall je Deployment: B&W bzw. wegportal24. Aufrufer mit Org-Bezug
  // übergeben ihr eigenes Branding und sind davon unberührt.
  branding: OrgBranding = fallbackBranding()
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
      // Absender bleibt env-/SMTP-gebunden (Domain muss SPF/DKIM-authentifiziert
      // sein – pro-Mandant-Absender wäre ein separates Zustellungs-Thema).
      // Der Rückfall folgt dem DEPLOYMENT, nicht dem Mandanten: Sonst verschickte
      // wegportal24 ohne gesetztes MAIL_FROM still unter der B&W-Adresse.
      from: process.env.MAIL_FROM ?? fallbackFrom(),
      to,
      subject,
      text,
      html: renderHtml(subject, text, branding),
      attachments,
    });
  } catch (error) {
    // Versandfehler dürfen nie eine Nutzeraktion blockieren
    console.error("E-Mail-Versand fehlgeschlagen:", error);
  }
}
