import { beforeEach, afterAll, describe, expect, it } from "vitest";
import { db, resetDatabase, seedOrganization, type Fixture } from "@/test/harness";
import { db as appDb } from "@/lib/db";
import { setAuditDatabaseContext } from "@/lib/audit-transaction";
import { auditAccessFor, AuditAccessError, auditProjection, auditSelect, auditWhere } from "@/lib/audit-query";

let a: Fixture;
let b: Fixture;
beforeEach(async () => { await resetDatabase(); a = await seedOrganization("audit-a"); b = await seedOrganization("audit-b"); });
afterAll(async () => { await db.$disconnect(); await appDb.$disconnect(); });

async function account(f: Fixture) {
  return db.$transaction(async (tx) => {
    await setAuditDatabaseContext(tx, { actorId: f.verwalter.id, actorName: f.verwalter.name, organizationId: f.org.id, effectiveActorId: f.verwalter.id, actorKind: "USER", requestId: "test-transaction" });
    return tx.ledgerAccount.create({ data: { organizationId: f.org.id, propertyId: f.objekt.id, name: "Girokonto", iban: "DE-SECRET-ACCOUNT", openingBalanceCents: 12345 } });
  });
}

describe("Audit database evidence", () => {
  it("stores UTC independently of the database session timezone", async () => {
    const start = Date.now();
    await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL TIME ZONE 'Asia/Tokyo'");
      await tx.property.update({ where: { id: a.objekt.id }, data: { name: "UTC test" } });
    });
    const event = await db.auditLog.findFirstOrThrow({ where: { targetId: a.objekt.id, operation: "UPDATE" } });
    expect(event.createdAt.getTime()).toBeGreaterThanOrEqual(start - 1000);
    expect(event.createdAt.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });
  it("records insert/update/delete, exact cents, actor and no secret values", async () => {
    const row = await account(a);
    await db.ledgerAccount.update({ where: { id: row.id }, data: { openingBalanceCents: 23456, iban: "DE-OTHER-SECRET" } });
    await db.ledgerAccount.delete({ where: { id: row.id } });
    const logs = await db.auditLog.findMany({ where: { targetType: "LedgerAccount", targetId: row.id }, orderBy: { createdAt: "asc" } });
    expect(logs.map((l) => l.operation)).toEqual(["INSERT", "UPDATE", "DELETE"]);
    expect(logs[0]).toMatchObject({ organizationId: a.org.id, propertyId: a.objekt.id, actorId: a.verwalter.id, actorName: a.verwalter.name, actorKind: "USER", requestId: "test-transaction" });
    expect(logs[1].changes).toMatchObject({ openingBalanceCents: { before: 12345, after: 23456 }, ibanChanged: { before: null, after: true } });
    expect(logs[1].actorKind).toBe("UNKNOWN");
    expect(JSON.stringify(logs)).not.toContain("SECRET");
  });
  it("rolls evidence back together with the mutation and skips no-op updates", async () => {
    const row = await account(a);
    const count = await db.auditLog.count();
    await db.ledgerAccount.update({ where: { id: row.id }, data: { name: row.name } });
    expect(await db.auditLog.count()).toBe(count);
    await expect(db.$transaction(async (tx) => {
      await tx.ledgerAccount.update({ where: { id: row.id }, data: { name: "Rollback" } });
      throw new Error("rollback");
    })).rejects.toThrow("rollback");
    expect(await db.auditLog.count()).toBe(count);
    expect((await db.ledgerAccount.findUniqueOrThrow({ where: { id: row.id } })).name).toBe(row.name);
  });
  it("keeps transaction-local actor context isolated and rejects wrong organizations", async () => {
    const [ra, rb] = await Promise.all([account(a), account(b)]);
    for (const [row, f] of [[ra, a], [rb, b]] as const) {
      expect(await db.auditLog.findFirst({ where: { targetId: row.id } })).toMatchObject({ organizationId: f.org.id, actorId: f.verwalter.id });
    }
    await expect(db.$transaction(async (tx) => {
      await setAuditDatabaseContext(tx, { actorId: a.verwalter.id, actorKind: "USER", organizationId: a.org.id });
      await tx.ledgerAccount.update({ where: { id: rb.id }, data: { name: "wrong tenant" } });
    })).rejects.toThrow();
    await db.ledgerAccount.update({ where: { id: ra.id }, data: { name: "no context" } });
    expect(await db.auditLog.findFirst({ where: { targetId: ra.id, operation: "UPDATE" } })).toMatchObject({ actorKind: "UNKNOWN", actorId: null });
  });
  it("protects evidence against alteration and premature deletion, respecting legal hold", async () => {
    const row = await account(a);
    const log = await db.auditLog.findFirstOrThrow({ where: { targetId: row.id } });
    await expect(db.auditLog.update({ where: { id: log.id }, data: { action: "FORGED" } })).rejects.toThrow();
    await expect(db.auditLog.update({ where: { id: log.id }, data: { actorId: null } })).rejects.toThrow();
    await expect(db.auditLog.delete({ where: { id: log.id } })).rejects.toThrow();
    await db.auditLog.update({ where: { id: log.id }, data: { legalHold: true } });
    await expect(db.auditLog.update({ where: { id: log.id }, data: { legalHold: false } })).rejects.toThrow();
    expect(await db.auditLog.count({ where: { action: "AUDIT_HOLD_SET", targetId: log.id } })).toBe(1);
    const expired = await db.auditLog.create({ data: { action: "TEST", expiresAt: new Date("2020-01-01") } });
    const held = await db.auditLog.create({ data: { action: "TEST", expiresAt: new Date("2020-01-01"), legalHold: true } });
    await db.auditLog.delete({ where: { id: expired.id } });
    await expect(db.auditLog.delete({ where: { id: held.id } })).rejects.toThrow();
  });
  it("permits old IP removal but no replacement or early removal", async () => {
    const old = await db.auditLog.create({ data: { action: "TEST", createdAt: new Date("2020-01-01"), ip: "192.0.2.1" } });
    const fresh = await db.auditLog.create({ data: { action: "TEST", ip: "192.0.2.1" } });
    await db.auditLog.update({ where: { id: old.id }, data: { ip: null } });
    await expect(db.auditLog.update({ where: { id: fresh.id }, data: { ip: null } })).rejects.toThrow();
    await expect(db.auditLog.update({ where: { id: old.id }, data: { ip: "192.0.2.2" } })).rejects.toThrow();
    const held = await db.auditLog.create({ data: { action: "TEST", createdAt: new Date("2020-01-01"), ip: "192.0.2.3", legalHold: true } });
    await expect(db.auditLog.update({ where: { id: held.id }, data: { ip: null } })).rejects.toThrow();
  });
  it("preserves scope and actor snapshot after actor deletion", async () => {
    const row = await account(a);
    await db.user.delete({ where: { id: a.verwalter.id } });
    expect(await db.auditLog.findFirst({ where: { targetId: row.id } })).toMatchObject({ actorId: null, actorName: a.verwalter.name, organizationId: a.org.id });
  });
  it("retains scope for child rows during a cascade delete", async () => {
    const plan = await db.economicPlan.create({ data: { organizationId: a.org.id, propertyId: a.objekt.id, year: 2026, createdById: a.verwalter.id } });
    const cost = await db.costType.create({ data: { organizationId: a.org.id, propertyId: a.objekt.id, name: "Wasser" } });
    const item = await db.economicPlanItem.create({ data: { planId: plan.id, costTypeId: cost.id, amountCents: 40000 } });
    await db.economicPlan.delete({ where: { id: plan.id } });
    expect(await db.auditLog.findFirst({ where: { targetId: item.id, operation: "DELETE" } })).toMatchObject({ organizationId: a.org.id, propertyId: a.objekt.id });
  });
  it("removes actor name snapshots on anonymization without erasing the evidence", async () => {
    const row = await account(a);
    const held = await db.auditLog.create({ data: { action: "TEST", actorId: a.verwalter.id, actorName: a.verwalter.name, legalHold: true } });
    await db.user.update({ where: { id: a.verwalter.id }, data: { anonymizedAt: new Date(), name: "Gelöschter Nutzer" } });
    expect(await db.auditLog.findFirst({ where: { targetId: row.id } })).toMatchObject({ actorName: null, actorId: a.verwalter.id, organizationId: a.org.id });
    expect((await db.auditLog.findUniqueOrThrow({ where: { id: held.id } })).actorName).toBe(a.verwalter.name);
  });
  it("captures bulk booking writes and parent-linked meter readings", async () => {
    const ledger = await account(a);
    await db.booking.createMany({ data: [1000, 2000].map((amountCents) => ({ organizationId: a.org.id, propertyId: a.objekt.id, accountId: ledger.id, kind: "AUSGABE" as const, bookingDate: new Date(), amountCents, text: "Testbuchung", createdById: a.verwalter.id })) });
    expect(await db.auditLog.count({ where: { targetType: "Booking", organizationId: a.org.id, operation: "INSERT" } })).toBe(2);
    expect((await db.auditLog.findFirstOrThrow({ where: { targetType: "Booking", organizationId: a.org.id } })).changes).toMatchObject({ accountId: { after: ledger.id, afterLabel: "Girokonto" } });
    const meter = await db.meter.create({ data: { unitId: a.einheit.id, type: "STROM" } });
    const reading = await db.meterReading.create({ data: { meterId: meter.id, value: 125.75, createdById: a.verwalter.id } });
    await db.meter.delete({ where: { id: meter.id } });
    const events = await db.auditLog.findMany({ where: { targetType: "MeterReading", targetId: reading.id } });
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.organizationId === a.org.id && e.propertyId === a.objekt.id)).toBe(true);
  });
});

