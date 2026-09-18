import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { AUDIT } from "@/lib/audit";
import { auditActionLabels, auditChanges, auditDayBoundary, auditFieldLabels, auditValue, csvCell, safeAuditMeta } from "@/lib/audit-display";

describe("Audit vocabulary and safe presentation", () => {
  it("labels every known event", () => {
    for (const action of Object.values(AUDIT)) expect(auditActionLabels[action], action).toBeTruthy();
  });
  it("uses real schema fields and labels every trigger field", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    const sql = readFileSync("prisma/migrations/20260918120000_audit_journal/migration.sql", "utf8");
    const entries = [...sql.matchAll(/^    \('([A-Za-z]+)','([a-zA-Z,]+)'\)/gm)];
    expect(entries.length).toBeGreaterThan(30);
    for (const [, table, fields] of entries) {
      const model = schema.match(new RegExp(`model ${table} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? "";
      for (const field of fields.split(",")) {
        expect(model, `${table}.${field}`).toMatch(new RegExp(`\\n  ${field}\\s`));
        expect(auditFieldLabels[field], `${table}.${field}`).toBeTruthy();
      }
    }
  });
  it("redacts secrets in legacy metadata and drops unapproved fields", () => {
    expect(safeAuditMeta({ email: "private", kennung: "private", ip: "private", token: "private", password: "private", count: 2, from: { token: "private", plan: "PRO" } })).toEqual({ count: 2, from: { plan: "PRO" } });
    expect(auditChanges({ iban: { before: "DE001", after: "DE002" }, name: { before: "A", after: "B" }, ibanChanged: { before: null, after: true } }, "LedgerAccount", true)).toEqual([{ field: "name", before: "A", after: "B" }]);
    expect(auditChanges({ passwordHash: { after: "secret" } }, "User", false)).toEqual([]);
  });
  it("formats zero and cents without confusing missing values", () => {
    expect(auditValue("amountCents", 12345)).toContain("123,45");
    expect(auditValue("amountCents", 0)).toContain("0,00");
    expect(auditValue("amountCents", null)).toBe("—");
    expect(auditValue("active", false)).toBe("Nein");
  });
  it("uses inclusive Berlin calendar days across DST changes", () => {
    expect(auditDayBoundary("2026-03-29")?.toISOString()).toBe("2026-03-28T23:00:00.000Z");
    expect(auditDayBoundary("2026-03-29", true)?.toISOString()).toBe("2026-03-29T22:00:00.000Z");
    expect(auditDayBoundary("2026-10-25")?.toISOString()).toBe("2026-10-24T22:00:00.000Z");
    expect(auditDayBoundary("2026-10-25", true)?.toISOString()).toBe("2026-10-25T23:00:00.000Z");
    expect(auditDayBoundary("2026-02-30")).toBeUndefined();
    expect(auditDayBoundary("x")).toBeUndefined();
  });
  it("escapes CSV quotes, newlines and spreadsheet formulas", () => {
    expect(csvCell('a;"b"\nc')).toBe('"a;""b""\nc"');
    for (const value of ["=1+1", "+cmd", "@SUM(A1)", "-1+2", " \t=1"]) expect(csvCell(value)).toBe(`"'${value}"`);
  });
});
