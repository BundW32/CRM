import { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import { auditOrder, auditProjection, auditSelect, auditWhere, type AuditAccess, type AuditParams, type AuditRow } from "./audit-query";

/** Narrow SQL translation of the SAME server-built filter used by Prisma/export.
 * Unsupported fields/operators throw: new access conditions must never be ignored.
 * Identifiers are constants; every filter value is a bound SQL parameter.
 */
export function auditWhereSql(where: Prisma.AuditLogWhereInput): Prisma.Sql {
  const columns: Record<string, Prisma.Sql> = Object.fromEntries([
    "id", "organizationId", "propertyId", "category", "schemaVersion", "actorId", "actorName", "actorKind",
    "effectiveActorId", "requestId", "action", "operation", "targetType", "targetId", "createdAt",
  ].map(name => [name, Prisma.raw(`"${name}"`)]));
  const parts: Prisma.Sql[] = [];
  for (const [key, value] of Object.entries(where)) {
    if (value === undefined) continue;
    if (key === "AND" || key === "OR") {
      const values = Array.isArray(value) ? value : [value];
      const clauses = values.map(v => {
        if (!v || typeof v !== "object" || Array.isArray(v) || v instanceof Date) throw new Error("Invalid audit filter clause");
        return auditWhereSql(v as Prisma.AuditLogWhereInput);
      });
      parts.push(clauses.length ? Prisma.sql`(${Prisma.join(clauses, key === "AND" ? " AND " : " OR ")})` : key === "AND" ? Prisma.sql`TRUE` : Prisma.sql`FALSE`);
      continue;
    }
    const column = Object.hasOwn(columns, key) ? columns[key] : undefined;
    if (!column) throw new Error(`Unsupported audit filter field: ${key}`);
    if (value === null) { parts.push(Prisma.sql`${column} IS NULL`); continue; }
    if (typeof value !== "object" || value instanceof Date) { parts.push(Prisma.sql`${column} = ${value}`); continue; }
    const filter = value as Record<string, unknown>;
    for (const [op, argument] of Object.entries(filter)) {
      if (argument === undefined) continue;
      if (op === "mode" && argument === "insensitive") continue;
      if (op === "in" && Array.isArray(argument)) parts.push(argument.length ? Prisma.sql`${column} IN (${Prisma.join(argument)})` : Prisma.sql`FALSE`);
      else if (op === "not" && argument === null) parts.push(Prisma.sql`${column} IS NOT NULL`);
      else if (op === "gte") parts.push(Prisma.sql`${column} >= ${argument}`);
      else if (op === "lt") parts.push(Prisma.sql`${column} < ${argument}`);
      // Prisma contains uses SQL LIKE, including its wildcard semantics.
      else if (op === "contains" && typeof argument === "string") parts.push(filter.mode === "insensitive" ? Prisma.sql`${column} ILIKE ${`%${argument}%`}` : Prisma.sql`${column} LIKE ${`%${argument}%`}`);
      else throw new Error(`Unsupported audit filter operator: ${op}`);
    }
  }
  return parts.length ? Prisma.sql`(${Prisma.join(parts, " AND ")})` : Prisma.sql`TRUE`;
}

/** Same request alone is insufficient: separate tenants, properties and identities. */
export function auditGroupWhere(row: AuditRow): Prisma.AuditLogWhereInput {
  if (!row.requestId || row.schemaVersion !== 1 || !row.organizationId) return { id: row.id };
  return { requestId: row.requestId, schemaVersion: 1, organizationId: row.organizationId, propertyId: row.propertyId,
    category: row.category, actorId: row.actorId, actorName: row.actorName, actorKind: row.actorKind, effectiveActorId: row.effectiveActorId };
}

// No migration or change to stored evidence. Group BEFORE pagination in SQL;
// never load the entire log into application memory merely to count groups.
const groupKey = Prisma.sql`CASE WHEN "requestId" IS NOT NULL AND "requestId" <> '' AND "schemaVersion" = 1 AND "organizationId" IS NOT NULL
  THEN jsonb_build_array('request', "requestId", "organizationId", "propertyId", "category", "actorId", "actorName", "actorKind", "effectiveActorId")
  ELSE jsonb_build_array('event', "id") END`;
const PAGE_SIZE = 20;
export const AUDIT_GROUP_PREVIEW = 50;

export async function auditFilteredWhere(access: AuditAccess, sp: AuditParams): Promise<Prisma.AuditLogWhereInput> {
  const where = auditWhere(access, sp);
  if (!sp.group) return where;
  const anchor = await db.auditLog.findFirst({ where: { AND: [access.where, { id: sp.group.slice(0, 150) }] }, select: auditSelect });
  return { AND: [where, anchor ? auditGroupWhere(anchor) : { id: { in: [] } }] };
}

export async function auditGroupPage(access: AuditAccess, sp: AuditParams) {
  const where = await auditFilteredWhere(access, sp);
  return db.$transaction(async tx => {
    const single = sp.display === "entries";
    const grouping = single ? Prisma.sql`jsonb_build_array('event', "id")` : groupKey;
    const eligible = Prisma.sql`SELECT "id", "createdAt", ${grouping} AS key FROM "AuditLog" WHERE ${auditWhereSql(where)}`;
    const [count] = await tx.$queryRaw<{ total: bigint; events: bigint }[]>`
      WITH eligible AS (${eligible}) SELECT count(DISTINCT key) AS total, count(*) AS events FROM eligible`;
    const total = Number(count.total);
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const page = Math.min(totalPages, Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1));
    const summaries = await tx.$queryRaw<{ anchor: string; count: bigint; latest: Date }[]>`
      WITH eligible AS (${eligible}) SELECT max("id") AS anchor, count(*) AS count, max("createdAt") AS latest
      FROM eligible GROUP BY key ORDER BY max("createdAt") DESC, max("id") DESC
      LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`;
    const groups = [];
    for (const summary of summaries) {
      const anchor = await tx.auditLog.findUniqueOrThrow({ where: { id: summary.anchor }, select: auditSelect });
      const rows = await tx.auditLog.findMany({ where: { AND: [where, single ? { id: anchor.id } : auditGroupWhere(anchor)] },
        select: auditSelect, orderBy: auditOrder, take: AUDIT_GROUP_PREVIEW });
      groups.push({ id: summary.anchor, count: Number(summary.count), latest: summary.latest.toISOString(), rows: rows.map(row => auditProjection(row, access)) });
    }
    return { groups, total, eventCount: Number(count.events), totalPages, page, single };
  }, { isolationLevel: "RepeatableRead", timeout: 15000 });
}
