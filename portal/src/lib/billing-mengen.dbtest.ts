// Abrechnungsmengen: Einheiten und Stellplätze getrennt zählen.
//
// zaehleWegMengen speist Checkout, Mengenabgleich, Tarifwechsel und
// Abo-Anzeige — zählt sie falsch, zahlt eine Gemeinschaft für Stellplätze den
// vollen Einheitenpreis (der Zustand vor dieser Funktion) oder für die
// Einheiten einer FREMDEN Organisation. Ob der Organisations- und der
// Typ-Filter halten, zeigt nur die echte Datenbank. Beide Richtungen, wie
// immer.
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { zaehleWegMengen } from "./billing-mengen";
import { db, resetDatabase, seedOrganization, type Fixture } from "@/test/harness";

let a: Fixture;
let b: Fixture;

beforeAll(async () => {
  await resetDatabase();
  a = await seedOrganization("a");
  b = await seedOrganization("b");

  // Org A: zusätzlich 1 Wohnung + 3 Stellplätze im WEG-Objekt …
  await db.unit.createMany({
    data: [
      { propertyId: a.objekt.id, label: "WE 2" },
      { propertyId: a.objekt.id, label: "Stellplatz 1", unitType: "STELLPLATZ" },
      { propertyId: a.objekt.id, label: "Stellplatz 2", unitType: "STELLPLATZ" },
      { propertyId: a.objekt.id, label: "Garage 1", unitType: "STELLPLATZ" },
    ],
  });
  // … und ein Nicht-WEG-Objekt, dessen Einheiten nirgends mitzählen dürfen.
  const mietobjekt = await db.property.create({
    data: {
      organizationId: a.org.id,
      name: "Mietobjekt A",
      street: "Teststraße 2",
      zip: "12345",
      city: "Teststadt",
      managementType: "MIETVERWALTUNG",
    },
  });
  await db.unit.createMany({
    data: [
      { propertyId: mietobjekt.id, label: "Miete 1" },
      { propertyId: mietobjekt.id, label: "Miet-Stellplatz", unitType: "STELLPLATZ" },
    ],
  });

  // Org B: 2 Stellplätze — die Gegenprobe für beide Richtungen.
  await db.unit.createMany({
    data: [
      { propertyId: b.objekt.id, label: "Stellplatz 1", unitType: "STELLPLATZ" },
      { propertyId: b.objekt.id, label: "Stellplatz 2", unitType: "STELLPLATZ" },
    ],
  });
});

afterAll(async () => {
  await resetDatabase();
  await db.$disconnect();
});

describe("zaehleWegMengen", () => {
  it("trennt Einheiten und Stellplätze und lässt Nicht-WEG-Objekte außen vor", async () => {
    // Org A: WE 1 (Harnisch) + WE 2 = 2 Einheiten; 3 Stellplätze. Das
    // Mietobjekt zählt in keiner der beiden Zahlen mit.
    expect(await zaehleWegMengen(a.org.id)).toEqual({ einheiten: 2, stellplaetze: 3 });
  });

  it("zählt über Kreuz nichts Fremdes — in beide Richtungen", async () => {
    expect(await zaehleWegMengen(b.org.id)).toEqual({ einheiten: 1, stellplaetze: 2 });
    // Die Summen beider Organisationen unterscheiden sich — hätte ein Filter
    // still auf eine feste Organisation gezeigt, fiele genau das hier auf.
    expect(await zaehleWegMengen(a.org.id)).not.toEqual(await zaehleWegMengen(b.org.id));
  });

  it("archivierte Objekte zählen nicht — weder Einheiten noch Stellplätze", async () => {
    // Ein zweites WEG-Objekt mit 1 Wohnung + 1 Stellplatz zählt zunächst mit …
    const archiv = await db.property.create({
      data: {
        organizationId: a.org.id,
        name: "Archiv-WEG A",
        street: "Teststraße 3",
        zip: "12345",
        city: "Teststadt",
        managementType: "WEG",
      },
    });
    await db.unit.createMany({
      data: [
        { propertyId: archiv.id, label: "WE 1" },
        { propertyId: archiv.id, label: "Stellplatz", unitType: "STELLPLATZ" },
      ],
    });
    expect(await zaehleWegMengen(a.org.id)).toEqual({ einheiten: 3, stellplaetze: 4 });

    // … und fällt mit dem Archivieren aus beiden Zahlen heraus.
    await db.property.update({ where: { id: archiv.id }, data: { active: false } });
    expect(await zaehleWegMengen(a.org.id)).toEqual({ einheiten: 2, stellplaetze: 3 });
  });
});
