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

// Hinweis: MEA und voteUnits werden nicht mehr hier gepflegt, sondern aus den
// Einheiten-Miteigentumsanteilen (Unit.mea) und der Einheiten-Eigentümerschaft
// abgeleitet (siehe lib/weg/mea-sync.ts). Das vermeidet doppelte MEA-Eingaben.

// Kennzeichnet einen Eigentümer als Mitglied des Verwaltungsbeirats (oder entfernt
// die Kennzeichnung). Unabhängig von laufenden Abstimmungen (kein Stimmgewicht).
export async function updateBoardMember(formData: FormData) {
  const actor = await requireVerwalter();
  const id = String(formData.get("ownershipId") ?? "").trim();
  if (!id) redirect("/verwaltung/eigentuemer");
  const ownership = await db.ownership.findUnique({ where: { id }, select: { propertyId: true } });
  if (!ownership) redirect("/verwaltung/eigentuemer");
  if (!(await canVerwalterAccessProperty(actor, ownership.propertyId))) {
    redirect("/verwaltung/eigentuemer");
  }
  const isBoardMember = String(formData.get("isBoardMember") ?? "") === "1";
  await db.ownership.update({ where: { id }, data: { isBoardMember } });
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
