import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db, resetDatabase, seedOrganization, type Fixture } from "@/test/harness";
import { loadSetupStatus, loadSetupStatusAlle } from "./setup-status";

// Der Befund, der in keinem der beiden Testberichte stand: Einrichtungsstand
// und Fahrplan hingen an `propIds[0]` — dem ersten Objekt in beliebiger
// Datenbankreihenfolge. War davon eines fertig, galt die Einrichtung als
// erledigt, und ein danach angelegtes zweites Objekt bekam nie eine Führung.
// Genau so blieb der Einrichtungs-Assistent beim Anlegen einer Muster-WEG
// unsichtbar, obwohl er existiert.
//
// Gegen eine echte Datenbank, weil der Stand vollständig aus den Daten
// abgeleitet wird (`setup-status.ts` speichert ihn bewusst nicht).

describe("Einrichtungsstand je Objekt", () => {
  let a: Fixture;

  beforeEach(async () => {
    await resetDatabase();
    a = await seedOrganization("setup");
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  /** Bringt ein Objekt so weit, dass alle ableitbaren Schritte stimmen. */
  async function richteEin(propertyId: string, unitId: string) {
    const organizationId = a.org.id;
    await db.property.update({ where: { id: propertyId }, data: { meaTotal: 1000 } });
    await db.unit.update({ where: { id: unitId }, data: { mea: 1000 } });
    await db.ledgerAccount.createMany({
      data: [
        { organizationId, propertyId, kind: "GIRO", name: "Girokonto", openingBalanceDate: new Date("2026-01-01") },
        { organizationId, propertyId, kind: "RUECKLAGE", name: "Rücklage", openingBalanceDate: new Date("2026-01-01") },
      ],
    });
    await db.costType.create({ data: { organizationId, propertyId, name: "Versicherung" } });
    for (const key of ["unterlagen", "konto", "bestellung"]) {
      await db.wegSetupStep.create({ data: { propertyId, key } });
    }
  }

  it("liefert je Objekt einen eigenen Stand", async () => {
    await richteEin(a.objekt.id, a.einheit.id);

    // Zweites Objekt, frisch angelegt — genau der Fall aus dem Test.
    const zweites = await db.property.create({
      data: {
        organizationId: a.org.id,
        name: "Tiefgarage",
        street: "Teststraße 1",
        zip: "12345",
        city: "Teststadt",
        managementType: "WEG",
      },
    });

    const staende = await loadSetupStatusAlle([a.objekt.id, zweites.id]);
    expect(staende).toHaveLength(2);
    expect(staende[0].fertig).toBe(true);
    // Vor der Korrektur entschied allein das erste Objekt — und damit galt die
    // Einrichtung des zweiten stillschweigend als erledigt.
    expect(staende[1].fertig).toBe(false);
    expect(staende[1].propertyId).toBe(zweites.id);
  });

  it("behält die übergebene Reihenfolge bei", async () => {
    const zweites = await db.property.create({
      data: {
        organizationId: a.org.id,
        name: "AAA zuerst im Alphabet",
        street: "Teststraße 1",
        zip: "12345",
        city: "Teststadt",
        managementType: "WEG",
      },
    });
    // Die Reihenfolge bestimmt der Aufrufer (dort nach Name sortiert) – diese
    // Funktion darf sie nicht umsortieren, sonst zeigt die Oberfläche den Stand
    // eines anderen Objekts als den Namen daneben.
    const staende = await loadSetupStatusAlle([zweites.id, a.objekt.id]);
    expect(staende.map((s) => s.propertyId)).toEqual([zweites.id, a.objekt.id]);
  });

  it("nennt den ersten offenen Schritt und zählt mit", async () => {
    const stand = await loadSetupStatus(a.objekt.id);
    expect(stand.fertig).toBe(false);
    expect(stand.naechster).not.toBeNull();
    expect(stand.erledigt).toBeLessThan(stand.gesamt);
  });

  it("kommt ohne Objekt zurecht", async () => {
    expect(await loadSetupStatusAlle([])).toEqual([]);
    const leer = await loadSetupStatus(null);
    expect(leer.propertyId).toBeNull();
    expect(leer.fertig).toBe(false);
  });
});
