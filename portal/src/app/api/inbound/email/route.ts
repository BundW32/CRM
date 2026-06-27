import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getBrandingForOrg } from "@/lib/branding-server";
import { portalUrl, sendMail } from "@/lib/mailer";
import { notifyVerwalterNewTicket } from "@/lib/notify";
import { IMAGE_TYPES, saveBuffer } from "@/lib/storage";
import { applyTriage } from "@/lib/triage";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Eingehende E-Mails (von einem Inbound-Parsing-Dienst wie Postmark/Mailgun/
// SendGrid als JSON-Webhook) werden zu Vorgängen. Bekannter Absender → direkt
// zugeordnet; unbekannter Absender → Vorgang ohne Zuordnung, Verwalter ordnet zu.

function extractEmail(raw?: unknown): string | null {
  if (typeof raw !== "string") return null;
  const m = raw.match(/<([^>]+)>/);
  const candidate = (m ? m[1] : raw).trim().toLowerCase();
  return candidate.includes("@") ? candidate : null;
}

function extractName(body: Record<string, unknown>): string | null {
  const direct = body.FromName ?? (body.FromFull as Record<string, unknown> | undefined)?.Name;
  if (typeof direct === "string" && direct.trim()) return direct.trim().slice(0, 200);
  const raw = body.from ?? body.From ?? body.sender;
  if (typeof raw === "string") {
    const m = raw.match(/^\s*"?([^"<]+?)"?\s*</);
    if (m && m[1].trim() && !m[1].includes("@")) return m[1].trim().slice(0, 200);
  }
  return null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type RawAttachment = Record<string, unknown>;

function normalizeAttachments(body: Record<string, unknown>) {
  const list = (body.Attachments ?? body.attachments ?? []) as unknown;
  if (!Array.isArray(list)) return [] as { name: string; type: string; b64: string }[];
  return list
    .map((a: RawAttachment) => ({
      name: String(a.Name ?? a.filename ?? a.fileName ?? "anhang"),
      type: String(a.ContentType ?? a.contentType ?? a.type ?? ""),
      b64: String(a.Content ?? a.content ?? a.contentBase64 ?? ""),
    }))
    .filter((a) => a.b64.length > 0)
    .slice(0, 10);
}

async function notifyVerwalter(organizationId: string, subject: string, body: string) {
  // Nur Verwalter der betroffenen Org benachrichtigen.
  const verwalter = await db.user.findMany({
    where: { role: "VERWALTER", active: true, organizationId },
    select: { email: true },
  });
  const branding = await getBrandingForOrg(organizationId);
  await Promise.all(verwalter.map((v) => sendMail(v.email, subject, body, undefined, branding)));
}

// Vorgangsnummer aus dem Betreff lesen (z. B. "Re: Auftrag #42: …" → 42).
// Alle ausgehenden Mails tragen die Nummer als "#NNN" im Betreff, daher
// taugt das als zuverlässiger Anker für Antworten.
function extractTicketNumber(subject: string): number | null {
  const m = subject.match(/#(\d{1,9})\b/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Nur Bild-Anhänge aus dem Webhook-Body in den Storage schreiben.
async function saveImageAttachments(body: Record<string, unknown>) {
  const uploads: Awaited<ReturnType<typeof saveBuffer>>[] = [];
  for (const att of normalizeAttachments(body)) {
    const type = att.type.split(";")[0].trim().toLowerCase(); // "image/jpeg; name=…" → "image/jpeg"
    // Nur explizit erlaubte Bildtypen (keine SVG o. Ä. – Allowlist, nicht der
    // vom Absender behauptete Typ).
    if (!IMAGE_TYPES.includes(type)) continue;
    try {
      const buf = Buffer.from(att.b64, "base64");
      uploads.push(await saveBuffer(buf, att.name, type, IMAGE_TYPES));
    } catch {
      // ungeeignete Anhänge (z. B. zu groß) überspringen
    }
  }
  return uploads;
}

export async function POST(request: Request) {
  const secret = process.env.INBOUND_EMAIL_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Inbound nicht konfiguriert" }, { status: 503 });
  }

  const ip =
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";

  // Rate limit: 60 Webhook-Aufrufe pro IP pro Minute
  if (!(await checkRateLimit(`inbound:${ip}`, 60, 60))) {
    return NextResponse.json({ error: "Zu viele Anfragen" }, { status: 429 });
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? request.headers.get("x-inbound-secret");
  if (token !== secret) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Ungültiger Body" }, { status: 400 });
  }

  const from =
    extractEmail(body.from) ??
    extractEmail(body.sender) ??
    extractEmail(body.From) ??
    extractEmail((body.FromFull as Record<string, unknown> | undefined)?.Email);
  const fromName = extractName(body);
  const subject = String(body.subject ?? body.Subject ?? "Schadensmeldung (E-Mail)").slice(0, 200);
  const textRaw =
    (body.text as string) ??
    (body["body-plain"] as string) ??
    (body.TextBody as string) ??
    (body.plain as string) ??
    (body["stripped-text"] as string) ??
    "";
  const htmlRaw = (body.html as string) ?? (body.HtmlBody as string) ?? "";
  const text = (textRaw || (htmlRaw ? stripHtml(htmlRaw) : "")).trim().slice(0, 5000);

  // Eindeutige Kennung der Mail – verhindert Doppel-Tickets bei Webhook-Wiederholungen
  const messageId =
    String(body.MessageID ?? body.MessageId ?? body["message-id"] ?? body.messageId ?? "") || null;

  if (!from) {
    return NextResponse.json({ ok: true, ignored: "kein Absender" });
  }

  // Idempotenz: wurde diese Mail schon verarbeitet (als Vorgang ODER Kommentar)?
  if (messageId) {
    const existingTicket = await db.ticket.findUnique({
      where: { inboundMessageId: messageId },
    });
    if (existingTicket) {
      return NextResponse.json({ ok: true, duplicate: true, ticketId: existingTicket.id });
    }
    const existingComment = await db.ticketComment.findUnique({
      where: { inboundMessageId: messageId },
      select: { ticketId: true },
    });
    if (existingComment) {
      return NextResponse.json({ ok: true, duplicate: true, ticketId: existingComment.ticketId });
    }
  }

  // Antwort auf einen bestehenden Vorgang? Vorgangsnummer aus dem Betreff lesen
  // und – falls vorhanden – die Mail als Kommentar anhängen statt einen neuen
  // Vorgang anzulegen. So landen Handwerker-Antworten automatisch am richtigen Auftrag.
  const replyToNumber = extractTicketNumber(subject);
  if (replyToNumber) {
    const target = await db.ticket.findUnique({ where: { number: replyToNumber } });
    if (target) {
      // Absender zuordnen: Handwerker > Portal-Nutzer > unbekannt.
      // Auf die Org des Ziel-Vorgangs einschränken, damit kein fremder Mandant
      // als Autor zugeordnet wird (E-Mail-Adressen könnten org-übergreifend kollidieren).
      const craftsman = await db.craftsman.findFirst({
        where: { email: from, active: true, organizationId: target.organizationId },
        select: { id: true, name: true, company: true },
      });
      const user = craftsman
        ? null
        : await db.user.findFirst({
            where: { email: from, organizationId: target.organizationId },
            select: { id: true, name: true },
          });

      const uploads = await saveImageAttachments(body);
      const senderLabel = craftsman
        ? `${craftsman.company ? `${craftsman.company} / ` : ""}${craftsman.name}`
        : user
          ? user.name
          : `${fromName ? `${fromName} ` : ""}<${from}>`;
      const commentBody =
        (craftsman || user
          ? text || "(kein Text)"
          : `Antwort per E-Mail von ${senderLabel}:\n\n${text || "(kein Text)"}`).slice(0, 5000);

      await db.ticketComment.create({
        data: {
          ticketId: target.id,
          authorId: user?.id ?? null,
          craftsmanAuthorId: craftsman?.id ?? null,
          body: commentBody,
          internal: false,
          inboundMessageId: messageId,
          ...(uploads.length > 0
            ? { attachments: { create: uploads.map((u) => ({ ...u, ticketId: target.id })) } }
            : {}),
        },
      });
      await db.ticket.update({ where: { id: target.id }, data: { updatedAt: new Date() } });

      await notifyVerwalter(
        target.organizationId,
        `Vorgang #${target.number}: Antwort per E-Mail`,
        `Zu Vorgang #${target.number} „${target.title}" ist eine E-Mail-Antwort eingegangen.\n\n` +
          `Von: ${senderLabel}${craftsman ? " (Handwerker)" : ""}\n\n` +
          `${text || "(kein Text)"}\n\n` +
          `Zum Vorgang: ${portalUrl(`/vorgaenge/${target.id}`)}`
      );

      return NextResponse.json({ ok: true, comment: true, ticketId: target.id, number: target.number });
    }
    // Nummer im Betreff, aber kein passender Vorgang → wie eine neue Meldung behandeln
  }

  // Absender bestimmen
  const matched = await db.user.findUnique({ where: { email: from } });
  const knownUser = matched && matched.active ? matched : null;

  let propertyId: string | null = null;
  let unitId: string | null = null;
  let createdById: string;
  let organizationId: string;
  let senderEmail: string | null = null;
  let senderName: string | null = null;

  if (knownUser) {
    const tenancy = await db.tenancy.findFirst({
      where: { userId: knownUser.id, active: true },
      include: { unit: true },
    });
    const ownership = await db.ownership.findFirst({ where: { userId: knownUser.id } });
    propertyId = tenancy?.unit.propertyId ?? ownership?.propertyId ?? null;
    unitId = tenancy?.unitId ?? null;
    createdById = knownUser.id;
    organizationId = knownUser.organizationId;
  } else {
    // Unbekannter Absender: Vorgang trotzdem anlegen (unter dem Verwalter), Absender merken.
    // Die Org des Vorgangs ergibt sich aus dem Fallback-Verwalter.
    const fallback = await db.user.findFirst({
      where: { role: "VERWALTER", active: true },
      select: { id: true, organizationId: true },
    });
    if (!fallback) {
      return NextResponse.json({ ok: true, noVerwalter: true });
    }
    createdById = fallback.id;
    organizationId = fallback.organizationId;
    senderEmail = from;
    senderName = fromName;
  }

  // Anhänge (nur Bilder) speichern – ContentType tolerant, direkt aus dem Buffer
  const uploads = await saveImageAttachments(body);

  let ticket;
  try {
    ticket = await db.ticket.create({
      data: {
        type: "SCHADEN",
        title: subject,
        description: text || "(kein Text)",
        propertyId,
        unitId,
        createdById,
        organizationId,
        senderEmail,
        senderName,
        inboundMessageId: messageId,
        attachments: { create: uploads },
      },
      include: { property: true, unit: true },
    });
  } catch {
    const existing = messageId
      ? await db.ticket.findUnique({ where: { inboundMessageId: messageId } })
      : null;
    if (existing) {
      return NextResponse.json({ ok: true, duplicate: true, ticketId: existing.id });
    }
    return NextResponse.json({ error: "Anlegen fehlgeschlagen" }, { status: 500 });
  }

  const ai = await applyTriage(ticket.id, { title: subject, description: text });
  const triaged = ai ? { ...ticket, trade: ai.trade ?? ticket.trade, priority: ai.priority } : ticket;

  if (knownUser) {
    await notifyVerwalterNewTicket(triaged, knownUser);
    const branding = await getBrandingForOrg(ticket.organizationId);
    await sendMail(
      from,
      `Ihre Meldung #${ticket.number} ist eingegangen`,
      `Guten Tag ${knownUser.name},\n\n` +
        `Ihre Meldung „${subject}" ist bei der ${branding.legalName} eingegangen und ` +
        `wird unter der Vorgangsnummer #${ticket.number} bearbeitet.\n\n` +
        `Sie können den Stand jederzeit im Kundenportal verfolgen.\n\n` +
        `Mit freundlichen Grüßen\n${branding.legalName}`,
      undefined,
      branding
    );
  } else {
    await notifyVerwalter(
      ticket.organizationId,
      `Neue Meldung #${ticket.number} (Absender nicht zugeordnet)`,
      `Es ist eine E-Mail-Meldung von einem nicht hinterlegten Absender eingegangen ` +
        `und wurde als Vorgang #${ticket.number} angelegt.\n\n` +
        `Von: ${fromName ? `${fromName} <${from}>` : from}\nBetreff: ${subject}\n\n` +
        `Bitte im Portal einem Objekt/Mieter zuordnen:\n${portalUrl(`/vorgaenge/${ticket.id}`)}`
    );
  }

  return NextResponse.json({ ok: true, ticketId: ticket.id, number: ticket.number });
}
