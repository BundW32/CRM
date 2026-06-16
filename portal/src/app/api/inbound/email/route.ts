import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { portalUrl, sendMail } from "@/lib/mailer";
import { notifyVerwalterNewTicket } from "@/lib/notify";
import { saveUpload } from "@/lib/storage";
import { applyTriage } from "@/lib/triage";

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

async function notifyVerwalter(subject: string, body: string) {
  const verwalter = await db.user.findMany({
    where: { role: "VERWALTER", active: true },
    select: { email: true },
  });
  await Promise.all(verwalter.map((v) => sendMail(v.email, subject, body)));
}

export async function POST(request: Request) {
  const secret = process.env.INBOUND_EMAIL_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Inbound nicht konfiguriert" }, { status: 503 });
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

  // Idempotenz: wurde diese Mail schon zu einem Ticket verarbeitet?
  if (messageId) {
    const existing = await db.ticket.findUnique({ where: { inboundMessageId: messageId } });
    if (existing) {
      return NextResponse.json({ ok: true, duplicate: true, ticketId: existing.id });
    }
  }

  // Absender bestimmen
  const matched = await db.user.findUnique({ where: { email: from } });
  const knownUser = matched && matched.active ? matched : null;

  let propertyId: string | null = null;
  let unitId: string | null = null;
  let createdById: string;
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
  } else {
    // Unbekannter Absender: Vorgang trotzdem anlegen (unter dem Verwalter), Absender merken
    const fallback = await db.user.findFirst({
      where: { role: "VERWALTER", active: true },
      select: { id: true },
    });
    if (!fallback) {
      return NextResponse.json({ ok: true, noVerwalter: true });
    }
    createdById = fallback.id;
    senderEmail = from;
    senderName = fromName;
  }

  // Anhänge (nur Bilder) speichern – ContentType tolerant behandeln
  const uploads: Awaited<ReturnType<typeof saveUpload>>[] = [];
  for (const att of normalizeAttachments(body)) {
    const type = att.type.split(";")[0].trim().toLowerCase(); // z. B. "image/jpeg; name=…" → "image/jpeg"
    if (!type.startsWith("image/")) continue; // nur Bilder als Vorgangs-Foto
    try {
      const file = new File([Buffer.from(att.b64, "base64")], att.name, { type });
      uploads.push(await saveUpload(file, [type]));
    } catch {
      // ungeeignete Anhänge (z. B. zu groß) überspringen
    }
  }

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
    await sendMail(
      from,
      `Ihre Meldung #${ticket.number} ist eingegangen`,
      `Guten Tag ${knownUser.name},\n\n` +
        `Ihre Meldung „${subject}" ist bei der B&W Immobilien Management UG eingegangen und ` +
        `wird unter der Vorgangsnummer #${ticket.number} bearbeitet.\n\n` +
        `Sie können den Stand jederzeit im Kundenportal verfolgen.\n\n` +
        `Mit freundlichen Grüßen\nB&W Immobilien Management UG`
    );
  } else {
    await notifyVerwalter(
      `Neue Meldung #${ticket.number} (Absender nicht zugeordnet)`,
      `Es ist eine E-Mail-Meldung von einem nicht hinterlegten Absender eingegangen ` +
        `und wurde als Vorgang #${ticket.number} angelegt.\n\n` +
        `Von: ${fromName ? `${fromName} <${from}>` : from}\nBetreff: ${subject}\n\n` +
        `Bitte im Portal einem Objekt/Mieter zuordnen:\n${portalUrl(`/vorgaenge/${ticket.id}`)}`
    );
  }

  return NextResponse.json({ ok: true, ticketId: ticket.id, number: ticket.number });
}
