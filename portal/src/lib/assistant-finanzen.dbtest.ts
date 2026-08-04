// Was der Assistent über Geld verrät — gegen eine echte Datenbank.
//
// Diese Prüfung ersetzt eine frühere mit Attrappen. Der Grund steht in
// `portal/AGENTS.md`: Die Zugriffskontrolle dieses Portals *besteht* aus
// Datenbankabfragen mit Organisations- und Objektfiltern. Ersetzt man die
// Zugriffsschicht durch Attrappen, prüft man die Verzweigungen im eigenen Code
// — nicht, ob die Filter halten. Genau letzteres ist hier die Frage.
//
// Zwei Grenzen werden geprüft, und sie sind verschieden:
//
// 1. **Innerhalb einer Gemeinschaft**: Ein Eigentümer erfährt die *Summe* der
//    Rückstände (sie steht im Vermögensbericht, den alle bekommen), aber nicht,
//    *wer* sie schuldet. Den eigenen Stand sieht er.
// 2. **Zwischen zwei Kunden**: Kein Wert, kein Objektname, keine Einheit der
//    anderen Organisation darf auftauchen — die Wand, an der das Produkt hängt.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { finanzQuellen } from "./assistant-finanzen";
import { db, resetDatabase, seedOrganization, type Fixture } from "@/test/harness";

let a: Fixture;
let b: Fixture;
/** Zweiter Eigentümer in A's Objekt — der Nachbar, um dessen Daten es geht. */
let nachbarEinheit: { id: string; label: string };

beforeAll(async () => {
  await resetDatabase();
  a = await seedOrganization("fa");
  b = await seedOrganization("fb");

  // A's Objekt bekommt eine zweite Einheit mit eigenem Eigentümer. Der Harnisch
  // liefert nur eine — und mit einer einzigen Einheit ist die Frage „sieht er
  // die fremde?" nicht stellbar. Genau daran war die frühere Prüfung an echten
  // Daten gescheitert: Der Demo-Eigentümer besaß alle Einheiten, es gab nichts
  // zu verraten, und der Test ging aus dem falschen Grund durch.
  const nachbar = await db.user.create({
    data: {
      organizationId: a.org.id,
      email: `nachbar.${Date.now()}@test.invalid`,
      name: "Nachbar",
      passwordHash: a.eigentuemer.passwordHash,
      role: "EIGENTUEMER",
    },
  });
  nachbarEinheit = await db.unit.create({
    data: { propertyId: a.objekt.id, label: "WE 2 Nachbar" },
  });
  await db.unitOwnership.create({
    data: {
      userId: nachbar.id,
      unitId: nachbarEinheit.id,
      organizationId: a.org.id,
      validFrom: new Date("2020-01-01"),
    },
  });

  // Konten mit Beständen, damit es überhaupt Zahlen zu verraten gibt.
  const anlegen = (fx: Fixture, name: string, kind: "GIRO" | "RUECKLAGE", cents: number) =>
    db.ledgerAccount.create({
      data: {
        organizationId: fx.org.id,
        propertyId: fx.objekt.id,
        name,
        kind,
        openingBalanceCents: cents,
      },
    });
  await anlegen(a, "Girokonto A", "GIRO", 111_11);
  await anlegen(a, "Rücklage A", "RUECKLAGE", 222_22);
  await anlegen(b, "Girokonto B", "GIRO", 999_99);
  await anlegen(b, "Rücklage B", "RUECKLAGE", 888_88);

  // Rückstände: die eigene Einheit 100,00 €, die des Nachbarn 500,00 €.
  const soll = (unitId: string, propertyId: string, orgId: string, cents: number) =>
    db.duePosting.create({
      data: {
        organizationId: orgId,
        propertyId,
        unitId,
        dueDate: new Date("2025-01-01"),
        periodYear: 2025,
        periodMonth: 1,
        amountCents: cents,
      },
    });
  await soll(a.einheit.id, a.objekt.id, a.org.id, 100_00);
  await soll(nachbarEinheit.id, a.objekt.id, a.org.id, 500_00);
  await soll(b.einheit.id, b.objekt.id, b.org.id, 777_00);
});

afterAll(async () => {
  await resetDatabase();
  await db.$disconnect();
});

const text = async (nutzer: Fixture["verwalter"]) =>
  (await finanzQuellen(nutzer)).map((q) => `${q.title} ${q.snippet}`).join(" ");

describe("Assistent: die Grenze innerhalb der Gemeinschaft", () => {
  it("nennt dem Verwalter, wer im Rückstand ist", async () => {
    const t = await text(a.verwalter);
    expect(t).toContain(nachbarEinheit.label);
    expect(t).toContain("500,00");
  });

  it("nennt dem Eigentümer die Summe, aber nicht den Nachbarn", async () => {
    const t = await text(a.eigentuemer);
    // 100,00 + 500,00 — die Summe steht im Vermögensbericht und darf genannt werden.
    expect(t).toContain("600,00");
    // Aber nicht, wessen Rückstand das ist.
    expect(t).not.toContain(nachbarEinheit.label);
    expect(t).not.toContain("Betroffen");
  });

  it("nennt dem Eigentümer seinen eigenen Stand", async () => {
    const t = await text(a.eigentuemer);
    expect(t).toContain(a.einheit.label);
    expect(t).toContain("100,00");
  });

  it("gibt dem Mieter nichts", async () => {
    expect(await finanzQuellen(a.mieter)).toEqual([]);
  });
});

describe("Assistent: die Wand zwischen zwei Kunden", () => {
  it("zeigt dem Verwalter von A nichts aus B", async () => {
    const t = await text(a.verwalter);
    expect(t).toContain(a.objekt.name);
    expect(t).not.toContain(b.objekt.name);
    expect(t).not.toContain("999,99"); // B's Girokonto
    expect(t).not.toContain("777,00"); // B's Rückstand
  });

  it("zeigt dem Eigentümer von A nichts aus B", async () => {
    const t = await text(a.eigentuemer);
    expect(t).not.toContain(b.objekt.name);
    expect(t).not.toContain("999,99");
    expect(t).not.toContain("777,00");
  });

  it("gilt in beide Richtungen", async () => {
    // Nicht nur A→B: Eine Prüfung in einer Richtung übersieht einen Filter, der
    // versehentlich auf eine feste Organisation zeigt.
    const t = await text(b.verwalter);
    expect(t).toContain(b.objekt.name);
    expect(t).not.toContain(a.objekt.name);
    expect(t).not.toContain("111,11");
    expect(t).not.toContain(nachbarEinheit.label);
  });
});

describe("Assistent: Kontostände", () => {
  it("rechnet Giro und Rücklage getrennt und nur des eigenen Objekts", async () => {
    const t = await text(a.eigentuemer);
    expect(t).toContain("111,11");
    expect(t).toContain("222,22");
  });
});
