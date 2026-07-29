// E-Mail-Versand über SMTP. Ohne SMTP_HOST ist der Versand deaktiviert —
// alle Aufrufer dürfen den Versand daher nie als gegeben voraussetzen.
import nodemailer from "nodemailer";
import {
  emailLinkColor,
  emailLinkColorOnDark,
  emailLogoUrl,
  onBrandTextColor,
  type OrgBranding,
} from "./branding";
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
function linkify(escaped: string, link: string) {
  return escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    `<a href="$1" class="mail-link" style="color:${link};word-break:break-all;">$1</a>`
  );
}

// ── Handlungsaufforderung aus dem Fließtext ──────────────────────────────────
// Fast jede Mail endet mit einer Zeile der Form „Zum Vorgang: https://…".
// Als nackte URL im Text ist das die unscheinbarste Stelle der ganzen Mail –
// dabei ist es genau das, was der Empfänger tun soll.
//
// Statt 22 Aufrufer umzuschreiben, erkennt das Template die Zeile selbst und
// macht daraus einen Knopf. Der Textteil der Mail (den Clients ohne HTML
// anzeigen) bleibt unverändert – dort steht die URL weiterhin ausgeschrieben.
type CallToAction = { label: string; url: string };

const CTA_ZEILE = /^([^:\n]{3,40}):\s*(https?:\/\/\S+)$/;

// Der Knopf bleibt an der **Stelle**, an der die Zeile stand – der Text wird
// dafür in davor/danach geteilt. Schöbe man ihn ans Ende, stünde er hinter
// „Mit freundlichen Grüßen", und das liest sich wie ein nachgereichter Zettel.
//
// Gesucht wird die **letzte** passende Zeile: Trägt eine Mail mehrere Links, ist
// der Abschluss die eigentliche Aufforderung. Alle übrigen Links bleiben als
// Fließtext-Links stehen.
export function extractCallToAction(text: string): {
  before: string;
  after: string;
  cta: CallToAction | null;
} {
  const zeilen = text.split(/\r?\n/);
  for (let i = zeilen.length - 1; i >= 0; i--) {
    const treffer = zeilen[i].trim().match(CTA_ZEILE);
    if (!treffer) continue;
    return {
      before: zeilen.slice(0, i).join("\n").trim(),
      after: zeilen.slice(i + 1).join("\n").trim(),
      cta: { label: treffer[1].trim(), url: treffer[2] },
    };
  }
  return { before: text, after: "", cta: null };
}

// Vorschauzeile im Posteingang (zwischen Betreff und Text). Ohne sie zeigen
// Clients den Anfang des HTML-Grundgerüsts oder die Anrede – beides sagt nichts.
function preheader(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 140);
}

