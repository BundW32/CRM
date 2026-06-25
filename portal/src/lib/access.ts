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

// Besitzt der Eigentümer mindestens ein WEG-Objekt? (für die Beschluss-Navigation)
export async function ownsWegProperty(userId: string) {
  const count = await db.ownership.count({
    where: { userId, property: { managementType: "WEG" } },
  });
  return count > 0;
}

/**
 * Gibt die zugewiesenen Property-IDs eines Verwalters zurück.
 * null = Super-Admin, kein Filter → sieht alles.
 * string[] = eingeschränkter Verwalter → nur diese Objekte.
 */
export async function propertyIdsForVerwalter(user: User): Promise<string[] | null> {
  if (user.isSuperAdmin) return null;
  const assignments = await db.propertyAssignment.findMany({
    where: { userId: user.id },
    select: { propertyId: true },
  });
  return assignments.map((a) => a.propertyId);
}

/**
 * Prisma-WHERE für Property-Queries: nutzt propertyIdsForVerwalter.
 * Verwendung: db.property.findMany({ where: await propertyWhereForVerwalter(user) })
 */
export async function propertyWhereForVerwalter(user: User): Promise<Prisma.PropertyWhereInput> {
  const ids = await propertyIdsForVerwalter(user);
  if (ids === null) return {};
  return { id: { in: ids } };
}

/**
 * WHERE-Filter für die Nutzerliste eines Verwalters.
 * SuperAdmin: alle Nutzer. Eingeschränkter Verwalter: nur Mieter/Eigentümer
 * seiner zugewiesenen Objekte (keine anderen Verwalter/Handwerker).
 */
export async function userWhereForVerwalter(actor: User): Promise<Prisma.UserWhereInput> {
  const ids = await propertyIdsForVerwalter(actor);
  if (ids === null) return {};
  return {
    OR: [
      { role: "MIETER", tenancies: { some: { active: true, unit: { propertyId: { in: ids } } } } },
      { role: "EIGENTUEMER", ownerships: { some: { propertyId: { in: ids } } } },
    ],
  };
}

/**
 * Darf dieser Verwalter den angegebenen Nutzer sehen/verwalten?
 * SuperAdmin: immer. Eingeschränkter Verwalter: nur Mieter/Eigentümer
 * seiner zugewiesenen Objekte (sowie sich selbst).
 */
export async function canVerwalterManageUser(actor: User, targetUserId: string): Promise<boolean> {
  const ids = await propertyIdsForVerwalter(actor);
  if (ids === null) return true; // SuperAdmin
  if (targetUserId === actor.id) return true;
  const count = await db.user.count({
    where: {
      id: targetUserId,
      OR: [
        { tenancies: { some: { active: true, unit: { propertyId: { in: ids } } } } },
        { ownerships: { some: { propertyId: { in: ids } } } },
      ],
    },
  });
  return count > 0;
}

/**
 * Darf dieser Verwalter einen Vorgang für dieses Ziel (Objekt + optional Einheit)
 * anlegen/zuordnen? Ersetzt das Laden **aller** Ziele (ticketTargetsForUser) durch
 * eine gezielte Scope-Prüfung – wichtig bei sehr großen Beständen.
 */
export async function canVerwalterUseTicketTarget(
  user: User,
  propertyId: string,
  unitId: string | null
): Promise<boolean> {
  if (!propertyId) return false;
  const ids = await propertyIdsForVerwalter(user);
  if (ids !== null && !ids.includes(propertyId)) return false;
  if (!unitId) return true;
  // Einheit muss zum (erlaubten) Objekt gehören.
  const count = await db.unit.count({ where: { id: unitId, propertyId } });
  return count > 0;
}

/**
 * Welche Handwerker darf dieser Verwalter sehen/nutzen?
 * SuperAdmin: alle. Eingeschränkter Verwalter ohne Auswahl: alle
 * (gemeinsamer Pool). Mit Auswahl: nur die zugewiesenen Handwerker.
 * Rückgabe null = unbeschränkt (alle).
 */
export async function craftsmanIdsForVerwalter(user: User): Promise<string[] | null> {
  if (user.isSuperAdmin) return null;
  const assignments = await db.craftsmanAssignment.findMany({
    where: { userId: user.id },
    select: { craftsmanId: true },
  });
  if (assignments.length === 0) return null; // keine Auswahl = alle
  return assignments.map((a) => a.craftsmanId);
}

export async function craftsmanWhereForVerwalter(user: User): Promise<Prisma.CraftsmanWhereInput> {
  const ids = await craftsmanIdsForVerwalter(user);
  if (ids === null) return {};
  return { id: { in: ids } };
}

export async function canVerwalterUseCraftsman(user: User, craftsmanId: string): Promise<boolean> {
  const ids = await craftsmanIdsForVerwalter(user);
  if (ids === null) return true;
  return ids.includes(craftsmanId);
}

/**
 * WHERE-Filter für interne Notizen eines Verwalters.
 * SuperAdmin: alle Notizen. Eingeschränkter Verwalter: nur Notizen zu seinen
 * Objekten/Einheiten, zu Personen in seinem Scope oder rein allgemeine Notizen.
 * Verhindert Querleaks von personenbezogenen Notizen anderer Objekte.
 */
