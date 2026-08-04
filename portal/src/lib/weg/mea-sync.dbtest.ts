import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db, resetDatabase, seedOrganization, type Fixture } from "@/test/harness";
import { syncOwnerVotingWeights } from "./mea-sync";

// Der teuerste Befund aus dem Selbstverwalter-Test: Bei einem Ehepaar, das eine
// Einheit je zur Hälfte hält, zählte der Miteigentumsanteil der Einheit doppelt.
// Die Berechnung stimmte — das Objektformular konnte den Anteil nur nicht
// erfassen und legte beide Eigentümer mit den vorgegebenen 100 % an.
//
// Gegen eine echte Datenbank geprüft, nicht gegen Attrappen: Was hier zählt,
// ist das Zusammenspiel von Anteil, Stichtag und Aggregation in der Abfrage.
// Eine nachgebaute Abfrage prüfte die eigene Erwartung, nicht die Ableitung.

describe("Stimmgewicht aus Anteilen ableiten", () => {
  let a: Fixture;

  beforeEach(async () => {
    await resetDatabase();
    a = await seedOrganization("mea");
    // Runder MEA, damit die Restcent-Rundung die Aussage nicht verwischt.
    await db.unit.update({ where: { id: a.einheit.id }, data: { mea: 200 } });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  /** Legt einen zweiten Eigentümer derselben Einheit an. */
  async function zweiterEigentuemer(sharePercent: number) {
    const user = await db.user.create({
      data: {
        organizationId: a.org.id,
        email: `zweiter.${Date.now()}@test.invalid`,
        name: "Zweiter Eigentümer",
        passwordHash: a.eigentuemer.passwordHash,
        role: "EIGENTUEMER",
      },
    });
    await db.ownership.create({ data: { userId: user.id, propertyId: a.objekt.id } });
    await db.unitOwnership.create({
      data: {
        userId: user.id,
        unitId: a.einheit.id,
        organizationId: a.org.id,
        validFrom: new Date("2020-01-01"),
        sharePercent,
      },
    });
    return user;
  }

  async function stimmgewichte() {
    const rows = await db.ownership.findMany({
      where: { propertyId: a.objekt.id },
      select: { mea: true, voteUnits: true },
    });
    return {
      summe: rows.reduce((s, r) => s + (r.mea ?? 0), 0),
      // Eigener Vergleicher: Das voreingestellte `sort()` vergleicht als Text
      // und stellte damit `200` vor `null`.
      einzeln: rows.map((r) => r.mea).sort((x, y) => (x ?? -1) - (y ?? -1)),
    };
  }

  it("hält den Anteil der Einheit ein, wenn beide je die Hälfte halten", async () => {
    await db.unitOwnership.updateMany({
      where: { unitId: a.einheit.id },
      data: { sharePercent: 50 },
    });
    await zweiterEigentuemer(50);
    await syncOwnerVotingWeights(a.objekt.id);

    const { summe, einzeln } = await stimmgewichte();
    expect(einzeln).toEqual([100, 100]);
    // Der Kern: Die Summe über die Eigentümer bleibt der MEA der Einheit.
    expect(summe).toBe(200);
  });

  it("verdoppelt ihn, wenn beide auf 100 % stehen", async () => {
    // Genau der Zustand, den das Objektformular vor dem 03.08.2026 erzeugte.
    // Festgehalten, damit klar bleibt, woran die Verdopplung hing: nicht an der
    // Rechnung, sondern an einem Anteil, den niemand eingeben konnte.
    await zweiterEigentuemer(100);
    await syncOwnerVotingWeights(a.objekt.id);

    const { summe } = await stimmgewichte();
    expect(summe).toBe(400);
  });

  it("zählt einen beendeten Voreigentümer nicht mehr mit", async () => {
    // Eigentümerwechsel: Der Vorbesitzer ist zum Stichtag beendet.
    await db.unitOwnership.updateMany({
      where: { unitId: a.einheit.id },
      data: { validTo: new Date("2024-12-31") },
    });
    await zweiterEigentuemer(100);
    await syncOwnerVotingWeights(a.objekt.id);

    const { summe, einzeln } = await stimmgewichte();
    expect(einzeln).toEqual([null, 200]);
    expect(summe).toBe(200);
  });

  it("meldet Unvollständigkeit statt einer zu kleinen Zahl", async () => {
    // Ohne MEA an der Einheit ist das Stimmgewicht unbekannt — nicht null.
    // Eine 0 sähe aus wie „kein Stimmrecht" und wäre fachlich falsch.
    await db.unit.update({ where: { id: a.einheit.id }, data: { mea: null } });
    await syncOwnerVotingWeights(a.objekt.id);

    const rows = await db.ownership.findMany({
      where: { propertyId: a.objekt.id },
      select: { mea: true, voteUnits: true },
    });
    expect(rows[0].mea).toBeNull();
    // Die Zahl der gehaltenen Einheiten steht trotzdem – sie hängt nicht am MEA.
    expect(rows[0].voteUnits).toBe(1);
  });
});
