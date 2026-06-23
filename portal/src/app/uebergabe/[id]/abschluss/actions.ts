"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";
import { sendMail } from "@/lib/mailer";
import { createHandoverPdf, ensureHandoverPdfBuffer } from "@/lib/handover";

export async function generateHandoverPdf(handoverId: string) {
  await requireVerwalter();
  await createHandoverPdf(handoverId);
  revalidatePath(`/uebergabe/${handoverId}/abschluss`);
}

export async function sendHandoverEmail(formData: FormData) {
  await requireVerwalter();

  const handoverId = String(formData.get("handoverId") ?? "").trim();
  const recipients = (formData.getAll("emailTo") as string[]).map((e) => e.trim()).filter(Boolean);
  const emailBody = String(formData.get("emailBody") ?? "").trim();

  if (!handoverId || recipients.length === 0) return;

  const handover = await db.handover.findUnique({
    where: { id: handoverId },
    select: { unit: { select: { label: true, property: { select: { name: true } } } } },
  });
  if (!handover) return;

  const pdfBuffer = await ensureHandoverPdfBuffer(handoverId);
  if (!pdfBuffer) return;

  const subject = `Übergabeprotokoll – ${handover.unit.property.name}, ${handover.unit.label}`;
  const attachments = [
    { filename: "Uebergabeprotokoll.pdf", content: pdfBuffer, contentType: "application/pdf" },
  ];

  for (const to of recipients) {
    await sendMail(to, subject, emailBody, attachments);
  }

  revalidatePath(`/uebergabe/${handoverId}/abschluss`);
  redirect(`/uebergabe/${handoverId}/abschluss?sent=${recipients.length}`);
}
