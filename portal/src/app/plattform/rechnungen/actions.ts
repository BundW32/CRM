"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { PlatformInvoiceStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { AUDIT, logAudit } from "@/lib/audit";
import { INVOICE_TRANSITIONS, formatCents, formatInvoiceNumber, invoiceGrossCents, requirePlatformAdmin } from "@/lib/platform";
import { type InvoiceMailResult, loadInvoiceForPdf, mailInvoicePdf } from "@/lib/platform-invoice-service";
import { canRemindAgain, isOverdue, nextReminderLevel, reminderCopy } from "@/lib/dunning";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

function ddmmyyyy(d: Date | null): string {
  return d
    ? `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`
    : "—";
}

// Betreff + Text der Rechnungs-E-Mail (B&W als Aussteller).
function invoiceMailBody(invoice: NonNullable<Awaited<ReturnType<typeof loadInvoiceForPdf>>>) {
  const nr = formatInvoiceNumber(invoice.year, invoice.number);
  const gross = invoiceGrossCents(invoice.vatRate, invoice.items);
  const due = invoice.dueAt
    ? `${String(invoice.dueAt.getDate()).padStart(2, "0")}.${String(invoice.dueAt.getMonth() + 1).padStart(2, "0")}.${invoice.dueAt.getFullYear()}`
    : null;
  const subject = `Rechnung ${nr}`;
  const text =
    `Guten Tag,\n\n` +
    `anbei erhalten Sie die Rechnung ${nr}${invoice.title ? ` (${invoice.title})` : ""}.\n\n` +
    `Rechnungsbetrag: ${formatCents(gross)}\n` +
    (due ? `Zahlbar bis: ${due}\n` : "") +
    `\nDie Rechnung finden Sie als PDF im Anhang.\n\n` +
    `Mit freundlichen Grüßen`;
  return { subject, text };
}

// Versendet die Rechnung als PDF-Anhang an den Kunden und vermerkt sentAt.
// Gibt eine Statuskennung für die Fehleranzeige zurück (kein Redirect).
async function sendAndMarkSent(
  invoiceId: string,
  actorId: string,
): Promise<InvoiceMailResult | "not_found"> {
  const invoice = await loadInvoiceForPdf(invoiceId);
  if (!invoice) return "not_found";
  const { subject, text } = invoiceMailBody(invoice);
  const result = await mailInvoicePdf(invoice, subject, text);
  if (result === "sent") {
    await db.platformInvoice.update({ where: { id: invoiceId }, data: { sentAt: new Date() } });
    await logAudit({
      actorId,
      action: AUDIT.PLATFORM_INVOICE_SENT,
      targetType: "PlatformInvoice",
      targetId: invoiceId,
      ip: await getClientIp(),
    });
  }
  return result;
}

// ── Mahnwesen ─────────────────────────────────────────────────────────────────
type ReminderResult = InvoiceMailResult | "not_overdue" | "too_soon" | "not_found";

// Mahnt eine einzelne Rechnung (eine Stufe höher). Prüft Überfälligkeit +
// Mindestabstand; versendet Rechnungs-PDF mit Mahntext, erhöht die Stufe.
async function remindOne(invoiceId: string, actorId: string, now: Date): Promise<ReminderResult> {
  const invoice = await loadInvoiceForPdf(invoiceId);
  if (!invoice) return "not_found";
  if (!isOverdue(invoice, now)) return "not_overdue";
  if (!canRemindAgain(invoice.lastReminderAt, now)) return "too_soon";

  const level = nextReminderLevel(invoice.reminderLevel);
  const { subject, text } = reminderCopy(level, {
    invoiceNo: formatInvoiceNumber(invoice.year, invoice.number),
    grossFormatted: formatCents(invoiceGrossCents(invoice.vatRate, invoice.items)),
    dueDateFormatted: ddmmyyyy(invoice.dueAt),
  });
  const result = await mailInvoicePdf(invoice, subject, text);
  if (result !== "sent") return result;

  await db.platformInvoice.update({
    where: { id: invoiceId },
    data: { reminderLevel: level, lastReminderAt: now },
  });
  await logAudit({
    actorId,
    action: AUDIT.PLATFORM_INVOICE_REMINDER,
    targetType: "PlatformInvoice",
    targetId: invoiceId,
    meta: { level },
    ip: await getClientIp(),
  });
  return "sent";
}

