"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";

export async function finalizeHandover(formData: FormData) {
  await requireVerwalter();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const tenantSignature = String(formData.get("tenantSignature") ?? "").trim() || null;
  const managerSignature = String(formData.get("managerSignature") ?? "").trim() || null;

  await db.handover.update({
    where: { id },
    data: {
      tenantSignature,
      managerSignature,
      status: "ABGESCHLOSSEN",
    },
  });

  redirect(`/uebergabe/${id}/abschluss`);
}
