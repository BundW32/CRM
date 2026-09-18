import type { User } from "@/generated/prisma/client";
import { db } from "./db";
import { propertyWhereForVerwalter } from "./access";
import type { AuditEvent } from "./audit-presentation";

/** Audit visibility does NOT grant access to the linked finance pages. */
export async function auditTargetLinks(user: User, rows: AuditEvent[]) {
  const links = new Map<string, { href: string; label: string }>();
  if (!user.active || user.role !== "VERWALTER") return links;
  const properties = await db.property.findMany({ where: { AND: [await propertyWhereForVerwalter(user),
    { managementType: "WEG", id: { in: rows.flatMap(r => r.propertyId ? [r.propertyId] : []) } }] }, select: { id: true } });
  const scope = { organizationId: user.organizationId, propertyId: { in: properties.map(p => p.id) } };
  const ids = (type: string) => rows.flatMap(r => r.targetType === type && r.targetId ? [r.targetId] : []);
  const [bookings, plans, statements] = await Promise.all([
    db.booking.findMany({ where: { ...scope, id: { in: ids("Booking") } }, select: { id: true, propertyId: true } }),
    db.economicPlan.findMany({ where: { ...scope, id: { in: ids("EconomicPlan") } }, select: { id: true, propertyId: true } }),
    db.annualStatement.findMany({ where: { ...scope, id: { in: ids("AnnualStatement") } }, select: { id: true, propertyId: true } }),
  ]);
  for (const [type, records, path, label] of [
    ["Booking", bookings, "buchhaltung", "Zur Buchung"],
    ["EconomicPlan", plans, "wirtschaftsplan", "Zum Wirtschaftsplan"],
    ["AnnualStatement", statements, "jahresabrechnung", "Zur Jahresabrechnung"],
  ] as const) {
    const current = new Map(records.map(r => [r.id, r]));
    for (const row of rows) {
      const record = row.targetId ? current.get(row.targetId) : undefined;
      if (row.targetType !== type || !record || row.organizationId !== user.organizationId || record.propertyId !== row.propertyId) continue;
      links.set(row.id, { label, href: `/verwaltung/weg/${encodeURIComponent(record.propertyId)}/${path}${type === "Booking" ? `?buchung=${encodeURIComponent(record.id)}` : `/${encodeURIComponent(record.id)}`}` });
    }
  }
  return links;
}
