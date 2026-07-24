import type { ReactNode } from "react";
import {
  craftsmanWhereForVerwalter,
  isSelfManaged,
  propertyIdsForVerwalter,
  propertyWhereForVerwalter,
  userWhereForVerwalter,
} from "@/lib/access";
import { db } from "@/lib/db";
import { getOrganization, requireVerwalter } from "@/lib/session";
import { verwaltungGroups } from "@/lib/verwaltung-nav";
import { VerwaltungShell, type CountBadges } from "@/components/verwaltung-shell";
import type { User } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

// Zähler-Badges für die Sidebar. Bündelt die Abfragen in einem Promise.all und
// begrenzt sie auf den Zuständigkeitsbereich des Verwalters (wie der bisherige
// Hub). Wird als Promise an die Client-Shell durchgereicht und dort ohne
// Blockade des ersten Renders aufgelöst.
async function loadCounts(verwalter: User): Promise<CountBadges> {
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

export default async function VerwaltungLayout({ children }: { children: ReactNode }) {
  const verwalter = await requireVerwalter();
  const org = await getOrganization();

  // Selbstverwaltete WEG: bestehender Hub/Fluss bleibt unverändert – keine neue Sidebar.
  if (isSelfManaged(org)) {
    return <>{children}</>;
  }

  const hasWegObjekte =
    (await db.property.count({
      where: { ...(await propertyWhereForVerwalter(verwalter)), managementType: "WEG" },
    })) > 0;

  const groups = verwaltungGroups({
    isSuperAdmin: Boolean(verwalter.isSuperAdmin),
    hasWegObjekte,
  });

  // Promise NICHT awaiten: die Shell rendert sofort, die Zähler streamen nach.
  const badgesPromise = loadCounts(verwalter);

  return (
    <VerwaltungShell groups={groups} badgesPromise={badgesPromise}>
      {children}
    </VerwaltungShell>
  );
}
