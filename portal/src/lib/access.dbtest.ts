// Mandantentrennung: die Wand zwischen zwei Kunden.
//
// Diese Prüfungen führen die echten Zugriffsfunktionen gegen eine echte
// Datenbank aus. Sie beantworten die eine Frage, an der dieses Produkt hängt:
// Kann ein Nutzer der Organisation A etwas aus Organisation B sehen?
//
// Der Aufbau ist immer derselbe — zwei vollständige Organisationen, und jede
// Funktion wird über Kreuz befragt. Neue Zugriffsfunktionen gehören hier
// hinein, nicht in eine Textprüfung der aufrufenden Seite.
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import {
  canAdministerProperty,
  canViewProperty,
  canVerwalterAccessProperty,
  canVerwalterManageUser,
  ownedUnitIdsInProperty,
  ownsProperty,
  propertyWhereForVerwalter,
  userWhereForVerwalter,
} from "./access";
import { db, resetDatabase, seedOrganization, type Fixture } from "@/test/harness";

let a: Fixture;
let b: Fixture;

beforeAll(async () => {
  await resetDatabase();
  a = await seedOrganization("a");
  b = await seedOrganization("b");
});

afterAll(async () => {
  await resetDatabase();
  await db.$disconnect();
});

describe("Mandantentrennung: Objektzugriff", () => {
  it("lässt den Verwalter in sein eigenes Objekt", async () => {
    expect(await canVerwalterAccessProperty(a.verwalter, a.objekt.id)).toBe(true);
  });

  it("hält den Verwalter aus dem Objekt der anderen Organisation heraus", async () => {
    // Der Kern der Sache: `verwalter` ist SuperAdmin — die höchste Rolle im
    // Portal. Auch sie endet an der Organisationsgrenze.
    expect(await canVerwalterAccessProperty(a.verwalter, b.objekt.id)).toBe(false);
    expect(await canVerwalterAccessProperty(b.verwalter, a.objekt.id)).toBe(false);
  });

  it("gibt einem Eigentümer kein fremdes Objekt", async () => {
    expect(await ownsProperty(a.eigentuemer.id, a.objekt.id, a.org.id)).toBe(true);
    expect(await ownsProperty(a.eigentuemer.id, b.objekt.id, b.org.id)).toBe(false);
    // Auch nicht, wenn die eigene Org-Kennung mitgegeben wird: Der Filter darf
    // sich nicht darauf verlassen, dass der Aufrufer die richtige Org nennt.
    expect(await ownsProperty(a.eigentuemer.id, b.objekt.id, a.org.id)).toBe(false);
  });

  it("gibt einem Mieter kein fremdes Objekt", async () => {
    expect(await canViewProperty(a.mieter, a.objekt.id)).toBe(true);
    expect(await canViewProperty(a.mieter, b.objekt.id)).toBe(false);
  });

  it("lässt niemanden ein fremdes Objekt verwalten", async () => {
    expect(await canAdministerProperty(a.verwalter, b.objekt.id)).toBe(false);
    // Ein Eigentümer verwaltet auch das eigene Objekt nicht.
    expect(await canAdministerProperty(a.eigentuemer, a.objekt.id)).toBe(false);
  });

  it("nennt in ownedUnitIdsInProperty nur eigene Einheiten", async () => {
    expect(await ownedUnitIdsInProperty(a.eigentuemer.id, a.objekt.id)).toEqual([a.einheit.id]);
    expect(await ownedUnitIdsInProperty(a.eigentuemer.id, b.objekt.id)).toEqual([]);
  });
});

describe("Mandantentrennung: Listenfilter", () => {
  it("liefert dem Verwalter nur Objekte der eigenen Organisation", async () => {
    const treffer = await db.property.findMany({
      where: await propertyWhereForVerwalter(a.verwalter),
      select: { id: true },
    });
    expect(treffer.map((p) => p.id)).toEqual([a.objekt.id]);
  });

  it("liefert dem Verwalter nur Nutzer der eigenen Organisation", async () => {
    const treffer = await db.user.findMany({
      where: await userWhereForVerwalter(a.verwalter),
      select: { id: true, organizationId: true },
    });
    expect(treffer.length).toBeGreaterThan(0);
    for (const u of treffer) expect(u.organizationId).toBe(a.org.id);
  });
});

describe("Mandantentrennung: Nutzerverwaltung", () => {
  it("erlaubt keine Verwaltung fremder Nutzer", async () => {
    expect(await canVerwalterManageUser(a.verwalter, a.mieter.id)).toBe(true);
    // Diese Prüfung deckt den DSGVO-Export ab (/api/export/[userId]): Ohne sie
    // exportierte ein Verwalter die Daten eines fremden Kunden.
    expect(await canVerwalterManageUser(a.verwalter, b.mieter.id)).toBe(false);
    expect(await canVerwalterManageUser(a.verwalter, b.eigentuemer.id)).toBe(false);
  });
});
