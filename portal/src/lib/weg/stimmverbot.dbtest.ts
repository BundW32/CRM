import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db, resetDatabase, seedOrganization, type Fixture } from "@/test/harness";
import { ladeBeteiligte, ladeThema } from "./stimmverbot-service";
import { pruefeStimmverbot } from "./stimmverbot";

/**
 * Gegen eine ECHTE Datenbank, und dafür gibt es einen Grund.
 *
 * `stimmverbot.ts` ist rein und in `stimmverbot.test.ts` vollständig geprüft.
 * Die Frage, die dort NICHT beantwortet werden kann, ist die eigentliche: Wer
 * ist bei diesem Objekt „die Verwaltung"? Das ist ein Schnitt aus Rolle,
 * Objektzuweisung und Eigentümerstellung — vier Bedingungen in einer Abfrage.
 * Ob die halten, lässt sich nicht am Quelltext ablesen, sondern nur daran, was
 * die Abfrage zurückgibt (siehe AGENTS.md, „Prüfungen mit Datenbank").
 *
 * Und die Mandantentrennung gehört dazu: Ein Verwalter der Nachbar-Organisation
 * darf hier unter keinen Umständen auftauchen — sonst sperrte das Programm
 * einen Eigentümer wegen eines Amtes, das er in einer fremden WEG innehat.
 */
