"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canVerwalterAccessProperty } from "@/lib/access";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";

function backTo(propertyId: string) {
  return `/verwaltung/eigentuemer?objekt=${encodeURIComponent(propertyId)}`;
}

// Setzt den Miteigentumsanteil (MEA) eines Eigentümers an einem Objekt.
export async function updateOwnershipMea(formData: FormData) {
  const actor = await requireVerwalter();
  const id = String(formData.get("ownershipId") ?? "").trim();
  if (!id) redirect("/verwaltung/eigentuemer");

  const ownership = await db.ownership.findUnique({
    where: { id },
    select: { propertyId: true },
  });
  if (!ownership) redirect("/verwaltung/eigentuemer");
  // Scope-/Org-Wand: nur Objekte im eigenen Zuständigkeitsbereich.
  if (!(await canVerwalterAccessProperty(actor, ownership.propertyId))) {
    redirect("/verwaltung/eigentuemer");
  }

  const parseInt0 = (key: string) => {
    const raw = String(formData.get(key) ?? "").trim();
    return raw === "" ? null : Math.max(0, Math.min(10_000_000, parseInt(raw, 10) || 0));
  };

  await db.ownership.update({
    where: { id },
    data: { mea: parseInt0("mea"), voteUnits: parseInt0("voteUnits") },
  });
  revalidatePath("/verwaltung/eigentuemer");
  redirect(backTo(ownership.propertyId));
}

// Ändert das Stimmprinzip eines Objekts (KOPF/MEA).
export async function updateVotingPrinciple(formData: FormData) {
  const actor = await requireVerwalter();
  const propertyId = String(formData.get("propertyId") ?? "").trim();
  if (!propertyId) redirect("/verwaltung/eigentuemer");
  if (!(await canVerwalterAccessProperty(actor, propertyId))) {
    redirect("/verwaltung/eigentuemer");
  }
  const vpRaw = String(formData.get("votingPrinciple") ?? "");
  const principle = vpRaw === "MEA" ? "MEA" : vpRaw === "OBJEKT" ? "OBJEKT" : "KOPF";
  await db.property.update({ where: { id: propertyId }, data: { votingPrinciple: principle } });
  revalidatePath("/verwaltung/eigentuemer");
  redirect(backTo(propertyId));
}
