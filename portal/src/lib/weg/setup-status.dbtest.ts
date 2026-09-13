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

  // ── Verwalterbestellung: der Beschluss hakt den Schritt ab ────────────────
  //
  // Der Schritt galt nur über den Vermerk von Hand als erledigt. Eine
  // Gemeinschaft, die im Portal ordnungsgemäß über die Bestellung abgestimmt
  // hatte, blieb deshalb bei „7 von 8" stehen — und schlimmer: Der Hinweis
  // „Abstimmung läuft" verschwand mit der Annahme des Beschlusses wieder, der
  // Punkt sah danach aus wie nie angefasst. Genau so ist es in einem Prüflauf
  // gemeldet worden.
  describe("Schritt „Verwaltung bestellen“", () => {
    /** Legt einen Bestellungsbeschluss im gewünschten Stand an. */
    const beschluss = (status: "OFFEN" | "ANGENOMMEN" | "ABGELEHNT") =>
      db.resolution.create({
        data: {
          organizationId: a.org.id,
          propertyId: a.objekt.id,
          title: "Bestellung der Verwaltung",
          description: "Die Eigentümer bestellen … zur Verwaltung.",
          status,
          createdById: a.verwalter.id,
          ...(status === "OFFEN" ? {} : { decidedAt: new Date() }),
        },
      });

    const schritt = async () =>
      (await loadSetupStatus(a.objekt.id)).steps.find((s) => s.key === "bestellung")!;

    it("ist offen, solange es keinen Beschluss gibt", async () => {
      const s = await schritt();
      expect(s.done).toBe(false);
      expect(s.zwischenstand).toBeUndefined();
    });

    it("zeigt bei laufender Abstimmung einen Zwischenstand, hakt aber nicht ab", async () => {
      await beschluss("OFFEN");
      const s = await schritt();
      expect(s.done).toBe(false);
      expect(s.zwischenstand?.text).toContain("Abstimmung läuft");
    });

    it("ist mit einem ANGENOMMENEN Beschluss erledigt — ohne Häkchen von Hand", async () => {
      const r = await beschluss("ANGENOMMEN");
      const s = await schritt();
      expect(s.done).toBe(true);
      // Und der Zwischenstand ist weg: Er widerspräche dem gesetzten Häkchen.
      expect(s.zwischenstand).toBeUndefined();
      // Der Weg führt zum Beschluss, nicht in die Liste — er ist der Nachweis.
      expect(s.href).toBe(`/beschluesse/${r.id}`);
    });

    it("bleibt bei einem ABGELEHNTEN Beschluss offen", async () => {
      await beschluss("ABGELEHNT");
      const s = await schritt();
      expect(s.done).toBe(false);
    });

    it("bleibt über den Vermerk von Hand abhakbar (Bestellung vor dem Portal)", async () => {
      await db.wegSetupStep.create({ data: { propertyId: a.objekt.id, key: "bestellung" } });
      expect((await schritt()).done).toBe(true);
    });
  });
});
