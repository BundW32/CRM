"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";
import { canVerwalterAccessHandover } from "@/lib/access";
import { createHandoverPdf } from "@/lib/handover";

export async function finalizeHandover(formData: FormData) {
  const verwalter = await requireVerwalter();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  if (!(await canVerwalterAccessHandover(verwalter, id))) redirect("/uebergabe");

  const tenantSignature = String(formData.get("tenantSignature") ?? "").trim() || null;
  const tenant2Signature = String(formData.get("tenant2Signature") ?? "").trim() || null;
  const managerSignature = String(formData.get("managerSignature") ?? "").trim() || null;

  await db.handover.update({
    where: { id },
    data: {
      tenantSignature,
      tenant2Signature,
      managerSignature,
      status: "ABGESCHLOSSEN",
    },
  });

  // PDF direkt beim Abschließen erzeugen (mit eingebetteten Unterschriften).
  await createHandoverPdf(id);

  redirect(`/uebergabe/${id}/abschluss`);
}
