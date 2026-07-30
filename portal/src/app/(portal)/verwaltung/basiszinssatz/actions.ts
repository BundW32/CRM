"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";
import { uebernehmeBasiszinssaetze } from "@/lib/weg/basiszins-abruf-service";

function backTo(suffix = ""): string {
  return `/verwaltung/basiszinssatz${suffix}`;
}

const schema = z.object({
  validFrom: z.string().min(1),
  /** Als Prozentzeichenkette, z. B. „3,62" oder „-0,88". */
  prozent: z.string().min(1),
});

/**
 * Prozentangabe in Basispunkte.
 *
 * Ganzzahlig gespeichert, damit nichts gerundet wird — 3,62 % sind 362 Punkte.
 * Ein Gleitkommawert würde bei jeder Zinsrechnung erneut gerundet, und die
 * Abweichung stünde am Ende in einem Schreiben, das jemand nachrechnet.
 */
function zuBasispunkten(eingabe: string): number | null {
  const bereinigt = eingabe.trim().replace("%", "").replace(",", ".");
  const zahl = Number(bereinigt);
  if (!Number.isFinite(zahl)) return null;
  // Der Basiszinssatz lag historisch zwischen −0,88 % und knapp 4 %. Eine
  // Grenze bei ±25 % fängt den vertippten Faktor 100 ab, ohne einen künftigen
  // Zinsanstieg auszuschließen.
  if (zahl < -25 || zahl > 25) return null;
  return Math.round(zahl * 100);
}

export async function addBaseRate(formData: FormData) {
  const verwalter = await requireVerwalter();
  const parsed = schema.safeParse({
    validFrom: formData.get("validFrom"),
    prozent: formData.get("prozent"),
  });
  if (!parsed.success) redirect(backTo("?fehler=eingabe"));

  const validFrom = new Date(parsed.data.validFrom);
  if (isNaN(validFrom.getTime())) redirect(backTo("?fehler=datum"));

  const basisPoints = zuBasispunkten(parsed.data.prozent);
  if (basisPoints === null) redirect(backTo("?fehler=satz"));

  // Derselbe Geltungsbeginn zweimal wäre mehrdeutig — welcher gilt dann?
  // Statt eines Datenbankfehlers eine Meldung, die sagt, was zu tun ist.
  const vorhanden = await db.baseInterestRate.findFirst({
    where: { organizationId: verwalter.organizationId, validFrom },
    select: { id: true },
  });
  if (vorhanden) redirect(backTo("?fehler=doppelt"));

  await db.baseInterestRate.create({
    data: { organizationId: verwalter.organizationId, validFrom, basisPoints },
  });
  revalidatePath("/verwaltung/basiszinssatz");
  redirect(backTo("?flash=erstellt"));
}

export async function deleteBaseRate(formData: FormData) {
  const verwalter = await requireVerwalter();
  const id = String(formData.get("id") ?? "");
  // Scope: nur Sätze der eigenen Organisation (IDOR-Schutz).
  const satz = await db.baseInterestRate.findFirst({
    where: { id, organizationId: verwalter.organizationId },
    select: { id: true },
  });
  if (!satz) redirect(backTo("?fehler=nichtgefunden"));

  await db.baseInterestRate.delete({ where: { id: satz.id } });
  revalidatePath("/verwaltung/basiszinssatz");
  redirect(backTo("?flash=geloescht"));
}

/**
 * Sätze bei der Bundesbank abrufen und fehlende Halbjahre nachtragen.
 *
 * Denselben Weg geht der monatliche Cron-Lauf; dieser Knopf ist der Auslöser
 * von Hand — damit sich der Abruf sofort prüfen lässt, statt bis zum Zweiten
 * des nächsten Monats zu warten.
 *
 * **Vorhandene Sätze bleiben unangetastet.** Der Abruf ergänzt nur, was fehlt.
 *
 * Die Rückmeldung nennt Zahlen statt „hat geklappt": Wie viele Sätze
 * dazugekommen sind, ist die eigentliche Auskunft — und „0 neu" heißt, dass
 * alles schon da war, nicht dass etwas schiefging.
 */
export async function abrufBaseRates() {
  const verwalter = await requireVerwalter();
  const ergebnis = await uebernehmeBasiszinssaetze({
    organizationId: verwalter.organizationId,
  });
  revalidatePath("/verwaltung/basiszinssatz");

  if (ergebnis.fehler) {
    // Der Grund wandert in die URL, weil die Ursache außerhalb liegt und der
    // Nutzer sie kennen muss, um zu entscheiden: warten oder von Hand eintragen.
    redirect(backTo(`?abrufFehler=${encodeURIComponent(ergebnis.fehler)}`));
  }
  redirect(
    backTo(
      `?abrufOk=${ergebnis.neu}&abrufGeprueft=${ergebnis.gefunden.length}`,
    ),
  );
}
