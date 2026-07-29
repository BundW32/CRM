// Datenzugriff für Verzugszinsen und Mahnkosten. Die Rechnung selbst steht
// ohne Datenbank in `verzug.ts` und ist dort geprüft.

import { db } from "@/lib/db";
import { verzugszinsen, type Basiszinssatz } from "./verzug";

/** Die hinterlegten Basiszinssätze der Organisation, aufsteigend. */
export async function basiszinssaetze(organizationId: string): Promise<Basiszinssatz[]> {
  const zeilen = await db.baseInterestRate.findMany({
    where: { organizationId },
    orderBy: { validFrom: "asc" },
    select: { validFrom: true, basisPoints: true },
  });
  return zeilen.map((z) => ({ gueltigAb: z.validFrom, basispunkte: z.basisPoints }));
}

export type VerzugJeForderung = {
  /** `null`, wenn für den Zeitraum kein Basiszinssatz hinterlegt ist. */
  zinsenCents: number | null;
  tage: number;
};

/**
 * Verzugszinsen je offener Forderung.
 *
 * **Zinsen laufen auf den jeweils offenen Rest**, nicht auf den ursprünglichen
 * Betrag: Wer die Hälfte gezahlt hat, schuldet auch nur noch die Hälfte
 * verzinst. Das ist eine Vereinfachung — genau genommen müsste jede Teilzahlung
 * den Zinslauf ab ihrem Eingang mindern. Für die Anzeige eines Rückstands ist
 * die vorsichtigere Näherung die richtige: Sie rechnet nie zu viel, weil der
 * offene Rest höchstens so groß ist wie der ursprüngliche Betrag.
 */
export function verzugJeForderung(
  forderungen: { id: string; dueDate: Date; offenCents: number }[],
  saetze: Basiszinssatz[],
  stichtag: Date,
): Map<string, VerzugJeForderung> {
  const ergebnis = new Map<string, VerzugJeForderung>();
  for (const f of forderungen) {
    const r = verzugszinsen({
      hauptCents: f.offenCents,
      faellig: f.dueDate,
      bis: stichtag,
      saetze,
    });
    ergebnis.set(
      f.id,
      r.berechenbar ? { zinsenCents: r.zinsenCents, tage: r.tage } : { zinsenCents: null, tage: 0 },
    );
  }
  return ergebnis;
}

/**
 * Offene Mahnkosten einer Einheit.
 *
 * Erhoben werden sie **je versendeter Mahnung** — ein Entwurf kostet nichts.
 * Die Kosten sind eine Forderung der Gemeinschaft neben der Hauptforderung;
 * nach § 367 Abs. 1 BGB werden sie von einer Zahlung zuerst getilgt.
 */
export async function offeneMahnkosten(unitId: string): Promise<number> {
  const mahnungen = await db.hausgeldMahnung.findMany({
    where: { unitId, sentAt: { not: null } },
    select: { feeCents: true },
  });
  return mahnungen.reduce((s, m) => s + m.feeCents, 0);
}

/**
 * Fehlt für den Rückstand einer Einheit ein Basiszinssatz?
 *
 * Für die Anzeige: Statt stillschweigend „0,00 €" auszuweisen, sagt das
 * Programm, dass es nicht rechnen kann und was zu tun ist. Eine Null, die
 * „nicht berechenbar" bedeutet, ist die gefährlichste Zahl von allen.
 */
export function fehlenderZinssatz(werte: Map<string, VerzugJeForderung>): boolean {
  for (const v of werte.values()) if (v.zinsenCents === null) return true;
  return false;
}
