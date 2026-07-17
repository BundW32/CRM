// Einzige MEA-Quelle: Miteigentumsanteile werden je Einheit gepflegt
// (Unit.mea). Das Stimmgewicht der Eigentümer (Ownership.mea = Wertprinzip,
// Ownership.voteUnits = Objektprinzip) wird daraus abgeleitet – NICHT mehr
// separat eingegeben. Diese Funktion synchronisiert die abgeleiteten Werte
// nach jeder Änderung an Unit.mea oder an der Einheiten-Eigentümerschaft.
import { db } from "@/lib/db";

// Setzt Ownership.mea / voteUnits für alle Eigentümer eines Objekts neu:
//   mea       = Σ (Unit.mea × Anteil%) der aktuell gehaltenen Einheiten
//               (null, wenn eine gehaltene Einheit noch keinen MEA hat →
//                weg-voting kann die Unvollständigkeit erkennen)
//   voteUnits = Anzahl aktuell gehaltener Einheiten (null, wenn keine)
export async function syncOwnerVotingWeights(propertyId: string): Promise<void> {
  const now = new Date();
  const [ownerships, holdings] = await Promise.all([
    db.ownership.findMany({ where: { propertyId }, select: { id: true, userId: true } }),
    db.unitOwnership.findMany({
      where: {
        unit: { propertyId },
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gt: now } }],
      },
      select: { userId: true, sharePercent: true, unit: { select: { mea: true } } },
    }),
  ]);

  // Je Eigentümer die gehaltenen Einheiten zusammenfassen.
  const byUser = new Map<string, { count: number; meaSum: number; incomplete: boolean }>();
  for (const h of holdings) {
    const entry = byUser.get(h.userId) ?? { count: 0, meaSum: 0, incomplete: false };
    entry.count += 1;
    if (h.unit.mea == null) entry.incomplete = true;
    else entry.meaSum += Math.round((h.unit.mea * h.sharePercent) / 100);
    byUser.set(h.userId, entry);
  }

  await db.$transaction(
    ownerships.map((o) => {
      const agg = byUser.get(o.userId);
      const voteUnits = agg && agg.count > 0 ? agg.count : null;
      const mea = agg && agg.count > 0 && !agg.incomplete ? agg.meaSum : null;
      return db.ownership.update({ where: { id: o.id }, data: { mea, voteUnits } });
    }),
  );
}
