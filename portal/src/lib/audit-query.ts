import { Prisma, type User } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { propertyWhereForVerwalter } from "@/lib/access";
import { isPlatformAdminUser } from "@/lib/platform-admin";
import { auditChanges, auditDayBoundary, ownerJournalFields, safeAuditMeta } from "@/lib/audit-display";
import { auditAreas } from "@/lib/audit-presentation";

export type AuditParams = Record<string, string | undefined>;
export class AuditAccessError extends Error {}
export type AuditAccess = {
  where: Prisma.AuditLogWhereInput;
  owner: boolean;
  security: boolean;
  platform: boolean;
  properties: { id: string; name: string }[];
};

/** Resolve rights afresh on every page/export request. URL filters only narrow. */
export async function auditAccessFor(user: User, platform = false): Promise<AuditAccess> {
  if (!user.active) throw new AuditAccessError("Kein Zugriff auf das Audit-Log.");
  if (platform) {
    if (!isPlatformAdminUser(user)) throw new AuditAccessError("Kein Plattformzugriff.");
    return { where: {}, owner: false, security: true, platform: true, properties: [] };
  }
  const org = { organizationId: user.organizationId };
  if (user.role === "VERWALTER") {
    const properties = await db.property.findMany({ where: await propertyWhereForVerwalter(user), select: { id: true, name: true }, orderBy: { name: "asc" } });
    return {
      where: user.isSuperAdmin ? org : { AND: [org, { OR: [
        { category: "JOURNAL", propertyId: { in: properties.map((p) => p.id) } },
        { category: "SECURITY", actorId: user.id, actorKind: "USER" },
      ] }] },
      owner: false, security: true, platform: false, properties,
    };
  }
  if (user.role !== "EIGENTUEMER") throw new AuditAccessError("Kein Zugriff auf das Audit-Log.");
  const now = new Date();
  // Legacy property ownership is still used by this application. A dated unit
  // ownership alone grants access only while current (not future/former owners).
  const properties = await db.property.findMany({
    where: { ...org, managementType: "WEG", OR: [
      { ownerships: { some: { userId: user.id } }, units: { none: { unitOwnerships: { some: { userId: user.id } } } } },
      { units: { some: { unitOwnerships: { some: { userId: user.id, validFrom: { lte: now }, OR: [{ validTo: null }, { validTo: { gt: now } }] } } } } },
    ] }, select: { id: true, name: true }, orderBy: { name: "asc" },
  });
  const propertyIds = properties.map((p) => p.id);
  const [plans, statements] = await Promise.all([
    db.economicPlan.findMany({ where: { ...org, propertyId: { in: propertyIds }, status: "BESCHLOSSEN" }, select: { id: true, items: { select: { id: true } } } }),
    db.annualStatement.findMany({ where: { ...org, propertyId: { in: propertyIds }, status: "FERTIG" }, select: { id: true } }),
  ]);
  return {
    where: { ...org, category: "JOURNAL", schemaVersion: 1, propertyId: { in: propertyIds }, OR: [
      { targetType: { in: Object.keys(ownerJournalFields).filter((t) => !["EconomicPlan", "EconomicPlanItem", "AnnualStatement"].includes(t)) } },
      { targetType: "EconomicPlan", targetId: { in: plans.map((p) => p.id) } },
      { targetType: "EconomicPlanItem", targetId: { in: plans.flatMap((p) => p.items.map((item) => item.id)) } },
      { targetType: "AnnualStatement", targetId: { in: statements.map((s) => s.id) } },
    ] },
    owner: true, security: false, platform: false, properties,
  };
}

export function auditWhere(access: AuditAccess, sp: AuditParams): Prisma.AuditLogWhereInput {
  const category = access.owner || sp.view === "journal" ? "JOURNAL" : "SECURITY";
  const and: Prisma.AuditLogWhereInput[] = [access.where, { category }];
  if (sp.area) {
    const area = Object.hasOwn(auditAreas, sp.area) ? auditAreas[sp.area as keyof typeof auditAreas] : undefined;
    and.push(area ? sp.area === "access" ? { OR: [{ targetType: { in: area.targets } }, { category: "SECURITY", targetType: null }] } : { targetType: { in: area.targets } } : { id: { in: [] } });
  }
  for (const [param, column] of [["action", "action"], ["target", "targetType"], ["property", "propertyId"], ["actor", "actorId"], ["record", "targetId"], ["request", "requestId"]] as const) {
    if (sp[param]) and.push({ [column]: sp[param]!.slice(0, 150) });
  }
  if (access.platform && sp.organization) and.push({ organizationId: sp.organization.slice(0, 150) });
  if (["USER", "SUPPORT", "SYSTEM", "CRAFTSMAN", "UNKNOWN"].includes(sp.origin ?? "")) and.push({ actorKind: sp.origin });
  if (sp.capture === "changes") and.push({ operation: { not: null } });
  if (sp.capture === "events") and.push({ operation: null, schemaVersion: 1 });
  if (sp.capture === "legacy") and.push({ schemaVersion: 0 });
  const q = sp.q?.trim().slice(0, 150);
  if (q) and.push({ OR: [
    { actorName: { contains: q, mode: "insensitive" } },
    { targetId: { contains: q, mode: "insensitive" } },
    { action: { contains: q, mode: "insensitive" } },
  ] });
  const from = auditDayBoundary(sp.from);
  const until = auditDayBoundary(sp.to, true);
  // Invalid supplied dates fail closed instead of unexpectedly widening exports.
  if ((sp.from && !from) || (sp.to && !until)) and.push({ id: { in: [] } });
  if (from || until) and.push({ createdAt: { gte: from, lt: until } });
  return { AND: and };
}

export const auditSelect = {
  id: true, organizationId: true, propertyId: true, category: true, schemaVersion: true,
  actorId: true, actorName: true, actorKind: true, effectiveActorId: true, requestId: true,
  action: true, operation: true, targetType: true, targetId: true, changes: true,
  meta: true, ip: true, createdAt: true,
} satisfies Prisma.AuditLogSelect;

export type AuditRow = Prisma.AuditLogGetPayload<{ select: typeof auditSelect }>;
export function auditProjection(row: AuditRow, access: AuditAccess) {
  return {
    id: row.id, createdAt: row.createdAt.toISOString(), category: row.category,
    schemaVersion: row.schemaVersion, organizationId: row.organizationId, propertyId: row.propertyId,
    actorId: row.actorId, actorName: row.actorName, actorKind: row.actorKind,
    effectiveActorId: access.owner ? null : row.effectiveActorId,
    requestId: access.owner ? null : row.requestId, action: row.action,
    targetType: row.targetType, targetId: row.targetId, operation: row.operation,
    changes: auditChanges(row.changes, row.targetType, access.owner),
    meta: access.owner ? {} : safeAuditMeta(row.meta),
    // IP data belongs to security events, never the community journal.
    ip: access.security && row.category === "SECURITY" ? row.ip : null,
  };
}

export const auditOrder = [{ createdAt: "desc" }, { id: "desc" }] satisfies Prisma.AuditLogOrderByWithRelationInput[];