// Eine überfällige Rechnung mahnen (Button je Zeile/Detail).
export async function sendReminder(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/plattform/rechnungen");
  const result = await remindOne(id, admin.id, new Date());
  revalidatePath("/plattform/rechnungen");
  revalidatePath(`/plattform/rechnungen/${id}`);
  redirect(`/plattform/rechnungen?mahnung=${result}`);
}

// Alle fälligen (und wieder mahnbaren) Rechnungen auf einmal mahnen.
export async function sendAllDueReminders() {
  const admin = await requirePlatformAdmin();
  if (!(await checkRateLimit(`dunning-bulk:${admin.id}`, 3, 3600))) {
    redirect("/plattform/rechnungen?mahnung=limit");
  }
  const now = new Date();
  const due = await db.platformInvoice.findMany({
    where: { status: "OFFEN", dueAt: { lt: now } },
    select: { id: true },
  });
  let sent = 0;
  for (const inv of due) {
    const r = await remindOne(inv.id, admin.id, now);
    if (r === "sent") sent++;
  }
  revalidatePath("/plattform/rechnungen");
  redirect(`/plattform/rechnungen?gemahnt=${sent}`);
}

// Rechnung (erneut) per E-Mail an den Kunden senden.
export async function sendInvoiceEmail(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/plattform/rechnungen");
  // Leichte Drossel gegen versehentliches Mehrfach-Senden.
  if (!(await checkRateLimit(`invmail:${id}`, 3, 3600))) {
    redirect(`/plattform/rechnungen/${id}?hinweis=limit`);
  }
  const result = await sendAndMarkSent(id, admin.id);
  revalidatePath(`/plattform/rechnungen/${id}`);
  redirect(`/plattform/rechnungen/${id}?${result === "sent" ? "hinweis=gesendet" : `fehler=${result}`}`);
}

function parseCents(raw: string): number {
  // Akzeptiert "12,50" oder "12.50" → Cent.
  const norm = raw.trim().replace(/\./g, "").replace(",", ".");
  const val = Number.parseFloat(norm);
  if (Number.isNaN(val)) return NaN;
  return Math.round(val * 100);
}

