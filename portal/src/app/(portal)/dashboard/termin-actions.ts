"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canVerwalterAccessProperty } from "@/lib/access";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";

const INTERVALLE = [
  "EINMALIG",
  "MONATLICH",
  "QUARTALSWEISE",
  "HALBJAEHRLICH",
  "JAEHRLICH",
  "ZWEIJAEHRLICH",
  "DREIJAEHRLICH",
] as const;

/**
 * Legt einen eigenen Termin der Gemeinschaft im Jahresfahrplan an.
 *
 * Bewusst kein neues Datenmodell: `MaintenanceTask` trägt Titel, Fälligkeit und
 * Intervall — und `EINMALIG` gibt es dort bereits. Ein einmaliger Termin und
 * eine wiederkehrende Aufgabe sind damit derselbe Datensatz, und alles, was am
 * Fahrplan hängt (Fälligkeitslogik, Vorwarnfenster, Dashboard), rechnet
 * unverändert weiter.
 *
 * Der Unterschied zu den Prüfpflichten ist allein die Herkunft: Die stammen aus
 * dem Katalog und tragen einen `catalogKey`. Eigene Termine haben keinen.
 */
export async function addOwnTermin(formData: FormData) {
  const actor = await requireVerwalter();

  const propertyId = String(formData.get("propertyId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim().slice(0, 200);
  const dueRaw = String(formData.get("dueDate") ?? "").trim();
  const intervalRaw = String(formData.get("interval") ?? "EINMALIG");
  const interval = (INTERVALLE as readonly string[]).includes(intervalRaw)
    ? (intervalRaw as (typeof INTERVALLE)[number])
    : "EINMALIG";

  // Wächter melden keinen Erfolg – zurück ohne Flash. Alle drei Fälle kann das
  // Formular selbst nicht erzeugen (`required`, `minLength`, `type="date"`);
  // sie fangen nur ab, was an ihm vorbei geschickt wird.
  const dueDate = new Date(dueRaw);
  if (!propertyId || title.length < 2) redirect("/dashboard");
  if (!dueRaw || Number.isNaN(dueDate.getTime())) redirect("/dashboard");
  if (!(await canVerwalterAccessProperty(actor, propertyId))) redirect("/dashboard");

  await db.maintenanceTask.create({
    data: {
      organizationId: actor.organizationId,
      propertyId,
      title,
      dueDate,
      interval,
      // Kein `catalogKey`: Das unterscheidet den eigenen Termin von einer
      // übernommenen Prüfpflicht.
    },
  });

  revalidatePath("/dashboard");
  redirect("/dashboard?flash=erstellt");
}
