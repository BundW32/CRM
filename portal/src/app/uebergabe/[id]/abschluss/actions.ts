"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";
import { saveBuffer } from "@/lib/storage";
import { generateHandoverPdfBuffer } from "@/lib/handover-pdf";
import { sendMail } from "@/lib/mailer";

export async function generateHandoverPdf(handoverId: string) {
  await requireVerwalter();

  const handover = await db.handover.findUnique({
    where: { id: handoverId },
    include: {
      unit: { include: { property: true } },
      rooms: { include: { photos: true } },
      meters: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!handover) return;

  const pdfBuffer = await generateHandoverPdfBuffer(handover);

  const unitLabel = handover.unit.label.replace(/[^a-zA-Z0-9]/g, "_");
  const dateStr = handover.handoverDate.toISOString().split("T")[0];
  const fileName = `uebergabe_${unitLabel}_${dateStr}.pdf`;

  const { storedName } = await saveBuffer(pdfBuffer, fileName, "application/pdf", ["application/pdf"]);

  await db.handover.update({
    where: { id: handoverId },
    data: { pdfStoredName: storedName },
  });

  revalidatePath(`/uebergabe/${handoverId}/abschluss`);
}

export async function sendHandoverEmail(formData: FormData) {
  await requireVerwalter();

  const handoverId = String(formData.get("handoverId") ?? "").trim();
  const recipients = formData.getAll("emailTo") as string[];
  const emailBody = String(formData.get("emailBody") ?? "").trim();

  if (!handoverId || recipients.length === 0) return;

  const handover = await db.handover.findUnique({
    where: { id: handoverId },
    select: { pdfStoredName: true, unit: { include: { property: true } } },
  });
  if (!handover) return;

  const subject = `Übergabeprotokoll – ${handover.unit.property.name}, ${handover.unit.label}`;

  for (const to of recipients) {
    if (!to.trim()) continue;
    await sendMail(to.trim(), subject, emailBody);
  }

  revalidatePath(`/uebergabe/${handoverId}/abschluss`);
}