// Neue Rechnung anlegen – Nummer fortlaufend pro Jahr, kollisionsfest (Unique-Index
// [year, number] + Retry bei P2002, Muster wie closeResolution).
export async function createInvoice(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const organizationId = String(formData.get("organizationId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim().slice(0, 200);
  const vatRate = Math.max(0, Math.min(100, Number.parseInt(String(formData.get("vatRate") ?? "19"), 10) || 0));
  const dueStr = String(formData.get("dueAt") ?? "").trim();

  if (!organizationId || !title) redirect("/plattform/rechnungen/neu?fehler=eingabe");
  const org = await db.organization.findUnique({ where: { id: organizationId }, select: { id: true } });
  if (!org) redirect("/plattform/rechnungen/neu?fehler=eingabe");

  const descriptions = formData.getAll("item_description").map((v) => String(v).trim());
  const quantities = formData.getAll("item_quantity").map((v) => String(v));
  const prices = formData.getAll("item_price").map((v) => String(v));
  const items: { description: string; quantity: number; unitPriceCents: number; position: number }[] = [];
  for (let i = 0; i < descriptions.length; i++) {
    if (!descriptions[i]) continue;
    const qty = Math.max(1, Number.parseInt(quantities[i] ?? "1", 10) || 1);
    const cents = parseCents(prices[i] ?? "");
    if (Number.isNaN(cents)) redirect("/plattform/rechnungen/neu?fehler=betrag");
    items.push({ description: descriptions[i].slice(0, 300), quantity: qty, unitPriceCents: cents, position: items.length });
  }
  if (items.length === 0) redirect("/plattform/rechnungen/neu?fehler=positionen");

  const dueAt = dueStr ? new Date(dueStr) : null;
  const year = new Date().getFullYear();

  let createdId: string | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const invoice = await db.$transaction(async (tx) => {
        const last = await tx.platformInvoice.findFirst({
          where: { year },
          orderBy: { number: "desc" },
          select: { number: true },
        });
        const number = (last?.number ?? 0) + 1;
        return tx.platformInvoice.create({
          data: {
            organizationId,
            year,
            number,
            title,
            vatRate,
            dueAt: dueAt && !Number.isNaN(dueAt.getTime()) ? dueAt : null,
            createdById: admin.id,
            items: { create: items },
          },
          select: { id: true },
        });
      });
      createdId = invoice.id;
      break;
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "P2002" && attempt < 3) continue;
      throw err;
    }
  }
  if (!createdId) redirect("/plattform/rechnungen?fehler=nummer");

  await logAudit({
    actorId: admin.id,
    action: AUDIT.PLATFORM_INVOICE_CREATED,
    targetType: "PlatformInvoice",
    targetId: createdId,
    meta: { organizationId, year, items: items.length },
    ip: await getClientIp(),
  });
  revalidatePath("/plattform/rechnungen");
  redirect(`/plattform/rechnungen/${createdId}?flash=erstellt`);
}

// Status ändern (nur erlaubte Übergänge). OFFEN setzt issuedAt + Default-Fälligkeit,
// BEZAHLT setzt paidAt.
export async function setInvoiceStatus(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const next = String(formData.get("status") ?? "") as PlatformInvoiceStatus;
  if (!id) redirect("/plattform/rechnungen");

  const invoice = await db.platformInvoice.findUnique({
    where: { id },
    select: { status: true, issuedAt: true, dueAt: true, sentAt: true },
  });
  if (!invoice) redirect("/plattform/rechnungen");
  if (!INVOICE_TRANSITIONS[invoice.status].includes(next)) {
    redirect(`/plattform/rechnungen/${id}?fehler=status`);
  }

  const now = new Date();
  const data: {
    status: PlatformInvoiceStatus;
    issuedAt?: Date;
    dueAt?: Date;
    paidAt?: Date;
  } = { status: next };
  if (next === "OFFEN") {
    if (!invoice.issuedAt) data.issuedAt = now;
    if (!invoice.dueAt) data.dueAt = new Date(now.getTime() + 14 * 86_400_000);
  }
  if (next === "BEZAHLT") data.paidAt = now;

  await db.platformInvoice.update({ where: { id }, data });
  await logAudit({
    actorId: admin.id,
    action: AUDIT.PLATFORM_INVOICE_STATUS,
    targetType: "PlatformInvoice",
    targetId: id,
    meta: { from: invoice.status, to: next },
    ip: await getClientIp(),
  });

  // Beim Stellen (ENTWURF → OFFEN) die Rechnung automatisch per E-Mail versenden,
  // sofern noch nicht versendet. Ein fehlender Empfänger/SMTP blockiert nicht –
  // der Betreiber kann später manuell „erneut senden".
  let mailHint = "";
  if (next === "OFFEN" && !invoice.sentAt) {
    const result = await sendAndMarkSent(id, admin.id);
    if (result !== "sent") mailHint = `?hinweis=nicht_gesendet`;
  }
  revalidatePath(`/plattform/rechnungen/${id}`);
  redirect(`/plattform/rechnungen/${id}${mailHint}?flash=gespeichert`);
}
