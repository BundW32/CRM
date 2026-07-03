"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { PlatformInvoiceStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { AUDIT, logAudit } from "@/lib/audit";
import { INVOICE_TRANSITIONS, requirePlatformAdmin } from "@/lib/platform";
import { getClientIp } from "@/lib/rate-limit";

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
  redirect(`/plattform/rechnungen/${createdId}`);
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
    select: { status: true, issuedAt: true, dueAt: true },
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
  revalidatePath(`/plattform/rechnungen/${id}`);
  redirect(`/plattform/rechnungen/${id}`);
}