// Markenkonformes HTML-Layout mit Logo und Signatur (Kontaktdaten). Das
// Branding bestimmt Logo, Akzentfarbe und Fußzeile (Mandanten-spezifisch).
export function renderHtml(subject: string, text: string, branding: OrgBranding) {
  const base = (process.env.PORTAL_BASE_URL ?? "").replace(/\/$/, "");
  const logo = emailLogoUrl(branding, base);

  const accent = branding.primaryColor;
  const link = emailLinkColor(accent);
  const linkOnDark = emailLinkColorOnDark(accent);

  const onAccent = onBrandTextColor(accent);

  const { before, after, cta } = extractCallToAction(text);
  const absatz = (t: string) => linkify(escapeHtml(t), link).replace(/\r?\n/g, "<br>");
  const bodyHtml = absatz(before);
  const afterHtml = after
    ? `<tr><td class="mail-text" style="padding:16px 28px 4px;font-size:15px;line-height:1.6;color:#374151;">${absatz(after)}</td></tr>`
    : "";
  const ctaHtml = cta
    ? `<tr><td style="padding:20px 28px 4px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="background:${accent};border-radius:8px;">
              <a href="${cta.url}" style="display:inline-block;padding:12px 24px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:${onAccent};text-decoration:none;">${escapeHtml(cta.label)}</a>
            </td>
          </tr></table>
        </td></tr>`
    : "";
  // Fußzeile aus den (vorhandenen) Kontaktdaten zusammensetzen.
  const contactParts: string[] = [];
  if (branding.telHref && branding.phone) {
    contactParts.push(
      `Tel.: <a href="tel:${branding.telHref}" class="mail-link" style="color:${link};text-decoration:none;">${escapeHtml(branding.phone)}</a>`
    );
  }
  if (branding.email) {
    contactParts.push(
      `<a href="mailto:${branding.email}" class="mail-link" style="color:${link};text-decoration:none;">${escapeHtml(branding.email)}</a>`
    );
  }
  const websiteHtml = branding.website
    ? `<a href="https://${branding.website.replace(/^https?:\/\//, "")}" class="mail-link" style="color:${link};text-decoration:none;">${escapeHtml(branding.website)}</a>`
    : "";

  return `<!doctype html>
<html lang="de">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">
<style>
  /* Dunkelmodus: Nur Flächen und Schriftfarben werden gedreht. Die Akzentfarbe
     des Mandanten bleibt unangetastet – sie ist die Marke. Clients ohne
     Unterstützung (Outlook) ignorieren den Block und behalten die hellen
     Inline-Styles, die deshalb weiterhin vollständig gesetzt bleiben. */
  @media (prefers-color-scheme: dark) {
    .mail-bg { background:#18181b !important; }
    .mail-card { background:#27272a !important; border-color:#3f3f46 !important; }
    .mail-title, .mail-name { color:#f4f4f5 !important; }
    .mail-text { color:#d4d4d8 !important; }
    .mail-muted { color:#a1a1aa !important; }
    .mail-rule { border-top-color:#3f3f46 !important; }
    /* Die für weißen Grund abgedunkelte Linkfarbe ist auf Dunkel unlesbar. */
    .mail-link { color:${linkOnDark} !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;" class="mail-bg">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;">${escapeHtml(preheader(before))}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="mail-bg" style="background:#f4f4f5;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="mail-card" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
        <!-- Kopf -->
        <tr><td style="background:${accent};height:6px;line-height:6px;font-size:6px;">&nbsp;</td></tr>
        <tr><td align="center" style="padding:24px 24px 8px;">
          ${logo ? `<img src="${logo}" alt="${escapeHtml(branding.displayName)}" width="170" style="display:block;width:170px;max-width:60%;height:auto;">` : `<div class="mail-name" style="font-size:20px;font-weight:bold;color:#003630;">${escapeHtml(branding.displayName)}</div>`}
        </td></tr>
        <tr><td align="center" class="mail-muted" style="padding:0 24px 8px;color:#9ca3af;font-size:12px;letter-spacing:.04em;text-transform:uppercase;">Kundenportal</td></tr>

        <!-- Inhalt -->
        <tr><td style="padding:8px 28px 4px;">
          <h1 class="mail-title" style="margin:0 0 12px;font-size:18px;color:#111827;">${escapeHtml(subject)}</h1>
          <div class="mail-text" style="font-size:15px;line-height:1.6;color:#374151;">${bodyHtml}</div>
        </td></tr>
${ctaHtml}${afterHtml}
        <!-- Signatur / Footer -->
        <tr><td style="padding:20px 28px 0;"><hr class="mail-rule" style="border:none;border-top:1px solid #e5e7eb;margin:0;"></td></tr>
        <tr><td class="mail-muted" style="padding:16px 28px 24px;font-size:13px;line-height:1.6;color:#6b7280;">
          <strong class="mail-name" style="color:#003630;">${escapeHtml(branding.legalName)}</strong>${branding.addressLine ? `<br>${escapeHtml(branding.addressLine)}` : ""}
          ${contactParts.length ? `<br>${contactParts.join(" · ")}` : ""}
          ${websiteHtml ? `<br>${websiteHtml}` : ""}
          ${base ? `${websiteHtml || contactParts.length || branding.addressLine ? " · " : "<br>"}<a href="${base}/impressum" style="color:#9ca3af;text-decoration:none;">Impressum</a> · <a href="${base}/datenschutz" style="color:#9ca3af;text-decoration:none;">Datenschutz</a>` : ""}
        </td></tr>
      </table>
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td align="center" class="mail-muted" style="padding:12px;color:#9ca3af;font-size:11px;font-family:Arial,Helvetica,sans-serif;">
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

// Was aus einem Versandversuch geworden ist. `sendMail` wirft weiterhin nicht –
// wer das Ergebnis ignoriert, bekommt exakt das alte Verhalten. Wer den Nutzer
// aber informieren will, kann es jetzt: Vorher gab die Funktion `void` zurück,
// sodass „Protokoll an 3 Empfänger gesendet" auch dann erschien, wenn gar kein
// SMTP konfiguriert war und die Mail nur im Log stand.
export type MailOutcome = "sent" | "no_recipient" | "disabled" | "failed";

// Trennt „Anzeigename <adresse@x>" in seine Teile. Ohne Klammern ist der ganze
// Wert die Adresse.
function parseFrom(raw: string): { name: string | null; address: string } {
  const m = raw.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return m ? { name: m[1] || null, address: m[2] } : { name: null, address: raw.trim() };
}

// Absender im Namen des Mandanten. Die **Adresse** bleibt env-/SMTP-gebunden:
// Sie muss per SPF/DKIM authentifiziert sein, und das ist eine Eigenschaft der
// Domain, nicht des Mandanten. Der **Anzeigename** darf frei gewählt werden und
// ist das, was der Empfänger in der Absenderspalte liest – deshalb steht dort
// jetzt die Verwaltung des Empfängers statt durchgehend „B&W".
function fromFor(branding: OrgBranding): string {
  const fallback = parseFrom(
    process.env.MAIL_FROM ?? "Kundenportal <no-reply@bundwimmobilien.de>"
  );
  const name = branding.displayName || fallback.name;
  // Anführungszeichen im Namen würden den Header zerlegen
  return name ? `"${name.replace(/"/g, "")}" <${fallback.address}>` : fallback.address;
}