describe("Audit access against real PostgreSQL", () => {
  it("separates both tenants, including hostile filters and actor-less events", async () => {
    await account(a); await account(b);
    for (const [own, other] of [[a, b], [b, a]]) {
      const access = await auditAccessFor(own.verwalter);
      const rows = await db.auditLog.findMany({ where: auditWhere(access, { view: "journal" }) });
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.organizationId === own.org.id)).toBe(true);
      expect(await db.auditLog.count({ where: auditWhere(access, { view: "journal", property: other.objekt.id, organization: other.org.id }) })).toBe(0);
    }
  });
  it("limits ordinary managers to assigned properties and their own security events", async () => {
    await account(a);
    const manager = await db.user.create({ data: { organizationId: a.org.id, name: "Eingeschränkt", role: "VERWALTER", passwordHash: "irrelevant" } });
    const before = await auditAccessFor(manager);
    expect(await db.auditLog.count({ where: auditWhere(before, { view: "journal" }) })).toBe(0);
    await db.propertyAssignment.create({ data: { userId: manager.id, propertyId: a.objekt.id } });
    const access = await auditAccessFor(manager);
    expect(await db.auditLog.count({ where: auditWhere(access, { view: "journal" }) })).toBeGreaterThan(0);
    expect(await db.auditLog.count({ where: auditWhere(access, { view: "security", actor: a.verwalter.id }) })).toBe(0);
  });
  it("gives owners only approved community events and projected fields, never raw metadata", async () => {
    await account(a); await account(b);
    await db.auditLog.create({ data: { organizationId: a.org.id, propertyId: a.objekt.id, action: "TEST", category: "JOURNAL", schemaVersion: 1, targetType: "LedgerAccount", meta: { email: "secret" }, ip: "192.0.2.1", changes: { iban: { after: "SECRET" }, name: { before: "Alt", after: "Neu" } } } });
    for (const [own, other] of [[a, b], [b, a]]) {
      const access = await auditAccessFor(own.eigentuemer);
      const rows = await db.auditLog.findMany({ where: auditWhere(access, { view: "security" }), select: auditSelect });
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.category === "JOURNAL" && r.organizationId === own.org.id)).toBe(true);
      const projected = rows.map((r) => auditProjection(r, access));
      expect(JSON.stringify(projected)).not.toMatch(/SECRET|192\.0\.2|secret/);
      expect(await db.auditLog.count({ where: auditWhere(access, { target: "HausgeldMahnung" }) })).toBe(0);
      expect(await db.auditLog.count({ where: auditWhere(access, { property: other.objekt.id }) })).toBe(0);
    }
  });
  it("rejects tenants and non-platform administrators", async () => {
    await expect(auditAccessFor(a.mieter)).rejects.toBeInstanceOf(AuditAccessError);
    await expect(auditAccessFor(a.verwalter, true)).rejects.toBeInstanceOf(AuditAccessError);
  });
  it("removes access after dated ownership ends and hides draft plans", async () => {
    const draft = await db.economicPlan.create({ data: { organizationId: a.org.id, propertyId: a.objekt.id, year: 2026, createdById: a.verwalter.id } });
    let access = await auditAccessFor(a.eigentuemer);
    expect(await db.auditLog.count({ where: auditWhere(access, { record: draft.id }) })).toBe(0);
    await db.economicPlan.update({ where: { id: draft.id }, data: { status: "BESCHLOSSEN" } });
    access = await auditAccessFor(a.eigentuemer);
    expect(await db.auditLog.count({ where: auditWhere(access, { record: draft.id }) })).toBeGreaterThan(0);
    await db.unitOwnership.updateMany({ where: { userId: a.eigentuemer.id }, data: { validTo: new Date("2021-01-01") } });
    access = await auditAccessFor(a.eigentuemer);
    expect(await db.auditLog.count({ where: auditWhere(access, {}) })).toBe(0);
  });
  it("records support's real actor separately from the represented customer", async () => {
    const row = await account(b);
    await db.$transaction(async (tx) => {
      await setAuditDatabaseContext(tx, { actorId: a.verwalter.id, actorName: a.verwalter.name, organizationId: b.org.id, effectiveActorId: b.verwalter.id, actorKind: "SUPPORT" });
      await tx.ledgerAccount.update({ where: { id: row.id }, data: { name: "Supportänderung" } });
    });
    expect(await db.auditLog.findFirst({ where: { targetId: row.id, operation: "UPDATE" } })).toMatchObject({ organizationId: b.org.id, actorId: a.verwalter.id, effectiveActorId: b.verwalter.id, actorKind: "SUPPORT" });
  });
  it("invalid dates and unknown target filters cannot widen results", async () => {
    const access = await auditAccessFor(a.verwalter);
    expect(await db.auditLog.count({ where: auditWhere(access, { from: "bad" }) })).toBe(0);
    expect(await db.auditLog.count({ where: auditWhere(access, { target: "does-not-exist" }) })).toBe(0);
  });
});
