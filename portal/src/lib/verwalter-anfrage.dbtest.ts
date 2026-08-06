// Mandantentrennung der Verwalter-Plus-Anfragen (Ticket-System zum
// zertifizierten Verwalter, § 26a WEG).
//
// Die Anfrage geht ÜBER die Mandantengrenze an den Betreiber — gerade deshalb
// muss die Wand zwischen den Gemeinschaften halten: Was WEG A den Verwalter
// fragt (Zahlungsrückstände, Streit im Haus), geht WEG B nichts an. Beide
// Richtungen, wie immer.
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type { VerwalterAnfrage } from "@/generated/prisma/client";
import { canVerwalterAccessAnfrage, verwalterAnfrageWhereForVerwalter } from "./access";
import { db, resetDatabase, seedOrganization, type Fixture } from "@/test/harness";

let a: Fixture;
let b: Fixture;
let anfrageA: VerwalterAnfrage;
let anfrageB: VerwalterAnfrage;

beforeAll(async () => {
  await resetDatabase();
  a = await seedOrganization("a");
  b = await seedOrganization("b");

  const anlegen = (fixture: Fixture, title: string) =>
    db.verwalterAnfrage.create({
      data: {
        organizationId: fixture.org.id,
        title,
        createdById: fixture.verwalter.id,
        nachrichten: {
          create: { body: `Frage von ${title}`, authorId: fixture.verwalter.id },
        },
      },
    });
  anfrageA = await anlegen(a, "Anfrage A");
  anfrageB = await anlegen(b, "Anfrage B");
});

afterAll(async () => {
  await resetDatabase();
  await db.$disconnect();
});

describe("Mandantentrennung: Verwalter-Anfragen", () => {
  it("liefert dem Verwalter nur die Anfragen der eigenen Gemeinschaft", async () => {
    const fuerA = await db.verwalterAnfrage.findMany({
      where: verwalterAnfrageWhereForVerwalter(a.verwalter),
    });
    const fuerB = await db.verwalterAnfrage.findMany({
      where: verwalterAnfrageWhereForVerwalter(b.verwalter),
    });
    expect(fuerA.map((x) => x.id)).toEqual([anfrageA.id]);
    expect(fuerB.map((x) => x.id)).toEqual([anfrageB.id]);
  });

  it("hält den Verwalter aus der Anfrage der anderen Gemeinschaft heraus", async () => {
    expect(await canVerwalterAccessAnfrage(a.verwalter, anfrageA.id)).toBe(true);
    expect(await canVerwalterAccessAnfrage(b.verwalter, anfrageB.id)).toBe(true);
    // Beide Richtungen — ein Filter, der auf eine feste Organisation zeigte,
    // hielte nur in einer.
    expect(await canVerwalterAccessAnfrage(a.verwalter, anfrageB.id)).toBe(false);
    expect(await canVerwalterAccessAnfrage(b.verwalter, anfrageA.id)).toBe(false);
  });

  it("gibt Eigentümern und Mietern gar keinen Anfrage-Zugriff", async () => {
    // Die Anfrage stellt die verwaltende Person, nicht die einzelne
    // Eigentümerin — auch nicht in der eigenen Gemeinschaft.
    expect(await canVerwalterAccessAnfrage(a.eigentuemer, anfrageA.id)).toBe(false);
    expect(await canVerwalterAccessAnfrage(a.mieter, anfrageA.id)).toBe(false);
  });
});
