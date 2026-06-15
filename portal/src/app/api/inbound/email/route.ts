import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import { notifyVerwalterNewTicket } from "@/lib/notify";
import { IMAGE_TYPES, saveUpload } from "@/lib/storage";
import { applyTriage } from "@/lib/triage";

export const dynamic = "force-dynamic";

// Eingehende E-Mails (von einem Inbound-Parsing-Dienst wie Postmark/Mailgun/
// SendGrid als JSON-Webhook) werden zu Schadensmeldungen. Absender wird über die
// E-Mail-Adresse einem Nutzer zugeordnet.

function extractEmail(raw?: unknown): string | null {
  if (typeof raw !== "string") return null;
  const m = raw.match(/<([^>]+)>/);
  const candidate = (m ? m[1] : raw).trim().toLowerCase();
  return candidate.includes("@") ? candidate : null;
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

async function notifyVerwalterUnmatched(from: string, subject: string, text: string) {
  const verwalter = await db.user.findMany({
    where: { role: "VERWALTER", active: true },
    select: { email: true },
  });
  await Promise.all(
    verwalter.map((v) =>
      sendMail(
        v.email,
        `Unzuordenbare Meldung per E-Mail von ${from}`,
        `Es ist eine E-Mail-Meldung eingegangen, die keinem Portal-Nutzer zugeordnet ` +
          `werden konnte.\n\nVon: ${from}\nBetreff: ${subject}\n\n${text}\n\n` +
          `Bitte ggf. manuell als Vorgang anlegen.`
      )
    )
  );
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

  if (!from) {
    return NextResponse.json({ ok: true, ignored: "kein Absender" });
  }

  const user = await db.user.findUnique({ where: { email: from } });
  if (!user || !user.active) {
    await notifyVerwalterUnmatched(from, subject, text);
    return NextResponse.json({ ok: true, unmatched: true });
  }

  // Bezugsobjekt/-einheit aus Mietverhältnis bzw. Eigentum ableiten
  const tenancy = await db.tenancy.findFirst({
    where: { userId: user.id, active: true },
    include: { unit: true },
  });
  const ownership = await db.ownership.findFirst({ where: { userId: user.id } });
  const propertyId = tenancy?.unit.propertyId ?? ownership?.propertyId;
  if (!propertyId) {
    await notifyVerwalterUnmatched(from, subject, text);
    return NextResponse.json({ ok: true, unmatched: "kein Objekt" });
  }

  // Anhänge (nur Bilder) speichern
  const uploads: Awaited<ReturnType<typeof saveUpload>>[] = [];
  for (const att of normalizeAttachments(body)) {
    try {
      const file = new File([Buffer.from(att.b64, "base64")], att.name, { type: att.type });
      uploads.push(await saveUpload(file, IMAGE_TYPES));
    } catch {
      // ungeeignete Anhänge (z. B. zu groß oder kein Bild) überspringen
    }
  }

  const ticket = await db.ticket.create({
    data: {
      type: "SCHADEN",
      title: subject,
      description: text || "(kein Text)",
      propertyId,
      unitId: tenancy?.unitId ?? null,
      createdById: user.id,
      attachments: { create: uploads },
    },
    include: { property: true, unit: true },
  });

  const ai = await applyTriage(ticket.id, { title: subject, description: text });
  const triaged = ai ? { ...ticket, trade: ai.trade ?? ticket.trade, priority: ai.priority } : ticket;

  await notifyVerwalterNewTicket(triaged, user);

  // Eingangsbestätigung an den Absender
  await sendMail(
    from,
    `Ihre Meldung #${ticket.number} ist eingegangen`,
    `Guten Tag ${user.name},\n\n` +
      `Ihre Meldung „${subject}" ist bei der B&W Immobilien Management UG eingegangen und ` +
      `wird unter der Vorgangsnummer #${ticket.number} bearbeitet.\n\n` +
      `Sie können den Stand jederzeit im Kundenportal verfolgen.\n\n` +
      `Mit freundlichen Grüßen\nB&W Immobilien Management UG`
  );

  return NextResponse.json({ ok: true, ticketId: ticket.id, number: ticket.number });
}
