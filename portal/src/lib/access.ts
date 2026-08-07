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

// Besitzt der Eigentümer mindestens ein WEG-Objekt? (für die WEG-Navigation).
// Zählt objektweite Ownership ODER Einheiteneigentum (UnitOwnership).
export async function ownsWegProperty(userId: string) {
  const [byProperty, byUnit] = await Promise.all([
    db.ownership.count({ where: { userId, property: { managementType: "WEG" } } }),
    db.unitOwnership.count({ where: { userId, unit: { property: { managementType: "WEG" } } } }),
  ]);
  return byProperty > 0 || byUnit > 0;
}

// Gehört dem Eigentümer dieses (WEG-)Objekt? Org-gesichert. Grundlage der
// Belegeinsicht: jeder Eigentümer darf die Buchhaltung seiner WEG einsehen.
// Eigentümerstellung zählt über die objektweite Ownership ODER die feinere
// UnitOwnership (Einheiteneigentümer ist per Definition WEG-Mitglied) – beide
// können in der Praxis einzeln gepflegt sein.
export async function ownsProperty(userId: string, propertyId: string, organizationId: string) {
  const [byProperty, byUnit] = await Promise.all([
    db.ownership.count({
      where: { userId, propertyId, property: { organizationId, managementType: "WEG" } },
    }),
    db.unitOwnership.count({
      where: { userId, unit: { propertyId, property: { organizationId, managementType: "WEG" } } },
    }),
  ]);
  return byProperty > 0 || byUnit > 0;
}

// Darf der Nutzer dieses Objekt grundsätzlich einsehen – für NICHT sensible,
// objektbezogene Inhalte wie das Titelbild? Verwalter im Scope, Eigentümer
// (Ownership ODER UnitOwnership) oder aktueller Mieter einer Einheit des Objekts.
// Immer org-gesichert.
export async function canViewProperty(user: User, propertyId: string): Promise<boolean> {
  if (user.role === "VERWALTER") return canVerwalterAccessProperty(user, propertyId);
  if (user.role === "EIGENTUEMER") {
    const [byProperty, byUnit] = await Promise.all([
      db.ownership.count({
        where: { userId: user.id, propertyId, property: { organizationId: user.organizationId } },
      }),
      db.unitOwnership.count({
        where: { userId: user.id, unit: { propertyId, property: { organizationId: user.organizationId } } },
      }),
    ]);
    return byProperty > 0 || byUnit > 0;
  }
  if (user.role === "MIETER") {
    const c = await db.tenancy.count({
      where: {
        userId: user.id,
        active: true,
        unit: { propertyId, property: { organizationId: user.organizationId } },
      },
    });
    return c > 0;
  }
  return false;
}

