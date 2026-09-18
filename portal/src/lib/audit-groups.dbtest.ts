import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db, resetDatabase, seedOrganization, type Fixture } from "@/test/harness";
import { db as appDb } from "./db";
import { auditAccessFor, auditProjection, auditSelect, auditWhere } from "./audit-query";
import { auditFilteredWhere, auditGroupPage, auditWhereSql, AUDIT_GROUP_PREVIEW } from "./audit-groups";
import { auditTargetLinks } from "./audit-links";
import type { Prisma } from "@/generated/prisma/client";

let a: Fixture; let b: Fixture;
beforeEach(async () => { await resetDatabase(); a = await seedOrganization("groups-a"); b = await seedOrganization("groups-b"); });
afterAll(async () => { await db.$disconnect(); await appDb.$disconnect(); });
async function event(f: Fixture, data: Partial<Prisma.AuditLogUncheckedCreateInput> = {}) {
  return db.auditLog.create({ data: { organizationId: f.org.id, propertyId: f.objekt.id, actorId: f.verwalter.id, actorName: "Anna",
    actorKind: "USER", effectiveActorId: f.verwalter.id, category: "JOURNAL", schemaVersion: 1, requestId: "shared-request",
    action: "RECORD_UPDATE", operation: "UPDATE", targetType: "LedgerAccount", targetId: "example", createdAt: new Date(),
    changes: { name: { before: "Alt", after: "Neu" } }, ...data } });
}
const params = { view: "journal", q: "Anna" };

