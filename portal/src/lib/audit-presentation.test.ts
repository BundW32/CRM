import { describe, expect, it } from "vitest";
import { auditAreas, auditChangeKind, auditFriendlyField, auditFriendlyValue, auditGroupSentence, auditSentence, auditSubject, type AuditEvent } from "./audit-presentation";
import { auditWhereSql } from "./audit-groups";
import { auditTargetLabels } from "./audit-display";

const row: AuditEvent = { id: "event", organizationId: "org", propertyId: "property", category: "JOURNAL", schemaVersion: 1,
  actorId: "person", actorName: "Anna", actorKind: "USER", effectiveActorId: "person", requestId: "request",
  action: "RECORD_UPDATE", operation: "UPDATE", targetType: "Booking", targetId: "booking", changes: [], meta: {}, ip: null, createdAt: "2026-09-18T10:00:00Z" };

describe("Audit-Log verständliche Darstellung", () => {
  it("uses fixed sentences without inventing identity or interpreting a failed login", () => {
    expect(auditSentence(row)).toBe("Anna hat eine Buchung geändert.");
    expect(auditSentence({ ...row, actorKind: "UNKNOWN" })).toBe("Buchung geändert · Person nicht erfasst.");
    expect(auditSentence({ ...row, actorKind: "SUPPORT" })).toContain("Anna (Support)");
    expect(auditSentence({ ...row, action: "LOGIN_FAILED", operation: null })).toBe("Eine Anmeldung ist fehlgeschlagen.");
    expect(auditSentence({ ...row, action: "SECRET_NEW_CODE", operation: null })).not.toContain("SECRET_NEW_CODE");
  });
  it("counts distinct created records only when the complete group is available", () => {
    const rows = [{ ...row, operation: "INSERT", targetId: "a" }, { ...row, operation: "INSERT", targetId: "b" }];
    expect(auditGroupSentence(rows, 2)).toBe("Anna hat 2 Buchungen angelegt.");
    expect(auditGroupSentence(rows, 50)).toBe("Anna: 50 zusammengehörige Einträge.");
    expect(auditGroupSentence([rows[0], rows[0]], 2)).not.toContain("Buchungen angelegt");
  });
  it("uses only recorded historical descriptions, not current names", () => {
    expect(auditSubject(row)).toBeNull();
    const changes = [{ field: "text", before: "Alter Text", after: "Neuer Text" }];
    expect(auditSubject({ ...row, changes })).toBe("Neuer Text");
    expect(auditSubject({ ...row, operation: "DELETE", changes })).toBe("Alter Text");
  });
  it("distinguishes missing, zero and false without treating them as removal", () => {
    expect(auditChangeKind({ field: "amountCents", before: null, after: 0 })).toBe("Ergänzt");
    expect(auditChangeKind({ field: "active", before: true, after: false })).toBe("Geändert");
    expect(auditChangeKind({ field: "text", before: "Text", after: null })).toBe("Entfernt");
    expect(auditChangeKind({ field: "ibanChanged", before: null, after: true })).toBe("Geändert");
    expect(auditFriendlyValue({ field: "amountCents", before: null, after: 0 }, "before")).toBe("Nicht hinterlegt");
    expect(auditFriendlyValue({ field: "amountCents", before: null, after: 0 }, "after")).toContain("0,00");
  });
  it("keeps reference IDs out of ordinary field values", () => {
    expect(auditFriendlyField("costTypeId")).toBe("Kostenart");
    expect(auditFriendlyValue({ field: "costTypeId", before: null, after: "secret-id", afterLabel: "Reinigung" }, "after")).toBe("Reinigung");
    expect(auditFriendlyValue({ field: "costTypeId", before: null, after: "secret-id" }, "after")).not.toContain("secret-id");
  });
  it("assigns every target to exactly one simple area", () => {
    const targets = Object.values(auditAreas).flatMap(a => a.targets);
    expect(new Set(targets).size).toBe(targets.length);
    expect([...targets].sort()).toEqual(Object.keys(auditTargetLabels).sort());
  });
  it("binds SQL values and rejects unsupported access predicates rather than ignoring them", () => {
    const attack = "' OR TRUE --";
    const query = auditWhereSql({ organizationId: attack, actorName: { contains: attack, mode: "insensitive" } });
    expect(query.text).not.toContain(attack);
    expect(query.values).toContain(attack);
    expect(() => auditWhereSql({ legalHold: true })).toThrow("Unsupported");
    expect(() => auditWhereSql({ actorId: { startsWith: "x" } })).toThrow("Unsupported");
    expect(auditWhereSql({ OR: [] }).text).toContain("FALSE");
  });
});
