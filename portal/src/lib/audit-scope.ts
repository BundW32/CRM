import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

// SQL identifiers come ONLY from this constant, never directly from an event.
const scopeTables = new Set(["Organization", "Property", "User", "Unit", "Booking", "CostType", "LedgerAccount", "BankImportBatch", "EconomicPlan", "AnnualStatement", "DuePosting", "PaymentAllocation", "UnitOwnership", "Ownership", "Tenancy", "HausgeldMahnung", "Sonderumlage", "Verbindlichkeit", "SepaMandate", "Co2Allocation", "MaintenanceMeasure", "MaintenanceTask", "Resolution", "OwnersMeeting", "Document", "Ticket", "CraftsmanInvoice", "IntegrationSetting", "PlatformInvoice"]);

export async function auditTargetScope(targetType?: string, targetId?: string) {
  if (!targetType || !targetId) return null;
  if (scopeTables.has(targetType)) {
    const rows = await db.$queryRaw<{ row: Record<string, string | null> }[]>(Prisma.sql`SELECT to_jsonb(t) AS row FROM ${Prisma.raw(`"${targetType}"`)} t WHERE id = ${targetId} LIMIT 1`);
    const row = rows[0]?.row;
    if (row) {
      let propertyId: string | null | undefined = targetType === "Property" ? row.id : row.propertyId;
      if (!propertyId && row.unitId) propertyId = (await db.unit.findUnique({ where: { id: row.unitId }, select: { propertyId: true } }))?.propertyId;
      if (!propertyId && row.ticketId) propertyId = (await db.ticket.findUnique({ where: { id: row.ticketId }, select: { propertyId: true } }))?.propertyId;
      const organizationId = targetType === "Organization" ? row.id : row.organizationId ?? (propertyId ? (await db.property.findUnique({ where: { id: propertyId }, select: { organizationId: true } }))?.organizationId : null);
      return { organizationId: organizationId ?? null, propertyId: propertyId ?? null };
    }
  }
  // A delete trigger already retained scope even after the domain row disappeared.
  return db.auditLog.findFirst({ where: { targetType, targetId, schemaVersion: 1 }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { organizationId: true, propertyId: true } });
}