export async function sendMail(
  to: string | null | undefined,
  subject: string,
  text: string,
  attachments: MailAttachment[] | undefined,
  branding: OrgBranding
): Promise<MailOutcome> {
  if (!to) {
    // Zugänge ohne E-Mail-Adresse (Zugangsschreiben) erhalten keine Mails
    return "no_recipient";
  }
  const t = transport();
  if (!t) {
    console.log(`[mail deaktiviert] an=${to} betreff=${subject}`);
    return "disabled";
  }
  try {
    await t.sendMail({
      from: fromFor(branding),
      // Antworten sollen bei der Verwaltung landen, nicht in einem
      // No-Reply-Postfach des Betreibers. Fehlt die Adresse, bleibt es beim
      // bisherigen Verhalten (keine Antwortadresse).
      replyTo: branding.email ?? undefined,
      to,
      subject,
      text,
      html: renderHtml(subject, text, branding),
      attachments,
    });
    return "sent";
  } catch (error) {
    // Versandfehler dürfen nie eine Nutzeraktion blockieren
    console.error("E-Mail-Versand fehlgeschlagen:", error);
    return "failed";
  }
}

// Wie viele von mehreren Versandversuchen tatsächlich rausgingen – der Wert,
// den eine Rückmeldung nennen darf. `disabled` wird getrennt gemeldet, weil
// „0 von 12 versandt" etwas anderes ist als „Versand ist nicht eingerichtet".
export function summarizeMail(outcomes: MailOutcome[]): {
  sent: number;
  disabled: boolean;
} {
  return {
    sent: outcomes.filter((o) => o === "sent").length,
    disabled: outcomes.length > 0 && outcomes.every((o) => o === "disabled"),
  };
}
