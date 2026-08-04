"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isBoardMemberOf } from "@/lib/access";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

// Prüfvermerk des Beirats auf einen Wirtschaftsplan bzw. eine Jahresabrechnung
// setzen (§ 29 III WEG). Nur ein Beiratsmitglied des jeweiligen Objekts.
export async function setBeiratReview(formData: FormData) {
  const user = await requireUser();
  const kind = String(formData.get("kind") ?? ""); // "plan" | "statement"
  const id = String(formData.get("id") ?? "").trim();
  const statusRaw = String(formData.get("status") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 2000) || null;
  const back = String(formData.get("back") ?? "/finanzen");

  if (!id || (statusRaw !== "GEPRUEFT" && statusRaw !== "ANMERKUNGEN")) redirect(back);
  const status = statusRaw as "GEPRUEFT" | "ANMERKUNGEN";

  // Objekt des Datensatzes bestimmen (org-gebunden) und Beiratsmandat prüfen.
  const propertyId =
    kind === "plan"
      ? (await db.economicPlan.findFirst({
          where: { id, organizationId: user.organizationId },
          select: { propertyId: true },
        }))?.propertyId
      : kind === "statement"
        ? (await db.annualStatement.findFirst({
            where: { id, organizationId: user.organizationId },
            select: { propertyId: true },
          }))?.propertyId
        : undefined;

  if (!propertyId || !(await isBoardMemberOf(user.id, propertyId))) redirect(back);

  const data = {
    beiratReviewStatus: status,
    beiratReviewNote: note,
    beiratReviewById: user.id,
    beiratReviewedAt: new Date(),
  };
  if (kind === "plan") {
    await db.economicPlan.update({ where: { id }, data });
  } else {
    await db.annualStatement.update({ where: { id }, data });
  }
  revalidatePath(back);
  redirect(back);
}
