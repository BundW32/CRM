"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canVerwalterAccessProperty } from "@/lib/access";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";
import { MANUAL_SETUP_STEPS, type SetupStepKey } from "@/lib/weg/setup-status";

/**
 * Hakt einen Einrichtungsschritt ab, der außerhalb des Systems stattfindet.
 *
 * Nur die drei Schritte aus `MANUAL_SETUP_STEPS` sind zulässig – alle übrigen
 * leiten sich aus den Daten ab. Ließe man beliebige Schlüssel zu, könnte ein
 * untergeschobenes Feld einen Schritt als erledigt markieren, der es nicht ist,
 * und die Einrichtung meldete Vollzug, obwohl die Buchhaltung leer ist.
 */
export async function markSetupStep(formData: FormData) {
  const actor = await requireVerwalter();

  const propertyId = String(formData.get("propertyId") ?? "").trim();
  const key = String(formData.get("key") ?? "").trim();
  if (!propertyId || !MANUAL_SETUP_STEPS.includes(key as SetupStepKey)) redirect("/dashboard");

  // Org-/Zuständigkeits-Scope wie bei jeder schreibenden Aktion (IDOR-Schutz).
  if (!(await canVerwalterAccessProperty(actor, propertyId))) redirect("/dashboard");

  // Idempotent über den Unique-Index (propertyId, key): zweimaliges Abschicken
  // ändert nichts, statt einen zweiten Vermerk anzulegen.
  await db.wegSetupStep.upsert({
    where: { propertyId_key: { propertyId, key } },
    create: { propertyId, key, doneById: actor.id },
    update: {},
  });

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
