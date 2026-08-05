// Einzige MEA-Quelle: Miteigentumsanteile werden je Einheit gepflegt
// (Unit.mea). Das Stimmgewicht der Eigentümer (Ownership.mea = Wertprinzip,
// Ownership.voteUnits = Objektprinzip) wird daraus abgeleitet – NICHT mehr
// separat eingegeben. Diese Funktion synchronisiert die abgeleiteten Werte
// nach jeder Änderung an Unit.mea oder an der Einheiten-Eigentümerschaft.
import { db } from "@/lib/db";
import { distributeByWeight } from "@/lib/weg/distribution";

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
      select: { userId: true, unitId: true, sharePercent: true, unit: { select: { mea: true } } },
    }),
  ]);

  // Zuerst je EINHEIT verteilen, dann je Eigentümer aufsummieren.
  //
  // Vorher wurde jeder Anteil einzeln gerundet: `Math.round(mea * anteil/100)`.
  // Bei einer Einheit mit 247 Anteilen und zwei Miteigentümern zu je 50 % ergab
  // das 123,5 → zweimal 124, und die Summe der Gemeinschaft stand auf 1.001
  // statt 1.000. Ein Anteil, den es nicht gibt, verschiebt jede Mehrheit nach
  // § 25 WEG — und die Summenkontrolle hätte bei einer korrekt erfassten WEG
  // Alarm geschlagen.
  //
  // Largest-Remainder je Einheit garantiert: Σ Miteigentümer == Unit.mea.
  const byUnit = new Map<string, typeof holdings>();
  for (const h of holdings) {
    const list = byUnit.get(h.unitId) ?? [];
    list.push(h);
    byUnit.set(h.unitId, list);
  }

  const byUser = new Map<string, { count: number; meaSum: number; incomplete: boolean }>();
  const zaehle = (userId: string, mea: number | null) => {
    const entry = byUser.get(userId) ?? { count: 0, meaSum: 0, incomplete: false };
    entry.count += 1;
    if (mea == null) entry.incomplete = true;
    else entry.meaSum += mea;
    byUser.set(userId, entry);
  };

  for (const list of byUnit.values()) {
    const mea = list[0].unit.mea;
    if (mea == null) {
      for (const h of list) zaehle(h.userId, null);
      continue;
    }
    // Ein einzelner Eigentümer bekommt den vollen Anteil der Einheit, auch
    // wenn sein Prozentsatz (noch) unter 100 steht: Sonst verschwänden
    // Anteile still, statt dass die Lücke auffällt.
    if (list.length === 1) {
      zaehle(list[0].userId, mea);
      continue;
    }
    const verteilt = distributeByWeight(
      mea,
      list.map((h, i) => ({ unitId: `${i}`, weight: h.sharePercent })),
    );
    list.forEach((h, i) => zaehle(h.userId, verteilt.get(`${i}`) ?? 0));
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