// WEG-Objekte, an denen der Nutzer Eigentümer ist (Ownership ODER UnitOwnership).
export async function wegPropertiesForOwner(userId: string, organizationId: string) {
  const props = await db.property.findMany({
    where: {
      organizationId,
      managementType: "WEG",
      OR: [{ ownerships: { some: { userId } } }, { units: { some: { unitOwnerships: { some: { userId } } } } }],
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return props;
}

// Einheiten eines Objekts, die dem Nutzer (laut UnitOwnership) zugeordnet sind –
// unabhängig vom Zeitraum (auch beendete Eigentümerschaften, für Altjahres-
// Abrechnungen). Für „meine Einzelabrechnung".
export async function ownedUnitIdsInProperty(userId: string, propertyId: string): Promise<string[]> {
  const rows = await db.unitOwnership.findMany({
    where: { userId, unit: { propertyId } },
    select: { unitId: true },
  });
  return [...new Set(rows.map((r) => r.unitId))];
}

// ── Selbstverwaltung (WEG ohne externen Verwalter) ──────────────────────────
// Selbstverwaltete Org? (accountType). Nimmt das (ggf. schon geladene) Org-Objekt.
export function isSelfManaged(org: { accountType: string } | null | undefined): boolean {
  return org?.accountType === "selbstverwalter";
}

/**
 * Voreinstellung für die erklärenden Hinweise (`User.showHints`) eines neu
 * angelegten Kontos.
 *
 * Aus `docs/PRODUKT-Laientauglichkeit-und-UseCases.md` §1.2: Wer beruflich
 * verwaltet, braucht nicht erklärt zu bekommen, was ein Wirtschaftsplan ist —
 * für ihn sind die Kästen Ballast. Alle anderen bekommen sie: der
 * selbstverwaltende Eigentümer, der es nebenbei macht, und **auch** Eigentümer
 * und Mieter einer professionell verwalteten WEG. Deren Laienstatus hängt nicht
 * am Kontotyp ihrer Verwaltung.
 *
 * Abschaltbar bleibt es in beide Richtungen unter „Konto" — dies ist die
 * Voreinstellung, keine Festlegung.
 */
export function hinweiseVoreinstellung(
  role: string,
  org: { accountType: string } | null | undefined,
): boolean {
  return !(role === "VERWALTER" && !isSelfManaged(org));
}

// Darf der Nutzer über Beschlüsse dieses Objekts abstimmen? Rollenunabhängig –
// allein die Eigentümerstellung (Ownership) zählt. So kann auch ein interner
// Verwalter (VERWALTER-User, der zugleich Eigentümer ist) mitstimmen.
export async function canVoteOnProperty(userId: string, propertyId: string): Promise<boolean> {
  const count = await db.ownership.count({ where: { userId, propertyId } });
  return count > 0;
}

// ── Verwaltungsbeirat (§ 29 WEG) ────────────────────────────────────────────
// Ein Beirat ist immer ein Eigentümer (Ownership.isBoardMember). Er erbt damit
// automatisch alle Eigentümer-Rechte; die Beirats-Zusatzrechte (erweiterte
// Einsicht, Prüfvermerk, eigener Bereich) hängen zusätzlich an diesem Kennzeichen.

// Ist der Nutzer Beiratsmitglied dieses Objekts?
export async function isBoardMemberOf(userId: string, propertyId: string): Promise<boolean> {
  const count = await db.ownership.count({ where: { userId, propertyId, isBoardMember: true } });
  return count > 0;
}

// Ist der Nutzer irgendwo Beiratsmitglied? (für Navigation/Feature-Freigabe).
export async function isBoardMember(userId: string): Promise<boolean> {
  const count = await db.ownership.count({ where: { userId, isBoardMember: true } });
  return count > 0;
}

// WEG-Objekte, in denen der Nutzer Beiratsmitglied ist (id + name).
export async function boardPropertiesFor(userId: string) {
  const ownerships = await db.ownership.findMany({
    where: { userId, isBoardMember: true, property: { managementType: "WEG" } },
    select: { property: { select: { id: true, name: true } } },
    orderBy: { property: { name: "asc" } },
  });
  return ownerships.map((o) => o.property);
}

// Objekt-IDs, in denen der Nutzer Beiratsmitglied ist.
export async function boardPropertyIdsFor(userId: string): Promise<string[]> {
  const rows = await db.ownership.findMany({
    where: { userId, isBoardMember: true },
    select: { propertyId: true },
  });
  return [...new Set(rows.map((r) => r.propertyId))];
}

// Darf der Nutzer dieses Objekt administrieren (Beschlüsse/Versammlungen anlegen,
// Anträge übernehmen)? Professionelle Verwalter im Scope ODER – in einer
// selbstverwalteten Org – der interne Verwalter (VERWALTER-User mit Zugriff).
export async function canAdministerProperty(user: User, propertyId: string): Promise<boolean> {
  if (user.role !== "VERWALTER") return false;
  return canVerwalterAccessProperty(user, propertyId);
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
  // Org-Filter gilt IMMER – auch für SuperAdmin (= alles INNERHALB der eigenen Org).
  // active: true blendet archivierte Objekte aus den aktiven Verwalter-Listen aus
  // (Dashboard, Ticket-Ziele, Statistiken, Objektliste). Archivierte werden separat
  // (nur SuperAdmin) angezeigt und lassen sich reaktivieren oder – falls leer – löschen.
  if (ids === null) return { organizationId: user.organizationId, active: true };
  return { id: { in: ids }, organizationId: user.organizationId, active: true };
}

/**
 * WHERE-Filter für die Nutzerliste eines Verwalters.
 * SuperAdmin: alle Nutzer. Eingeschränkter Verwalter: nur Mieter/Eigentümer
 * seiner zugewiesenen Objekte (keine anderen Verwalter/Handwerker).
 */
export async function userWhereForVerwalter(actor: User): Promise<Prisma.UserWhereInput> {
  const ids = await propertyIdsForVerwalter(actor);
  // DSGVO-anonymisierte (gelöschte) Nutzer werden aus allen aktiven Listen
  // ausgeblendet – sie erscheinen nicht mehr als „Gelöschter Nutzer".
  // SuperAdmin: alle Nutzer der EIGENEN Org (nicht mehr global).
  if (ids === null) return { organizationId: actor.organizationId, anonymizedAt: null };
  return {
    organizationId: actor.organizationId,
    anonymizedAt: null,
    OR: [
      { role: "MIETER", tenancies: { some: { active: true, unit: { propertyId: { in: ids } } } } },
      { role: "EIGENTUEMER", ownerships: { some: { propertyId: { in: ids } } } },
    ],
  };
}

/**
 * Darf der Verwalter auf dieses Objekt zugreifen (lesen/ändern/löschen)?
 * SuperAdmin: immer. Eingeschränkter Verwalter: nur zugewiesene Objekte.
 * Objektlose Datensätze (propertyId = null) sind NUR für SuperAdmin zugänglich –
 * verhindert, dass eingeschränkte Verwalter "globale" Datensätze anderer berühren.
 * Zentrale Scope-Prüfung für schreibende Actions (Beschlüsse, Aushänge,
 * Dokumente, Wartung, Einheiten, Dokument-Quellen).
 */
export async function canVerwalterAccessProperty(
  user: User,
  propertyId: string | null
): Promise<boolean> {
  const ids = await propertyIdsForVerwalter(user);
  // Objektloser (globaler) Datensatz: nur SuperAdmin der eigenen Org.
  if (!propertyId) return ids === null;
  // Eingeschränkter Verwalter: Zuweisungen liegen per Definition in der eigenen Org.
  if (ids !== null) return ids.includes(propertyId);
  // SuperAdmin: Objekt muss zur eigenen Org gehören (verhindert Cross-Org-Zugriff per ID).
  const prop = await db.property.findUnique({
    where: { id: propertyId },
    select: { organizationId: true },
  });
  return prop?.organizationId === user.organizationId;
}

/**
 * Scope-Prüfung für ein Übergabeprotokoll: löst Einheit → Objekt auf und prüft
 * gegen die zugewiesenen Objekte. Verhindert IDOR auf Handover-Dateien
 * (Protokoll-PDF mit Mieter-PII, Raumfotos, Zählerbilder) zwischen Verwaltern.
 */
export async function canVerwalterAccessHandover(
  user: User,
  handoverId: string
): Promise<boolean> {
  const ids = await propertyIdsForVerwalter(user);
  const handover = await db.handover.findUnique({
    where: { id: handoverId },
    select: { organizationId: true, unit: { select: { propertyId: true } } },
  });
  if (!handover) return false;
  // Org-Wand zuerst – auch SuperAdmin sieht nur Übergaben der eigenen Org.
  if (handover.organizationId !== user.organizationId) return false;
  if (ids === null) return true;
  return ids.includes(handover.unit.propertyId);
}

/**
 * Darf dieser Verwalter den angegebenen Nutzer sehen/verwalten?
 * SuperAdmin: immer. Eingeschränkter Verwalter: nur Mieter/Eigentümer
 * seiner zugewiesenen Objekte (sowie sich selbst).
 */
export async function canVerwalterManageUser(actor: User, targetUserId: string): Promise<boolean> {
  if (targetUserId === actor.id) return true;
  const ids = await propertyIdsForVerwalter(actor);
  if (ids === null) {
    // SuperAdmin: Ziel muss in derselben Org sein (nicht mehr blind true).
    const c = await db.user.count({
      where: { id: targetUserId, organizationId: actor.organizationId },
    });
    return c > 0;
  }
  const count = await db.user.count({
    where: {
      id: targetUserId,
      organizationId: actor.organizationId,
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
  // Org- und Zuweisungsprüfung in einem (canVerwalterAccessProperty ist org-bewusst).
  if (!(await canVerwalterAccessProperty(user, propertyId))) return false;
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
  // Org-Filter immer – Handwerker sind pro Mandant getrennt.
  if (ids === null) return { organizationId: user.organizationId };
  return { id: { in: ids }, organizationId: user.organizationId };
}

export async function canVerwalterUseCraftsman(user: User, craftsmanId: string): Promise<boolean> {
  // Org-Wand zuerst: Handwerker muss zur eigenen Org gehören.
  const c = await db.craftsman.findUnique({
    where: { id: craftsmanId },
    select: { organizationId: true },
  });
  if (!c || c.organizationId !== user.organizationId) return false;
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
  // SuperAdmin: alle Notizen der eigenen Org.
  if (ids === null) return { organizationId: user.organizationId };
  const userScope = await userWhereForVerwalter(user);
  return {
    organizationId: user.organizationId,
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
 * noteWhereForVerwalter enthält jetzt immer den Org-Filter (auch für SuperAdmin),
 * daher genügt der count gegen diesen Scope.
 */
export async function canVerwalterAccessNote(user: User, noteId: string): Promise<boolean> {
  const where = await noteWhereForVerwalter(user);
  const count = await db.note.count({ where: { AND: [{ id: noteId }, where] } });
  return count > 0;
}

// Welche Vorgänge darf der Nutzer sehen?
export async function ticketWhereForUser(user: User): Promise<Prisma.TicketWhereInput> {
  switch (user.role) {
    case "VERWALTER": {
      const ids = await propertyIdsForVerwalter(user);
      if (ids === null) return { organizationId: user.organizationId };
      return {
        organizationId: user.organizationId,
        OR: [{ propertyId: { in: ids } }, { propertyId: null }],
      };
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
  ticket: {
    createdById: string;
    propertyId: string | null;
    assignedToId: string | null;
    organizationId: string;
  }
) {
  if (user.role === "VERWALTER") {
    // Org-Wand zuerst – auch SuperAdmin sieht nur Vorgänge der eigenen Org.
    if (ticket.organizationId !== user.organizationId) return false;
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
      if (ids === null) return { organizationId: user.organizationId };
      return {
        organizationId: user.organizationId,
        OR: [{ propertyId: { in: ids } }, { propertyId: null }],
      };
    }
    case "EIGENTUEMER": {
      const [properties, boardIds] = await Promise.all([
        ownedProperties(user.id),
        boardPropertyIdsFor(user.id),
      ]);
      const ownedIds = properties.map((p) => p.id);
      const audienceOr: Prisma.DocumentWhereInput[] = [
        { audience: { in: ["EIGENTUEMER", "ALLE"] }, propertyId: { in: ownedIds } },
      ];
      // Beiratsmitglieder sehen zusätzlich die nur für den Beirat bestimmten
      // Dokumente ihrer Beirats-Objekte.
      if (boardIds.length > 0) {
        audienceOr.push({ audience: "BEIRAT", propertyId: { in: boardIds } });
      }
      // Gezielt an mich adressierte Dokumente IMMER; sonst die Audience-/Objekt-
      // Logik, aber nur für Dokumente OHNE gezielte Empfänger.
      return {
        OR: [
          { recipients: { some: { userId: user.id } } },
          { recipients: { none: {} }, OR: audienceOr },
        ],
      };
    }
    default: {
      const units = await tenantUnits(user.id);
      const unitIds = units.map((u) => u.id);
      const propIds = units.map((u) => u.propertyId);
      return {
        OR: [
          { recipients: { some: { userId: user.id } } },
          {
            recipients: { none: {} },
            audience: { in: ["MIETER", "ALLE"] },
            OR: [
              { unitId: { in: unitIds } },
              { unitId: null, propertyId: { in: propIds } },
            ],
          },
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
      if (ids === null) return { organizationId: user.organizationId };
      return { organizationId: user.organizationId, propertyId: { in: ids } };
    }
    case "EIGENTUEMER": {
      const [properties, boardIds] = await Promise.all([
        ownedProperties(user.id),
        boardPropertyIdsFor(user.id),
      ]);
      const ownedIds = properties.map((p) => p.id);
      const or: Prisma.AnnouncementWhereInput[] = [
        { audience: { in: ["EIGENTUEMER", "ALLE"] }, propertyId: { in: ownedIds } },
      ];
      if (boardIds.length > 0) {
        or.push({ audience: "BEIRAT", propertyId: { in: boardIds } });
      }
      return { OR: or };
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

// ── Verwalter-Plus: Anfragen an den zertifizierten Verwalter (§ 26a WEG) ─────
// Sichtbar ist IMMER nur der eigene Mandant: Die Anfrage geht zwar an den
// Betreiber, aber die Nachbar-WEG geht sie nichts an. Ob der TARIF die Funktion
// einschließt, prüft hatPlanFunktion (lib/billing.ts) — Mandantentrennung und
// Plan-Sperre sind zwei getrennte Fragen mit getrennten Wächtern.
export function verwalterAnfrageWhereForVerwalter(
  user: User,
): Prisma.VerwalterAnfrageWhereInput {
  return { organizationId: user.organizationId };
}

export async function canVerwalterAccessAnfrage(
  user: User,
  anfrageId: string,
): Promise<boolean> {
  if (user.role !== "VERWALTER") return false;
  const c = await db.verwalterAnfrage.count({
    where: { id: anfrageId, ...verwalterAnfrageWhereForVerwalter(user) },
  });
  return c > 0;
}
