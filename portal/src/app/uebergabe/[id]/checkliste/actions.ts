"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";

export async function saveCheckliste(formData: FormData) {
  await requireVerwalter();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const checklist: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("check_")) {
      checklist[key.slice(6)] = String(value);
    } else if (key.startsWith("note_")) {
      const val = String(value).trim();
      if (val) checklist[key] = val;
    }
  }

  const generalNotes = String(formData.get("generalNotes") ?? "").trim() || null;
  const agreements = String(formData.get("agreements") ?? "").trim() || null;
  const action = String(formData.get("_action") ?? "next");

  await db.handover.update({
    where: { id },
    data: {
      checklist,
      generalNotes,
      agreements,
    },
  });

  if (action === "save") redirect(`/uebergabe`);
  redirect(`/uebergabe/${id}/zaehler`);
}