describe("Stimmverbot — wer ist beteiligt?", () => {
  let a: Fixture;
  let b: Fixture;

  beforeEach(async () => {
    await resetDatabase();
    a = await seedOrganization("stimmverbot-a");
    b = await seedOrganization("stimmverbot-b");
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  /** Macht den Verwalter der Organisation zugleich zum Eigentümer des Objekts. */
  async function verwalterWirdEigentuemer(f: Fixture) {
    await db.ownership.create({ data: { userId: f.verwalter.id, propertyId: f.objekt.id } });
  }

  it("erkennt den Verwalter, der zugleich Eigentümer ist", async () => {
    await verwalterWirdEigentuemer(a);
    const beteiligte = await ladeBeteiligte(a.objekt.id);
    expect(beteiligte.verwalterIds).toContain(a.verwalter.id);
  });

  it("erkennt einen Verwalter OHNE Eigentum nicht", async () => {
    // Ein externer Verwalter hält kein Eigentum und hat ohnehin kein
    // Stimmrecht. Ihn hier zu führen, hieße eine Sperre für jemanden zu bauen,
    // der gar nicht abstimmen kann.
    const beteiligte = await ladeBeteiligte(a.objekt.id);
    expect(beteiligte.verwalterIds).not.toContain(a.verwalter.id);
  });

  it("erkennt einen Verwalter ohne Zuständigkeit für DIESES Objekt nicht", async () => {
    // Eine große Verwaltung teilt Objekte zu (`PropertyAssignment`). Wer für
    // dieses Objekt nicht zuständig ist, ist hier nicht „die Verwaltung" — auch
    // wenn er zufällig eine Wohnung darin besitzt. Ihm das Stimmrecht zu nehmen
    // wäre schlicht falsch.
    const fremder = await db.user.create({
      data: {
        email: `fremd-${Date.now()}@example.test`,
        name: "Nicht zuständig",
        role: "VERWALTER",
        organizationId: a.org.id,
        isSuperAdmin: false,
        passwordHash: "x",
      },
    });
    await db.ownership.create({ data: { userId: fremder.id, propertyId: a.objekt.id } });

    const ohneZuweisung = await ladeBeteiligte(a.objekt.id);
    expect(ohneZuweisung.verwalterIds).not.toContain(fremder.id);

    // Mit Zuweisung zählt er.
    await db.propertyAssignment.create({
      data: { userId: fremder.id, propertyId: a.objekt.id },
    });
    const mitZuweisung = await ladeBeteiligte(a.objekt.id);
    expect(mitZuweisung.verwalterIds).toContain(fremder.id);
  });

  it("erkennt Beiratsmitglieder über Ownership.isBoardMember", async () => {
    await db.ownership.update({
      where: { userId_propertyId: { userId: a.eigentuemer.id, propertyId: a.objekt.id } },
      data: { isBoardMember: true },
    });
    const beteiligte = await ladeBeteiligte(a.objekt.id);
    expect(beteiligte.beiratsIds).toEqual([a.eigentuemer.id]);
  });

  // ── Mandantentrennung, in beide Richtungen ────────────────────────────────
  it("führt den Verwalter der FREMDEN Organisation nicht", async () => {
    await verwalterWirdEigentuemer(a);
    await verwalterWirdEigentuemer(b);
    const beteiligteA = await ladeBeteiligte(a.objekt.id);
    const beteiligteB = await ladeBeteiligte(b.objekt.id);
    expect(beteiligteA.verwalterIds).not.toContain(b.verwalter.id);
    expect(beteiligteB.verwalterIds).not.toContain(a.verwalter.id);
  });

  it("führt Beiräte der FREMDEN Organisation nicht", async () => {
    await db.ownership.update({
      where: { userId_propertyId: { userId: b.eigentuemer.id, propertyId: b.objekt.id } },
      data: { isBoardMember: true },
    });
    const beteiligteA = await ladeBeteiligte(a.objekt.id);
    expect(beteiligteA.beiratsIds).not.toContain(b.eigentuemer.id);
  });

  // ── Thema aus dem Tagesordnungspunkt ──────────────────────────────────────
  describe("Thema eines Beschlusses", () => {
    /** Beschluss mit optionalem TOP anlegen. */
    async function beschluss(titel: string, templateKey?: string) {
      const r = await db.resolution.create({
        data: {
          organizationId: a.org.id,
          propertyId: a.objekt.id,
          title: titel,
          description: titel,
          createdById: a.verwalter.id,
        },
      });
      if (templateKey) {
        const m = await db.ownersMeeting.create({
          data: {
            organizationId: a.org.id,
            propertyId: a.objekt.id,
            title: "Versammlung",
            scheduledAt: new Date("2026-05-01"),
            createdById: a.verwalter.id,
          },
        });
        await db.meetingAgendaItem.create({
          data: {
            meetingId: m.id,
            sortOrder: 0,
            title: titel,
            type: "BESCHLUSS",
            resolutionId: r.id,
            templateKey,
          },
        });
      }
      return r;
    }

    it("liest den Vorlagenschlüssel des TOPs", async () => {
      const r = await beschluss("Beliebiger Titel", "ENTLASTUNG_VERWALTUNG");
      expect(await ladeThema(r.id)).toBe("ENTLASTUNG_VERWALTUNG");
    });

    it("fällt beim Umlaufbeschluss auf den eigenen Titel zurück", async () => {
      // Ein Umlaufbeschluss hat keinen TOP — betreffen kann er die Entlastung
      // trotzdem, und dann gilt dasselbe Stimmverbot.
      const r = await beschluss("Entlastung der Verwaltung 2025");
      expect(await ladeThema(r.id)).toBe("ENTLASTUNG_VERWALTUNG");
    });

    it("erkennt bei einem gewöhnlichen Beschluss kein Thema", async () => {
      const r = await beschluss("Beschluss über die Hausordnung");
      expect(await ladeThema(r.id)).toBeNull();
    });
  });

  // ── Der Befund aus dem Produkttest, Ende zu Ende ──────────────────────────
  it("sperrt den Verwalter-Eigentümer bei seiner eigenen Entlastung", async () => {
    await verwalterWirdEigentuemer(a);
    const r = await db.resolution.create({
      data: {
        organizationId: a.org.id,
        propertyId: a.objekt.id,
        title: "Entlastung der Verwaltung",
        description: "Beschlussvorschlag",
        createdById: a.verwalter.id,
      },
    });

    const [thema, beteiligte] = await Promise.all([
      ladeThema(r.id),
      ladeBeteiligte(a.objekt.id),
    ]);

    // Der Verwalter, der zugleich Eigentümer ist: gesperrt.
    expect(pruefeStimmverbot(thema, a.verwalter.id, beteiligte)?.gesperrt).toBe(true);
    // Ein gewöhnlicher Eigentümer derselben WEG: darf abstimmen.
    expect(pruefeStimmverbot(thema, a.eigentuemer.id, beteiligte)).toBeNull();
  });
});
