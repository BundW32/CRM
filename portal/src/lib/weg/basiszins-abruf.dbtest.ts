// Der Abruf schreibt in die Datenbank — also wird er gegen eine echte geprüft.
//
// Die Regel, an der alles hängt: **Ein von Hand eingetragener Satz wird nie
// überschrieben.** Ob das gilt, lässt sich nicht am Quelltext ablesen, sondern
// nur daran, was nach dem Lauf in der Tabelle steht. Genau dafür ist dieser
// Harnisch da.
//
// Das Netz wird ersetzt, die Datenbank nicht: Der Abruf bekommt eine feste
// Antwort, damit der Test nicht von der Bundesbank abhängt — geprüft wird, was
// daraus in der Tabelle wird.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { uebernehmeBasiszinssaetze } from "./basiszins-abruf-service";
import { db, resetDatabase, seedOrganization, type Fixture } from "@/test/harness";

let a: Fixture;
let b: Fixture;

const antwort = (csv: string): typeof fetch =>
  (async () => ({ ok: true, status: 200, text: async () => csv }) as Response) as typeof fetch;

const REIHE = "2023-01-01;1.62\n2023-07-01;3.12\n2024-01-01;3.62\n";

beforeEach(async () => {
  await resetDatabase();
  a = await seedOrganization("bza");
  b = await seedOrganization("bzb");
});

afterAll(async () => {
  await resetDatabase();
  await db.$disconnect();
});

const saetzeVon = async (orgId: string) =>
  (
    await db.baseInterestRate.findMany({
      where: { organizationId: orgId },
      orderBy: { validFrom: "asc" },
      select: { validFrom: true, basisPoints: true },
    })
  ).map((z) => [z.validFrom.toISOString().slice(0, 10), z.basisPoints] as const);

describe("Basiszinssatz-Abruf gegen echte Datenbank", () => {
  it("trägt fehlende Sätze für die gewählte Organisation nach", async () => {
    const r = await uebernehmeBasiszinssaetze({
      organizationId: a.org.id,
      fetchImpl: antwort(REIHE),
    });
    expect(r.fehler).toBeUndefined();
    expect(r.neu).toBe(3);
    expect(await saetzeVon(a.org.id)).toEqual([
      ["2023-01-01", 162],
      ["2023-07-01", 312],
      ["2024-01-01", 362],
    ]);
    // Und nur für sie: Der Aufruf mit `organizationId` darf nicht in die
    // Nachbarorganisation schreiben.
    expect(await saetzeVon(b.org.id)).toEqual([]);
  });

  it("überschreibt einen von Hand eingetragenen Satz NICHT", async () => {
    // Die entscheidende Prüfung. Jemand hat 2,00 % eingetragen; die Bundesbank
    // liefert für denselben Tag 3,62 %. Der Handeintrag ist die Entscheidung
    // eines Menschen, der die Bekanntmachung gelesen hat — sie stillschweigend
    // zu ersetzen hieße, eine andere Zahl in eine Mahnung zu schreiben, ohne
    // dass es jemand merkt.
    await db.baseInterestRate.create({
      data: {
        organizationId: a.org.id,
        validFrom: new Date(Date.UTC(2024, 0, 1)),
        basisPoints: 200,
      },
    });

    const r = await uebernehmeBasiszinssaetze({
      organizationId: a.org.id,
      fetchImpl: antwort(REIHE),
    });

    expect(r.neu).toBe(2); // die beiden anderen
    expect(r.uebersprungen).toBe(1);
    const nachher = await saetzeVon(a.org.id);
    // Der Handeintrag steht unverändert da.
    expect(nachher).toContainEqual(["2024-01-01", 200]);
    expect(nachher).not.toContainEqual(["2024-01-01", 362]);
  });

  it("ist idempotent — der zweite Lauf ändert nichts", async () => {
    await uebernehmeBasiszinssaetze({ organizationId: a.org.id, fetchImpl: antwort(REIHE) });
    const zweiter = await uebernehmeBasiszinssaetze({
      organizationId: a.org.id,
      fetchImpl: antwort(REIHE),
    });
    expect(zweiter.neu).toBe(0);
    expect(zweiter.uebersprungen).toBe(3);
    expect(await saetzeVon(a.org.id)).toHaveLength(3);
  });

  it("versorgt ohne Organisations-Angabe alle Organisationen (Cron-Lauf)", async () => {
    const r = await uebernehmeBasiszinssaetze({ fetchImpl: antwort(REIHE) });
    expect(r.organisationen).toBeGreaterThanOrEqual(2);
    expect(await saetzeVon(a.org.id)).toHaveLength(3);
    expect(await saetzeVon(b.org.id)).toHaveLength(3);
  });

  it("schreibt bei unlesbarer Antwort NICHTS", async () => {
    // Formatänderung bei der Bundesbank oder eine Wartungsseite: Der Lauf darf
    // dann nichts anlegen und muss den Grund nennen.
    const r = await uebernehmeBasiszinssaetze({
      organizationId: a.org.id,
      fetchImpl: antwort("<html>Wartungsarbeiten</html>"),
    });
    expect(r.fehler).toBeTruthy();
    expect(r.neu).toBe(0);
    expect(await saetzeVon(a.org.id)).toEqual([]);
  });

  it("schreibt auch bei einem Netzfehler nichts und wirft nicht", async () => {
    const kaputt = (async () => {
      throw new Error("ENOTFOUND");
    }) as unknown as typeof fetch;
    const r = await uebernehmeBasiszinssaetze({
      organizationId: a.org.id,
      fetchImpl: kaputt,
    });
    expect(r.fehler).toContain("nicht erreichbar");
    expect(await saetzeVon(a.org.id)).toEqual([]);
  });

  it("übernimmt einen unplausiblen Wert nicht, die übrigen schon", async () => {
    // Der verrutschte Faktor 100 als einzelne kaputte Zeile — sie fällt heraus,
    // ohne den ganzen Lauf zu verwerfen.
    const r = await uebernehmeBasiszinssaetze({
      organizationId: a.org.id,
      fetchImpl: antwort("2023-01-01;1.62\n2024-01-01;362\n"),
    });
    expect(r.neu).toBe(1);
    expect(await saetzeVon(a.org.id)).toEqual([["2023-01-01", 162]]);
  });
});
