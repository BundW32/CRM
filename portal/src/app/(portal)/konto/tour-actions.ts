"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

// Die geführte Einrichtung merkt sich, dass sie gelaufen ist — auch beim
// Überspringen. Wer sie wegklickt, hat sie gesehen und will sie nicht beim
// nächsten Seitenwechsel wieder.
//
// Kein Audit-Eintrag: Ob jemand eine Einführung angesehen hat, ist keine
// nachweispflichtige Handlung.
export async function tourBeenden(_abgeschlossen: boolean) {
  const user = await requireUser();
  await db.user.update({ where: { id: user.id }, data: { tourDoneAt: new Date() } });
  revalidatePath("/", "layout");
}

/** Führung erneut starten (Knopf unter „Konto"). */
export async function tourNeuStarten() {
  const user = await requireUser();
  await db.user.update({ where: { id: user.id }, data: { tourDoneAt: null } });
  revalidatePath("/", "layout");
}
