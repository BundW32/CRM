// Übernahme der abgerufenen Basiszinssätze in die Datenbank.
//
// Die Regeln des Abrufs stehen ohne Datenbank in `basiszins-abruf.ts`.

import { db } from "@/lib/db";
import { holeZinssaetze, type Zinssatz } from "./basiszins-abruf";

export type UebernahmeErgebnis = {
  /** Zahl der Organisationen, für die etwas geschrieben wurde. */
  organisationen: number;
  /** Zahl der insgesamt neu angelegten Sätze. */
  neu: number;
  /** Bereits vorhandene Sätze, die unangetastet blieben. */
  uebersprungen: number;
  /** Gesetzt, wenn der Abruf selbst nicht geklappt hat — dann wurde nichts geschrieben. */
  fehler?: string;
  /** Die gefundenen Sätze, für die Rückmeldung in der Oberfläche. */
  gefunden: Zinssatz[];
};

/**
 * Trägt die abgerufenen Sätze für eine oder alle Organisationen nach.
 *
 * **Vorhandene Sätze werden nie überschrieben.** Das ist die zentrale Regel:
 * Ein von Hand eingetragener Wert ist eine Entscheidung eines Menschen, der die
 * Bekanntmachung gelesen hat. Ihn durch einen Abruf zu ersetzen hieße, diese
 * Entscheidung stillschweigend zu verwerfen — und im Zweifel steht danach die
 * andere Zahl in einer Mahnung, ohne dass jemand es merkt. Der Abruf **ergänzt**
 * also nur, was fehlt.
 *
 * @param organizationId  Nur diese Organisation; ohne Angabe alle (Cron-Lauf).
 */
export async function uebernehmeBasiszinssaetze(opt?: {
  organizationId?: string;
  fetchImpl?: typeof fetch;
}): Promise<UebernahmeErgebnis> {
  const abruf = await holeZinssaetze(opt?.fetchImpl ?? fetch);
  if (!abruf.ok) {
    return { organisationen: 0, neu: 0, uebersprungen: 0, fehler: abruf.grund, gefunden: [] };
  }

  const organisationen = opt?.organizationId
    ? [{ id: opt.organizationId }]
    : await db.organization.findMany({ select: { id: true } });

  let neu = 0;
  let uebersprungen = 0;
  let beruehrt = 0;

  for (const org of organisationen) {
    const vorhanden = await db.baseInterestRate.findMany({
      where: { organizationId: org.id },
      select: { validFrom: true },
    });
    const bekannt = new Set(vorhanden.map((v) => v.validFrom.getTime()));

    const fehlende = abruf.saetze.filter((s) => !bekannt.has(s.validFrom.getTime()));
    uebersprungen += abruf.saetze.length - fehlende.length;
    if (fehlende.length === 0) continue;

    // `createMany` mit `skipDuplicates`: Läuft der Cron zweimal gleichzeitig,
    // gewinnt der erste, und der zweite scheitert nicht mit einem
    // Unique-Verstoß. Ein Abruf darf nie eine Fehlerseite erzeugen.
    const geschrieben = await db.baseInterestRate.createMany({
      data: fehlende.map((s) => ({
        organizationId: org.id,
        validFrom: s.validFrom,
        basisPoints: s.basisPoints,
      })),
      skipDuplicates: true,
    });
    neu += geschrieben.count;
    if (geschrieben.count > 0) beruehrt += 1;
  }

  return { organisationen: beruehrt, neu, uebersprungen, gefunden: abruf.saetze };
}
