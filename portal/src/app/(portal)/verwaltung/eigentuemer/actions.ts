"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canVerwalterAccessProperty } from "@/lib/access";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";

function backTo(propertyId: string) {
  return `/verwaltung/eigentuemer?objekt=${encodeURIComponent(propertyId)}`;
}

// Läuft an diesem Objekt gerade eine Abstimmung? Dann dürfen Stimmgewichte und
// Stimmprinzip nicht geändert werden (sonst würden abgegebene Stimmen rückwirkend
// umgewichtet).
async function hasOpenResolution(propertyId: string): Promise<boolean> {
  const count = await db.resolution.count({ where: { propertyId, status: "OFFEN" } });
  return count > 0;
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
  // Nicht während laufender Abstimmung ändern.
  if (await hasOpenResolution(ownership.propertyId)) {
    redirect(`${backTo(ownership.propertyId)}&fehler=offen`);
  }

  // Nicht-numerische Eingaben werden zu null (nicht stillschweigend 0), damit ein
  // Tippfehler nicht das Stimmgewicht auf 0 setzt. "0" bleibt eine gültige 0.
  const parseInt0 = (key: string) => {
    const raw = String(formData.get(key) ?? "").trim();
    if (raw === "") return null;
    const n = Number.parseInt(raw, 10);
    if (Number.isNaN(n)) return null;
    return Math.max(0, Math.min(10_000_000, n));
  };

  await db.ownership.update({
    where: { id },
    data: { mea: parseInt0("mea"), voteUnits: parseInt0("voteUnits") },
  });
  revalidatePath("/verwaltung/eigentuemer");
  redirect(backTo(ownership.propertyId));
}

// Ändert das Stimmprinzip eines Objekts (KOPF/MEA/OBJEKT).
export async function updateVotingPrinciple(formData: FormData) {
  const actor = await requireVerwalter();
  const propertyId = String(formData.get("propertyId") ?? "").trim();
  if (!propertyId) redirect("/verwaltung/eigentuemer");
  if (!(await canVerwalterAccessProperty(actor, propertyId))) {
    redirect("/verwaltung/eigentuemer");
  }
  // Nicht während laufender Abstimmung ändern.
  if (await hasOpenResolution(propertyId)) {
    redirect(`${backTo(propertyId)}&fehler=offen`);
  }
  const vpRaw = String(formData.get("votingPrinciple") ?? "");
  const principle = vpRaw === "MEA" ? "MEA" : vpRaw === "OBJEKT" ? "OBJEKT" : "KOPF";
  await db.property.update({ where: { id: propertyId }, data: { votingPrinciple: principle } });
  revalidatePath("/verwaltung/eigentuemer");
  redirect(backTo(propertyId));
}
