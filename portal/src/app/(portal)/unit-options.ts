"use server";

import { ownedProperties, propertyIdsForVerwalter, tenantUnits } from "@/lib/access";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export type UnitOption = {
  id: string;
  label: string;
  floor: string | null;
  tenantNames: string[];
};

/**
 * Lädt die Einheiten eines Objekts **on demand** – im Scope des aktuellen Nutzers.
 *
 * Hintergrund: Formulare dürfen nicht alle Einheiten des Bestands ins HTML
 * serialisieren (bei großen Beständen viele MB, Browser-Blocker). Stattdessen
 * wird nur die Objektliste ausgeliefert; die Einheiten des gewählten Objekts
 * holt der Client per Server-Action nach. Die zurückgegebene Menge ist durch die
 * Einheitenzahl genau eines Objekts begrenzt.
 */
export async function loadUnitsForProperty(propertyId: string): Promise<UnitOption[]> {
  const user = await requireUser();
  if (!propertyId) return [];

  // Scope-Prüfung je Rolle – es dürfen nur Einheiten zugänglicher Objekte geladen werden.
  if (user.role === "VERWALTER") {
    const ids = await propertyIdsForVerwalter(user);
    if (ids !== null && !ids.includes(propertyId)) return [];
  } else if (user.role === "EIGENTUEMER") {
    const owned = await ownedProperties(user.id);
    if (!owned.some((p) => p.id === propertyId)) return [];
  } else if (user.role === "MIETER") {
    // Mieter sehen ausschließlich ihre eigenen Einheiten innerhalb des Objekts.
    const myUnits = await tenantUnits(user.id);
    return myUnits
      .filter((u) => u.propertyId === propertyId)
      .map((u) => ({ id: u.id, label: u.label, floor: u.floor, tenantNames: [] }));
  } else {
    return [];
  }

  const units = await db.unit.findMany({
    where: { propertyId },
    orderBy: { label: "asc" },
    include: {
      tenancies: {
        where: { active: true },
        include: { user: { select: { name: true } } },
      },
    },
  });
  return units.map((u) => ({
    id: u.id,
    label: u.label,
    floor: u.floor,
    tenantNames: u.tenancies.map((t) => t.user.name),
  }));
}
