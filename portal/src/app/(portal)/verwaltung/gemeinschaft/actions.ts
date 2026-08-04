"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isSelfManaged } from "@/lib/access";
import { db } from "@/lib/db";
import { getOrganization, requireVerwalter } from "@/lib/session";

/**
 * Der Name der Gemeinschaft — und sonst nichts.
 *
 * Bewusst eine eigene Aktion statt der Mitbenutzung von `saveBranding`: Jene
 * schreibt **alle** Branding-Felder aus dem Formular. Ein Formular mit nur
 * einem Feld würde Impressum, Farbe und Anschrift der Organisation dabei
 * stillschweigend leeren. Eine schmale Aktion kann das nicht.
 */
export async function updateGemeinschaftsname(formData: FormData) {
  const actor = await requireVerwalter();
  if (!actor.isSuperAdmin) redirect("/verwaltung?flash=keine-berechtigung");

  const org = await getOrganization();
  // Professionelle Verwaltungen pflegen den Namen unter „Branding" – dort steht
  // er zwischen Logo, Farbe und Impressum, die für sie zusammengehören.
  if (!org || !isSelfManaged(org)) redirect("/verwaltung/branding");

  const name = String(formData.get("name") ?? "").trim().slice(0, 200);
  if (name.length < 2) redirect("/verwaltung/gemeinschaft?fehler=name");

  await db.organization.update({ where: { id: actor.organizationId }, data: { name } });
  // Der Name steht in der Navigationsleiste jeder Seite.
  revalidatePath("/", "layout");
  redirect("/verwaltung/gemeinschaft?flash=gespeichert");
}
