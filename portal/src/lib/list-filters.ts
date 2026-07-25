// Gemeinsame Filter-Bausteine für Listen-Seiten.
//
// Die Objekt → Einheit → Nutzer-Kaskade wird an vielen Stellen gebraucht
// (Vorgänge, Zähler, Dokumente, Wartung, Notizen …). Sie hier einmal zu bauen
// hält die Filter überall gleich – in Optik, Reihenfolge und Verhalten – und
// stellt sicher, dass die Auswahl IMMER gegen den Scope der Rolle geprüft wird.

import type { User } from "@/generated/prisma/client";
import type { ComboboxFilterConfig } from "@/components/filter-bar";
import {
  ownedProperties,
  propertyWhereForVerwalter,
  tenantUnits,
  userWhereForVerwalter,
} from "@/lib/access";
import { db } from "@/lib/db";
import { roleLabels, unitPublicLabel } from "@/lib/labels";

export type ScopeFilterResult = {
  /** Validierte IDs – nur gesetzt, wenn sie im Scope des Nutzers liegen. */
  objektId?: string;
  einheitId?: string;
  nutzerId?: string;
  /** Fertige Combobox-Konfigurationen für die FilterBar. */
  comboboxes: ComboboxFilterConfig[];
  /** true, sobald einer der drei Filter greift (für „(gefiltert)"-Hinweise). */
  active: boolean;
};

/** Objekte, die diese Rolle sehen darf – als Auswahlliste für den Filter. */
async function accessibleProperties(user: User) {
  const select = { id: true, name: true, street: true, zip: true, city: true } as const;
  const orderBy = { name: "asc" } as const;

  if (user.role === "VERWALTER") {
    return db.property.findMany({ where: await propertyWhereForVerwalter(user), select, orderBy });
  }
  if (user.role === "EIGENTUEMER") {
    const owned = await ownedProperties(user.id);
    const ids = owned.map((p) => p.id);
    if (ids.length === 0) return [];
    return db.property.findMany({ where: { id: { in: ids } }, select, orderBy });
  }
  if (user.role === "MIETER") {
    const units = await tenantUnits(user.id);
    const ids = [...new Set(units.map((u) => u.propertyId))];
    if (ids.length === 0) return [];
    return db.property.findMany({ where: { id: { in: ids } }, select, orderBy });
  }
  return [];
}

/**
 * Baut die Objekt/Einheit/Nutzer-Filter für eine Listenseite.
 *
 * - „Einheit" bleibt gesperrt, bis ein Objekt gewählt ist; „Nutzer" erscheint
 *   erst danach (die Auswahl wäre sonst unübersichtlich groß).
 * - Hat die Rolle nur EIN Objekt (typischer Mieter/Eigentümer), entfällt der
 *   Objekt-Filter – er hätte dort keinen Nutzen.
 * - `withUnit`/`withUser` steuern, ob die jeweilige Stufe überhaupt sinnvoll
 *   ist (z. B. haben Beschlüsse keine Einheit).
 */
export async function propertyScopeFilters(
  user: User,
  sp: Record<string, string | undefined>,
  opts: { withUnit?: boolean; withUser?: boolean } = {},
): Promise<ScopeFilterResult> {
  const { withUnit = true, withUser = false } = opts;

  const properties = await accessibleProperties(user);
  // Bei nur einem (oder keinem) Objekt bringt die Auswahl nichts.
  if (properties.length < 2) return { comboboxes: [], active: false };

  const objektId = sp.objekt && properties.some((p) => p.id === sp.objekt) ? sp.objekt : undefined;

  let unitOptions: { value: string; label: string }[] = [];
  let nutzerOptions: { value: string; label: string; sublabel?: string }[] = [];
  let einheitId: string | undefined;
  let nutzerId: string | undefined;

  if (objektId && (withUnit || withUser)) {
    const [units, nutzer] = await Promise.all([
      withUnit
        ? db.unit.findMany({
            where: { propertyId: objektId },
            select: { id: true, label: true, externalLabel: true },
            orderBy: { label: "asc" },
          })
        : Promise.resolve([]),
      withUser && user.role === "VERWALTER"
        ? db.user.findMany({
            where: {
              AND: [
                await userWhereForVerwalter(user),
                {
                  OR: [
                    { tenancies: { some: { unit: { propertyId: objektId } } } },
                    { ownerships: { some: { propertyId: objektId } } },
                  ],
                },
              ],
            },
            select: { id: true, name: true, role: true },
            orderBy: { name: "asc" },
          })
        : Promise.resolve([]),
    ]);

    unitOptions = units.map((u) => ({ value: u.id, label: unitPublicLabel(u) }));
    nutzerOptions = nutzer.map((n) => ({ value: n.id, label: n.name, sublabel: roleLabels[n.role] }));
    einheitId = sp.einheit && units.some((u) => u.id === sp.einheit) ? sp.einheit : undefined;
    nutzerId = sp.nutzer && nutzer.some((n) => n.id === sp.nutzer) ? sp.nutzer : undefined;
  }

  const comboboxes: ComboboxFilterConfig[] = [
    {
      key: "objekt",
      label: "Objekt",
      placeholder: "Objekt wählen",
      options: properties.map((p) => ({
        value: p.id,
        label: p.name,
        sublabel:
          [p.street, [p.zip, p.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || undefined,
      })),
      currentValue: objektId,
      clears: ["einheit", "nutzer"],
    },
  ];

  if (withUnit) {
    comboboxes.push({
      key: "einheit",
      label: "Einheit",
      placeholder: "Einheit wählen",
      options: unitOptions,
      currentValue: einheitId,
      disabled: !objektId,
      disabledHint: "Erst Objekt wählen",
    });
  }
  if (withUser && user.role === "VERWALTER") {
    comboboxes.push({
      key: "nutzer",
      label: "Nutzer",
      placeholder: "Nutzer wählen",
      options: nutzerOptions,
      currentValue: nutzerId,
      hidden: !objektId,
    });
  }

  return {
    objektId,
    einheitId,
    nutzerId,
    comboboxes,
    active: Boolean(objektId || einheitId || nutzerId),
  };
}

/** Optionen aus einer Label-Map bauen (für die Auswahl-Filter). */
export function optionsFrom(map: Record<string, string>) {
  return Object.entries(map).map(([value, label]) => ({ value, label }));
}
