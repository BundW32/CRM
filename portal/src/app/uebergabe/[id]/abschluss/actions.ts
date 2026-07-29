"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";
import { canVerwalterAccessHandover } from "@/lib/access";
import { getBrandingForOrg } from "@/lib/branding-server";
import { type MailOutcome, sendMail, summarizeMail } from "@/lib/mailer";
import { createHandoverPdf, ensureHandoverPdfBuffer } from "@/lib/handover";

export async function generateHandoverPdf(handoverId: string) {
  const verwalter = await requireVerwalter();
  if (!(await canVerwalterAccessHandover(verwalter, handoverId))) redirect("/uebergabe");
  await createHandoverPdf(handoverId);
  revalidatePath(`/uebergabe/${handoverId}/abschluss`);
}

export async function sendHandoverEmail(formData: FormData) {
  const verwalter = await requireVerwalter();

  const handoverId = String(formData.get("handoverId") ?? "").trim();
  const recipients = (formData.getAll("emailTo") as string[]).map((e) => e.trim()).filter(Boolean);
  const emailBody = String(formData.get("emailBody") ?? "").trim();

  if (!handoverId || recipients.length === 0) return;
  if (!(await canVerwalterAccessHandover(verwalter, handoverId))) redirect("/uebergabe");

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

  const branding = await getBrandingForOrg(verwalter.organizationId);
  const versand: MailOutcome[] = [];
  for (const to of recipients) {
    versand.push(await sendMail(to, subject, emailBody, attachments, branding));
  }
  // Bisher meldete die Seite „an N Empfänger gesendet" mit der Zahl der
  // angehakten Adressen – auch ohne konfiguriertes SMTP, wo gar nichts rausging.
  const { sent, disabled } = summarizeMail(versand);

  revalidatePath(`/uebergabe/${handoverId}/abschluss`);
  redirect(
    disabled
      ? `/uebergabe/${handoverId}/abschluss?versand=aus`
      : `/uebergabe/${handoverId}/abschluss?sent=${sent}&von=${recipients.length}`,
  );
}
