import { createHash } from "node:crypto";
import type { User } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { AUDIT, logAudit } from "@/lib/audit";
import { auditAccessFor, auditOrder, auditProjection, auditSelect } from "@/lib/audit-query";
import { auditFilteredWhere } from "@/lib/audit-groups";
import { auditActionLabels, csvCell } from "@/lib/audit-display";

export async function auditExport(user: User, request: Request, platform = false): Promise<Response> {
  const sp = Object.fromEntries(new URL(request.url).searchParams);
  const format = sp.format ?? "csv";
  if (!["csv", "json"].includes(format)) return new Response("Unbekanntes Exportformat.", { status: 400 });
  const access = await auditAccessFor(user, platform);
  const rows = await db.auditLog.findMany({ where: await auditFilteredWhere(access, sp), orderBy: auditOrder, take: 10_001, select: auditSelect });
  if (rows.length > 10_000) return new Response("Mehr als 10.000 Einträge. Bitte den Zeitraum oder die Filter eingrenzen.", { status: 422 });
  const events = rows.map((row) => auditProjection(row, access));
  const exportedAt = new Date().toISOString();
  const body = format === "json" ? JSON.stringify({ exportVersion: 1, exportedAt, timeZone: "UTC", count: events.length, events }, null, 2) : "\uFEFF" + [
    ["Ereignis-ID", "Zeitpunkt (UTC)", "Kategorie", "Aktion", "Organisations-ID", "Objekt-ID", "Akteur", "Akteur-ID", "Herkunft", "Effektiver Akteur", "Datensatzart", "Datensatz-ID", "Transaktions-ID", "Schema-Version", "Änderungen (JSON)", "Metadaten (JSON)", "IP"],
    ...events.map((row) => [row.id, row.createdAt, row.category, auditActionLabels[row.action] ?? row.action, row.organizationId, row.propertyId, row.actorName, row.actorId, row.actorKind, row.effectiveActorId, row.targetType, row.targetId, row.requestId, row.schemaVersion, JSON.stringify(row.changes), JSON.stringify(row.meta), row.ip]),
  ].map((row) => row.map(csvCell).join(";")).join("\r\n");
  await logAudit({ actorId: user.id, action: AUDIT.AUDIT_EXPORTED, targetType: "AuditLog", organizationId: user.organizationId,
    meta: { format, count: events.length, view: access.owner || sp.view === "journal" ? "journal" : "security", from: sp.from, to: sp.to }, strict: true });
  return new Response(body, { headers: {
    "Content-Type": format === "json" ? "application/json; charset=utf-8" : "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="audit-${exportedAt.slice(0, 10)}.${format}"`,
    "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    "X-Audit-Content-SHA256": createHash("sha256").update(body).digest("hex"),
  } });
}
