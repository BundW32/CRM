import type { Prisma, User } from "@/generated/prisma/client";
import { db } from "./db";

// Einheiten, die ein Mieter aktuell bewohnt (inkl. Objekt)
export async function tenantUnits(userId: string) {
  const tenancies = await db.tenancy.findMany({
    where: { userId, active: true },
    include: { unit: { include: { property: true } } },
  });
  return tenancies.map((t) => t.unit);
}

// Objekte, die einem Eigentümer gehören
export async function ownedProperties(userId: string) {
  const ownerships = await db.ownership.findMany({
    where: { userId },
    include: { property: true },
  });
  return ownerships.map((o) => o.property);
}

// Welche Vorgänge darf der Nutzer sehen?
export async function ticketWhereForUser(user: User): Promise<Prisma.TicketWhereInput> {
  switch (user.role) {
    case "VERWALTER":
      return {};
    case "EIGENTUEMER": {
      const properties = await ownedProperties(user.id);
      return {
        OR: [
          { createdById: user.id },
          { propertyId: { in: properties.map((p) => p.id) } },
        ],
      };
    }
    default:
      return { createdById: user.id };
  }
}

export async function canViewTicket(
  user: User,
  ticket: { createdById: string; propertyId: string }
) {
  if (user.role === "VERWALTER") return true;
  if (ticket.createdById === user.id) return true;
  if (user.role === "EIGENTUEMER") {
    const properties = await ownedProperties(user.id);
    return properties.some((p) => p.id === ticket.propertyId);
  }
  return false;
}

// Welche Dokumente darf der Nutzer sehen?
export async function documentWhereForUser(user: User): Promise<Prisma.DocumentWhereInput> {
  switch (user.role) {
    case "VERWALTER":
      return {};
    case "EIGENTUEMER": {
      const properties = await ownedProperties(user.id);
      return {
        audience: { in: ["EIGENTUEMER", "ALLE"] },
        propertyId: { in: properties.map((p) => p.id) },
      };
    }
    default: {
      const units = await tenantUnits(user.id);
      return {
        audience: { in: ["MIETER", "ALLE"] },
        OR: [
          { unitId: { in: units.map((u) => u.id) } },
          { unitId: null, propertyId: { in: units.map((u) => u.propertyId) } },
        ],
      };
    }
  }
}

// Welche Aushänge darf der Nutzer sehen?
export async function announcementWhereForUser(
  user: User
): Promise<Prisma.AnnouncementWhereInput> {
  switch (user.role) {
    case "VERWALTER":
      return {};
    case "EIGENTUEMER": {
      const properties = await ownedProperties(user.id);
      return {
        audience: { in: ["EIGENTUEMER", "ALLE"] },
        propertyId: { in: properties.map((p) => p.id) },
      };
    }
    default: {
      const units = await tenantUnits(user.id);
      return {
        audience: { in: ["MIETER", "ALLE"] },
        propertyId: { in: units.map((u) => u.propertyId) },
      };
    }
  }
}

// Objekte/Einheiten, für die der Nutzer einen Vorgang anlegen darf
export async function ticketTargetsForUser(user: User) {
  if (user.role === "VERWALTER") {
    const properties = await db.property.findMany({
      include: { units: true },
      orderBy: { name: "asc" },
    });
    return properties.flatMap((p) => [
      { propertyId: p.id, unitId: null as string | null, label: `${p.name} (gesamtes Objekt)` },
      ...p.units.map((u) => ({
        propertyId: p.id,
        unitId: u.id as string | null,
        label: `${p.name} – ${u.label}`,
      })),
    ]);
  }
  if (user.role === "EIGENTUEMER") {
    const properties = await ownedProperties(user.id);
    return properties.map((p) => ({
      propertyId: p.id,
      unitId: null as string | null,
      label: `${p.name}, ${p.street}`,
    }));
  }
  const units = await tenantUnits(user.id);
  return units.map((u) => ({
    propertyId: u.propertyId,
    unitId: u.id as string | null,
    label: `${u.property.name}, ${u.property.street} – ${u.label}`,
  }));
}
