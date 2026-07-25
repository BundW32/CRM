import type { User } from "@/generated/prisma/client";
import {
  craftsmanWhereForVerwalter,
  propertyIdsForVerwalter,
  propertyWhereForVerwalter,
  userWhereForVerwalter,
} from "@/lib/access";
import { db } from "@/lib/db";
import type { CountBadges } from "@/components/app-shell";

/**
 * Zähler-Badges für die Navigationsleiste, begrenzt auf den Zuständigkeitsbereich.
 *
 * Wird bewusst als Promise an die Leiste gereicht statt abgewartet: Die Navigation
 * erscheint sofort, die Zahlen streamen nach. So kostet kein Seitenwechsel Zeit.
 */
export async function loadNavCounts(verwalter: User): Promise<CountBadges> {
  const assignedIds = await propertyIdsForVerwalter(verwalter);
  const wartungWhere =
    assignedIds === null
      ? {
          active: true,
          dueDate: { lte: new Date() },
          organizationId: verwalter.organizationId,
        }
      : { active: true, dueDate: { lte: new Date() }, property: { id: { in: assignedIds } } };

  const [objekte, nutzer, handwerker, wartungFaellig] = await Promise.all([
    db.property.count({ where: await propertyWhereForVerwalter(verwalter) }),
    db.user.count({
      where: {
        AND: [{ role: { in: ["MIETER", "EIGENTUEMER"] } }, await userWhereForVerwalter(verwalter)],
      },
    }),
    db.craftsman.count({
      where: { active: true, ...(await craftsmanWhereForVerwalter(verwalter)) },
    }),
    db.maintenanceTask.count({ where: wartungWhere }),
  ]);

  return {
    objekte: { label: String(objekte) },
    nutzer: { label: String(nutzer) },
    kontakte: { label: String(handwerker) },
    wartung:
      wartungFaellig > 0
        ? { label: `${wartungFaellig} überfällig`, tone: "warn" }
        : { label: "aktuell", tone: "ok" },
  };
}