export async function noteWhereForVerwalter(user: User): Promise<Prisma.NoteWhereInput> {
  const ids = await propertyIdsForVerwalter(user);
  if (ids === null) return {};
  const userScope = await userWhereForVerwalter(user);
  return {
    OR: [
      { property: { id: { in: ids } } },
      { unit: { property: { id: { in: ids } } } },
      { targetUser: userScope },
      { AND: [{ propertyId: null }, { unitId: null }, { targetUserId: null }] },
    ],
  };
}

/**
 * Darf der Verwalter auf diese Notiz zugreifen (löschen/anpinnen)? Verhindert IDOR.
 */
export async function canVerwalterAccessNote(user: User, noteId: string): Promise<boolean> {
  const ids = await propertyIdsForVerwalter(user);
  if (ids === null) return true;
  const where = await noteWhereForVerwalter(user);
  const count = await db.note.count({ where: { AND: [{ id: noteId }, where] } });
  return count > 0;
}

// Welche Vorgänge darf der Nutzer sehen?
export async function ticketWhereForUser(user: User): Promise<Prisma.TicketWhereInput> {
  switch (user.role) {
    case "VERWALTER": {
      const ids = await propertyIdsForVerwalter(user);
      if (ids === null) return {};
      return { OR: [{ propertyId: { in: ids } }, { propertyId: null }] };
    }
    case "EIGENTUEMER": {
      const properties = await ownedProperties(user.id);
      return {
        OR: [
          { createdById: user.id },
          { propertyId: { in: properties.map((p) => p.id) } },
        ],
      };
    }
    case "HANDWERKER":
      return { assignedToId: user.id };
    default:
      return { createdById: user.id };
  }
}

export async function canViewTicket(
  user: User,
  ticket: { createdById: string; propertyId: string | null; assignedToId: string | null }
) {
  if (user.role === "VERWALTER") {
    const ids = await propertyIdsForVerwalter(user);
    if (ids === null) return true;
    return ticket.propertyId === null || ids.includes(ticket.propertyId);
  }
  if (user.role === "HANDWERKER") return ticket.assignedToId === user.id;
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
    case "VERWALTER": {
      const ids = await propertyIdsForVerwalter(user);
      if (ids === null) return {};
      return { OR: [{ propertyId: { in: ids } }, { propertyId: null }] };
    }
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
    case "VERWALTER": {
      const ids = await propertyIdsForVerwalter(user);
      if (ids === null) return {};
      return { propertyId: { in: ids } };
    }
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

export type TicketTarget = {
  propertyId: string;
  propertyName: string;
  unitId: string | null;
  unitLabel: string;
  tenantNames: string[];
  label: string;
};

// Objekte/Einheiten, für die der Nutzer einen Vorgang anlegen darf.
// Für Verwalter: zwei schlanke Abfragen statt einer tief geschachtelten, die
// vollständige User-/Property-Objekte in den RAM lädt (kritisch bei 1.000+
// Einheiten – vorher wurden u. a. passwordHash, Unterschriften, alle
// Property-Felder für jede Einheit in den Speicher geladen).
export async function ticketTargetsForUser(user: User): Promise<TicketTarget[]> {
  if (user.role === "VERWALTER") {
    const propWhere = await propertyWhereForVerwalter(user);

    const [properties, units] = await Promise.all([
      db.property.findMany({
        where: propWhere,
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      db.unit.findMany({
        where: { property: propWhere },
        select: {
          id: true,
          label: true,
          propertyId: true,
          tenancies: {
            where: { active: true },
            select: { user: { select: { name: true } } },
          },
        },
        orderBy: [{ property: { name: "asc" } }, { label: "asc" }],
      }),
    ]);

    // Einheiten nach Objekt gruppieren
    const unitsByProperty = new Map<string, typeof units>();
    for (const u of units) {
      const list = unitsByProperty.get(u.propertyId) ?? [];
      list.push(u);
      unitsByProperty.set(u.propertyId, list);
    }

    return properties.flatMap((p) => [
      {
        propertyId: p.id,
        propertyName: p.name,
        unitId: null,
        unitLabel: "gesamtes Objekt",
        tenantNames: [],
        label: `${p.name} (gesamtes Objekt)`,
      },
      ...(unitsByProperty.get(p.id) ?? []).map((u) => {
        const tenantNames = u.tenancies.map((t) => t.user.name);
        return {
          propertyId: p.id,
          propertyName: p.name,
          unitId: u.id,
          unitLabel: u.label,
          tenantNames,
          label:
            tenantNames.length > 0
              ? `${p.name} – ${u.label} · ${tenantNames.join(", ")}`
              : `${p.name} – ${u.label}`,
        };
      }),
    ]);
  }
  if (user.role === "EIGENTUEMER") {
    const properties = await ownedProperties(user.id);
    return properties.map((p) => ({
      propertyId: p.id,
      propertyName: `${p.name} · ${p.street}`,
      unitId: null,
      unitLabel: "",
      tenantNames: [],
      label: `${p.name}, ${p.street}`,
    }));
  }
  const units = await tenantUnits(user.id);
  return units.map((u) => ({
    propertyId: u.propertyId,
    propertyName: `${u.property.name} · ${u.property.street}`,
    unitId: u.id,
    unitLabel: u.label,
    tenantNames: [],
    label: `${u.property.name}, ${u.property.street} – ${u.label}`,
  }));
}