describe("Audit-Log grouped queries and destination access", () => {
  it("filters tenants in both directions before grouping and counting", async () => {
    await event(a); await event(a); await event(b); await event(b); await event(b);
    for (const [f, other, count] of [[a, b, 2], [b, a, 3]] as const) {
      const access = await auditAccessFor(f.verwalter);
      const result = await auditGroupPage(access, params);
      expect(result.total).toBe(1); expect(result.eventCount).toBe(count);
      expect(result.groups[0].count).toBe(count);
      expect(result.groups[0].rows.every(r => r.organizationId === f.org.id)).toBe(true);
      expect((await auditGroupPage(access, { ...params, property: other.objekt.id })).eventCount).toBe(0);
      const foreign = await db.auditLog.findFirstOrThrow({ where: { organizationId: other.org.id, actorName: "Anna" } });
      expect((await auditGroupPage(access, { ...params, group: foreign.id })).eventCount).toBe(0);
    }
  });
  it("separates actors, represented users, categories, objects and legacy/missing keys", async () => {
    await event(a); await event(a);
    await event(a, { actorKind: "SUPPORT" });
    await event(a, { effectiveActorId: a.eigentuemer.id });
    await event(a, { propertyId: null });
    await event(a, { requestId: null }); await event(a, { requestId: null });
    await event(a, { schemaVersion: 0 }); await event(a, { schemaVersion: 0 });
    await event(a, { category: "SECURITY" });
    const result = await auditGroupPage(await auditAccessFor(a.verwalter), params);
    expect(result.total).toBe(8); expect(result.eventCount).toBe(9);
    expect(result.groups.filter(g => g.count === 2)).toHaveLength(1);
  });
  it("paginates complete groups rather than splitting them at event boundaries", async () => {
    for (let index = 0; index < 22; index++) {
      await event(a, { requestId: `group-${index}`, createdAt: new Date("2026-09-18T10:00:00Z") });
      await event(a, { requestId: `group-${index}`, createdAt: new Date("2026-09-18T10:00:00Z") });
    }
    const access = await auditAccessFor(a.verwalter);
    const first = await auditGroupPage(access, params);
    const second = await auditGroupPage(access, { ...params, page: "2" });
    expect(first.total).toBe(22); expect(first.eventCount).toBe(44);
    expect(first.groups).toHaveLength(20); expect(second.groups).toHaveLength(2);
    expect([...first.groups, ...second.groups].every(g => g.count === 2 && g.rows.length === 2)).toBe(true);
    expect(new Set([...first.groups, ...second.groups].map(g => g.id)).size).toBe(22);
    expect((await auditGroupPage(access, { ...params, page: "999" })).page).toBe(2);
  });
  it("bounds large group previews and exposes every matching record through the detail pages", async () => {
    for (let index = 0; index < AUDIT_GROUP_PREVIEW + 3; index++) await event(a);
    const access = await auditAccessFor(a.verwalter);
    const result = await auditGroupPage(access, params);
    const group = result.groups[0];
    expect(group.count).toBe(53); expect(group.rows).toHaveLength(50);
    const selected = { ...params, group: group.id, display: "entries" };
    const individual = await auditGroupPage(access, selected);
    expect(individual.total).toBe(53); expect(individual.totalPages).toBe(3);
    expect(await db.auditLog.count({ where: await auditFilteredWhere(access, selected) })).toBe(53);
    expect((await auditGroupPage(access, { ...selected, page: "3" })).groups).toHaveLength(13);
  });
  it("applies record, area and date filters within groups and fails closed on invalid areas", async () => {
    await event(a, { targetType: "Booking", targetId: "one", createdAt: new Date("2026-09-18T10:00:00Z") });
    await event(a, { targetType: "Document", targetId: "two", createdAt: new Date("2026-09-17T10:00:00Z") });
    const access = await auditAccessFor(a.verwalter);
    expect((await auditGroupPage(access, { ...params, area: "finances" })).eventCount).toBe(1);
    expect((await auditGroupPage(access, { ...params, record: "two" })).groups[0].rows[0].targetId).toBe("two");
    expect((await auditGroupPage(access, { ...params, from: "2026-09-18", to: "2026-09-18" })).eventCount).toBe(1);
    for (const area of ["unknown", "__proto__"]) expect((await auditGroupPage(access, { ...params, area })).eventCount).toBe(0);
  });
  it("uses the identical rights/filter result for SQL grouping and Prisma exports", async () => {
    await event(a); await event(b); await event(a, { targetType: "Booking" });
    await event(a, { category: "SECURITY", targetType: null, operation: null });
    for (const user of [a.verwalter, b.verwalter, a.eigentuemer, { ...a.verwalter, isSuperAdmin: false }]) {
      const access = await auditAccessFor(user);
      for (const extra of [{}, { q: "Anna" }, { q: "' OR TRUE --" }, { capture: "events" }, { capture: "legacy" }, { capture: "changes" }, { from: "invalid" }, { area: "access", view: "security" }]) {
        const where = auditWhere(access, { view: "journal", ...extra });
        const expected = await db.auditLog.findMany({ where, select: { id: true } });
        const actual = await db.$queryRaw<{ id: string }[]>`SELECT "id" FROM "AuditLog" WHERE ${auditWhereSql(where)}`;
        expect(actual.map(r => r.id).sort()).toEqual(expected.map(r => r.id).sort());
      }
    }
  });
  it("does not count hidden owner events or expose private changes/identities within a visible group", async () => {
    await event(a, { changes: { name: { before: "Alt", after: "Neu" }, ibanChanged: { before: null, after: true } } });
    await event(a, { targetType: "Booking" });
    const result = await auditGroupPage(await auditAccessFor(a.eigentuemer), params);
    expect(result.eventCount).toBe(1);
    expect(result.groups[0].rows[0].changes.map(c => c.field)).toEqual(["name"]);
    expect(result.groups[0].rows[0].requestId).toBeNull();
    expect(result.groups[0].rows[0].effectiveActorId).toBeNull();
  });
  it("links current authorized bookings/plans/statements but never foreign, deleted or owner-only records", async () => {
    for (const [f, other] of [[a, b], [b, a]]) {
      const account = await db.ledgerAccount.create({ data: { organizationId: f.org.id, propertyId: f.objekt.id, name: "Konto" } });
      const booking = await db.booking.create({ data: { organizationId: f.org.id, propertyId: f.objekt.id, accountId: account.id, createdById: f.verwalter.id, kind: "AUSGABE", amountCents: 123, bookingDate: new Date(), text: "Test" } });
      const plan = await db.economicPlan.create({ data: { organizationId: f.org.id, propertyId: f.objekt.id, createdById: f.verwalter.id, year: 2026 } });
      const statement = await db.annualStatement.create({ data: { organizationId: f.org.id, propertyId: f.objekt.id, createdById: f.verwalter.id, year: 2026 } });
      const access = await auditAccessFor(f.verwalter);
      const records = await db.auditLog.findMany({ where: { targetId: { in: [booking.id, plan.id, statement.id] } }, select: auditSelect });
      const rows = records.map(r => auditProjection(r, access));
      const links = await auditTargetLinks(f.verwalter, rows);
      expect(links.size).toBe(3);
      expect([...links.values()].some(l => l.href.endsWith(`?buchung=${booking.id}`))).toBe(true);
      expect((await auditTargetLinks(other.verwalter, rows)).size).toBe(0);
      expect((await auditTargetLinks(f.eigentuemer, rows)).size).toBe(0);
      expect((await auditTargetLinks({ ...f.verwalter, isSuperAdmin: false }, rows)).size).toBe(0);
      await db.booking.delete({ where: { id: booking.id } });
      expect((await auditTargetLinks(f.verwalter, rows)).size).toBe(2);
    }
  });
});
