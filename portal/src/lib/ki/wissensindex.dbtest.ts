// Isolationstests des KI-Wissensindex — gegen eine ECHTE Datenbank.
//
// Der Wissensindex ist eine zweite Ablage derselben mandantengetrennten
// Inhalte. Ob seine Filter halten, lässt sich nur daran prüfen, was die
// Abfrage zurückgibt (siehe src/test/harness.ts). Geprüft wird beides:
// die Sichtbarkeitslogik in `scopeFuer`/`sucheChunks` UND die
// Row-Level-Security-Policy selbst — also dass eine Abfrage ganz OHNE
// Anwendungsfilter trotzdem keine fremden Zeilen liefert.
//
// Die Einbettung ist injiziert (deterministische Vektoren) — diese Tests
// prüfen Rechte und Abgleich, nicht Googles Embedding-Qualität.
//
// Ohne pgvector (Migration hat die Tabelle übersprungen) werden die Tests
// übersprungen — AUSSER in der CI: Dort ist das Datenbank-Image
// pgvector/pgvector:pg16, und ein stilles Überspringen wäre der Zustand
// „sieht nach Abdeckung aus und ist keine". Der erste Test unten schlägt
// deshalb fehl, wenn CI gesetzt ist und die Erweiterung fehlt.
import { beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { db, resetDatabase, seedOrganization, type Fixture } from "@/test/harness";
import { indexiereOrganisation, indexVerfuegbar } from "./wissensindex";
import { scopeFuer, sucheChunks, type SuchScope } from "./retrieval";

const verfuegbar = await indexVerfuegbar();

it("pgvector ist in der CI vorhanden (sonst prüfen diese Tests nichts)", () => {
  if (process.env.CI) expect(verfuegbar).toBe(true);
});

// Deterministische Einheitsvektoren: Richtung 0 für Texte mit „Dachsanierung",
// Richtung 1 für alles andere. Damit ist auch die Rangfolge prüfbar.
function richtung(i: number): number[] {
  const v = new Array(768).fill(0);
  v[i] = 1;
  return v;
}
const einbetter = async (texte: string[]) =>
  texte.map((t) => (t.includes("Dachsanierung") ? richtung(0) : richtung(1)));

const ALLE_RICHTUNGEN = richtung(0); // Abfragevektor; Score 1 für Gruppe 0, 0 für Gruppe 1.

async function titelFuer(scope: SuchScope): Promise<string[]> {
  const treffer = await sucheChunks(scope, ALLE_RICHTUNGEN, 50);
  return treffer.map((t) => t.titel);
}

describe.skipIf(!verfuegbar)("KI-Wissensindex", () => {
  let a: Fixture;
  let b: Fixture;
  let beschlussA: { id: string };

  beforeAll(async () => {
    await resetDatabase();
    a = await seedOrganization("kia");
    b = await seedOrganization("kib");

    beschlussA = await db.resolution.create({
      data: {
        organizationId: a.org.id,
        propertyId: a.objekt.id,
        title: "Dachsanierung Haus A",
        description: "Die Dachsanierung wird zum Angebotspreis beauftragt.",
        createdById: a.verwalter.id,
      },
    });
    await db.announcement.create({
      data: {
        organizationId: a.org.id,
        propertyId: a.objekt.id,
        audience: "MIETER",
        title: "Treppenhausreinigung",
        body: "Die Reinigung übernimmt ab Mai die Firma Blank.",
        createdById: a.verwalter.id,
      },
    });
    await db.announcement.create({
      data: {
        organizationId: a.org.id,
        propertyId: a.objekt.id,
        audience: "BEIRAT",
        title: "Beiratsunterlagen Rechnungsprüfung",
        body: "Die Belegprüfung findet am 12.09. statt.",
        createdById: a.verwalter.id,
      },
    });
    // Organisationsweites Dokument (ohne Objekt): nur für Verwalter sichtbar.
    await db.document.create({
      data: {
        organizationId: a.org.id,
        title: "Verwaltervertrag Muster",
        category: "VERTRAG",
        audience: "ALLE",
        fileName: "vertrag.pdf",
        storedName: "vertrag-x",
        mimeType: "application/pdf",
        size: 1000,
        uploadedById: a.verwalter.id,
      },
    });

    // Zweites Objekt in Organisation A: Der Eigentümer aus Objekt 1 darf dessen
    // Inhalte NICHT sehen. (Der Harnisch liefert je Organisation nur ein
    // Objekt — ohne dieses zweite gäbe es nichts zu verraten.)
    const objektA2 = await db.property.create({
      data: {
        organizationId: a.org.id,
        name: "Objekt A2",
        street: "Nebenweg 2",
        zip: "12345",
        city: "Teststadt",
        managementType: "WEG",
      },
    });
    await db.resolution.create({
      data: {
        organizationId: a.org.id,
        propertyId: objektA2.id,
        title: "Tiefgaragentor Objekt A2",
        description: "Das Tor wird erneuert.",
        createdById: a.verwalter.id,
      },
    });

    await db.resolution.create({
      data: {
        organizationId: b.org.id,
        propertyId: b.objekt.id,
        title: "Fassadenanstrich Haus B",
        description: "Die Fassade wird gestrichen.",
        createdById: b.verwalter.id,
      },
    });

    expect(await indexiereOrganisation(a.org.id, einbetter)).toMatchObject({ entfernt: 0 });
    expect(await indexiereOrganisation(b.org.id, einbetter)).toMatchObject({ entfernt: 0 });
  });

  it("trennt Mandanten in beide Richtungen", async () => {
    const scopeA = (await scopeFuer(a.verwalter))!;
    const scopeB = (await scopeFuer(b.verwalter))!;
    const titelA = await titelFuer(scopeA);
    const titelB = await titelFuer(scopeB);

    expect(titelA.join()).toContain("Dachsanierung Haus A");
    expect(titelA.join()).not.toContain("Fassadenanstrich Haus B");
    expect(titelB.join()).toContain("Fassadenanstrich Haus B");
    expect(titelB.join()).not.toContain("Dachsanierung Haus A");
  });

  it("Row-Level-Security hält auch ganz ohne Anwendungsfilter", async () => {
    // Der Harnisch verbindet sich als Superuser, und Superuser stehen ÜBER
    // jeder Policy (auch über FORCE). Geprüft wird deshalb mit einer eigens
    // angelegten, unprivilegierten Rolle — genau so, wie sich die Anwendung
    // in Produktion verbinden muss (siehe Kommentar in der Migration).
    await db.$executeRawUnsafe(`DROP ROLE IF EXISTS ki_rls_probe`);
    await db.$executeRawUnsafe(`CREATE ROLE ki_rls_probe LOGIN PASSWORD 'ki-rls-probe'`);
    await db.$executeRawUnsafe(`GRANT SELECT ON "KiChunk" TO ki_rls_probe`);

    const url = new URL(process.env.DATABASE_URL!);
    url.username = "ki_rls_probe";
    url.password = "ki-rls-probe";
    const probe = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url.toString() }),
    });
    try {
      // Abfrage OHNE where-Klausel, nur mit gesetzter Mandanten-Variable:
      const nurB = await probe.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_org_id', ${b.org.id}, true)`;
        return tx.$queryRaw<{ organizationId: string }[]>`SELECT "organizationId" FROM "KiChunk"`;
      });
      expect(nurB.length).toBeGreaterThan(0);
      expect(new Set(nurB.map((r) => r.organizationId))).toEqual(new Set([b.org.id]));

      // Ohne Variable: null Zeilen — die Policy vergleicht gegen NULL.
      const ohne = await probe.$queryRaw<unknown[]>`SELECT "organizationId" FROM "KiChunk"`;
      expect(ohne).toHaveLength(0);

      // Auch der Prisma-Client kommt an der Policy nicht vorbei.
      expect(await probe.kiChunk.findMany()).toHaveLength(0);
    } finally {
      await probe.$disconnect();
      await db.$executeRawUnsafe(`DROP OWNED BY ki_rls_probe`);
      await db.$executeRawUnsafe(`DROP ROLE ki_rls_probe`);
    }
  });

  it("filtert die Sichtbarkeitsmenge je Rolle in der SQL-Abfrage", async () => {
    const verwalter = await titelFuer((await scopeFuer(a.verwalter))!);
    expect(verwalter.join()).toContain("Dachsanierung Haus A");
    expect(verwalter.join()).toContain("Treppenhausreinigung");
    expect(verwalter.join()).toContain("Beiratsunterlagen Rechnungsprüfung");
    expect(verwalter.join()).toContain("Verwaltervertrag Muster");
    expect(verwalter.join()).toContain("Tiefgaragentor Objekt A2");

    const eigentuemer = await titelFuer((await scopeFuer(a.eigentuemer))!);
    expect(eigentuemer.join()).toContain("Dachsanierung Haus A");
    // Kein Beiratsmandat → keine BEIRAT-Inhalte; Mieter-Aushänge sieht ein
    // Eigentümer ebenfalls nicht (gespiegelt an announcementWhereForUser).
    expect(eigentuemer.join()).not.toContain("Beiratsunterlagen");
    expect(eigentuemer.join()).not.toContain("Treppenhausreinigung");
    // Fremdes Objekt derselben Organisation bleibt unsichtbar …
    expect(eigentuemer.join()).not.toContain("Tiefgaragentor Objekt A2");
    // … und organisationsweite Inhalte ohne Objekt sind Verwaltersache.
    expect(eigentuemer.join()).not.toContain("Verwaltervertrag Muster");

    const mieter = await titelFuer((await scopeFuer(a.mieter))!);
    expect(mieter.join()).toContain("Treppenhausreinigung");
    expect(mieter.join()).not.toContain("Dachsanierung Haus A");
    expect(mieter.join()).not.toContain("Beiratsunterlagen");
  });

  it("schaltet BEIRAT-Inhalte erst mit Beiratsmandat des Objekts frei", async () => {
    await db.ownership.updateMany({
      where: { userId: a.eigentuemer.id, propertyId: a.objekt.id },
      data: { isBoardMember: true },
    });
    const titel = await titelFuer((await scopeFuer(a.eigentuemer))!);
    expect(titel.join()).toContain("Beiratsunterlagen Rechnungsprüfung");
    // Das Mandat gilt je Objekt, nicht je Organisation.
    expect(titel.join()).not.toContain("Tiefgaragentor Objekt A2");

    await db.ownership.updateMany({
      where: { userId: a.eigentuemer.id, propertyId: a.objekt.id },
      data: { isBoardMember: false },
    });
  });

  it("ordnet nach Ähnlichkeit und liefert den Score mit", async () => {
    const scope = (await scopeFuer(a.verwalter))!;
    const treffer = await sucheChunks(scope, richtung(0), 50);
    expect(treffer[0].titel).toContain("Dachsanierung");
    expect(treffer[0].score).toBeCloseTo(1, 5);
    const uebrige = treffer.filter((t) => !t.titel.includes("Dachsanierung"));
    for (const t of uebrige) expect(t.score).toBeLessThan(0.5);
  });

  it("überspringt Unverändertes und räumt Verwaistes weg", async () => {
    // Zweiter Lauf ohne Änderungen: nichts neu, nichts entfernt.
    const unveraendert = await indexiereOrganisation(a.org.id, einbetter);
    expect(unveraendert).toMatchObject({ neu: 0, entfernt: 0 });
    expect(unveraendert!.unveraendert).toBeGreaterThan(0);

    // Geänderte Quelle wird neu eingebettet, gelöschte verschwindet.
    await db.resolution.update({
      where: { id: beschlussA.id },
      data: { description: "Die Dachsanierung wird zurückgestellt." },
    });
    const nachAenderung = await indexiereOrganisation(a.org.id, einbetter);
    expect(nachAenderung).toMatchObject({ neu: 1, entfernt: 0 });

    await db.resolution.delete({ where: { id: beschlussA.id } });
    const nachLoeschung = await indexiereOrganisation(a.org.id, einbetter);
    expect(nachLoeschung).toMatchObject({ neu: 0, entfernt: 1 });
    const titel = await titelFuer((await scopeFuer(a.verwalter))!);
    expect(titel.join()).not.toContain("Dachsanierung");
  });
});
