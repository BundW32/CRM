"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AUDIT, logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";
import { anmeldemonat } from "@/lib/weg/anmeldefrist";

function backTo(suffix = ""): string {
  return `/verwaltung/bauabzugsteuer${suffix}`;
}

/**
 * Einen Monat als beim Finanzamt angemeldet markieren.
 *
 * Bewusst je **Monat** und nicht je Buchung: Abgegeben wird eine Anmeldung für
 * den Monat. Wer einzelne Buchungen abhaken könnte, hätte irgendwann einen halb
 * angemeldeten Monat — und keine Möglichkeit zu sagen, welche Hälfte.
 */
export async function monatAngemeldet(formData: FormData) {
  const verwalter = await requireVerwalter();
  const monat = String(formData.get("monat") ?? "");
  if (!/^\d{4}-\d{2}$/.test(monat)) redirect(backTo("?fehler=monat"));

  // Nicht über einen Datumsbereich in der Abfrage, sondern über dieselbe
  // Funktion, die die Liste gruppiert. Zwei Wege, denselben Monat zu bestimmen,
  // laufen früher oder später auseinander — und dann bliebe eine Buchung stehen,
  // die in der Liste längst abgehakt aussieht.
  const offen = await db.booking.findMany({
    where: {
      organizationId: verwalter.organizationId,
      bauabzugCents: { not: null },
      bauabzugAngemeldetAt: null,
    },
    select: { id: true, bookingDate: true },
  });
  const ids = offen.filter((b) => anmeldemonat(b.bookingDate) === monat).map((b) => b.id);
  if (ids.length === 0) redirect(backTo("?fehler=leer"));

  await db.booking.updateMany({
    where: { id: { in: ids }, organizationId: verwalter.organizationId },
    data: { bauabzugAngemeldetAt: new Date() },
  });
  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_BAUABZUG_ANGEMELDET,
    targetType: "Booking",
    targetId: monat,
    meta: { monat, buchungen: ids.length },
  });
  revalidatePath(backTo());
  redirect(backTo("?flash=bauabzug-angemeldet"));
}
