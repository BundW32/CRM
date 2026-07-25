import type { ReactNode } from "react";
import {
  craftsmanWhereForVerwalter,
  isSelfManaged,
  propertyIdsForVerwalter,
  propertyWhereForVerwalter,
  userWhereForVerwalter,
} from "@/lib/access";
import { db } from "@/lib/db";
import { getOrganization, getSession } from "@/lib/session";
import { verwaltungGroups } from "@/lib/verwaltung-nav";
import { VerwaltungShell, type CountBadges } from "@/components/verwaltung-shell";
import type { User } from "@/generated/prisma/client";

// Gemeinsame Hülle für die Verwaltungs-Menüführung.
//
// Wird von den Layouts der Bereiche eingebunden, die zum Verwaltung-Menü gehören –
// auch von denen, die außerhalb von /verwaltung liegen (Beschlüsse, Versammlungen,
// Zähler). Bewusst pro Route eingebunden statt global im Portal-Layout: so entstehen
// die Zähler-Abfragen nur dort, wo die Sidebar tatsächlich erscheint, und Seiten wie
// /dashboard oder /vorgaenge bleiben unverändert schnell.

// Zähler-Badges für die Sidebar, begrenzt auf den Zuständigkeitsbereich des Verwalters.
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

/**
 * Rendert die Kinder mit Verwaltungs-Sidebar – aber nur für professionelle Verwalter.
 *
 * Eigentümer und Mieter nutzen dieselben Routen (Beschlüsse, Versammlungen, Zähler);
 * für sie (und für selbstverwaltete WEGs) bleibt die Ansicht unverändert ohne Sidebar.
 * Die Zugriffsprüfung der jeweiligen Seite bleibt davon unberührt – hier wird nichts
 * erzwungen, nur die Hülle gewählt.
 */
export async function VerwaltungChrome({ children }: { children: ReactNode }) {
  const [session, org] = await Promise.all([getSession(), getOrganization()]);
  const user = session.user;

  if (!user || user.role !== "VERWALTER" || isSelfManaged(org)) {
    return <>{children}</>;
  }

  const hasWegObjekte =
    (await db.property.count({
      where: { ...(await propertyWhereForVerwalter(user)), managementType: "WEG" },
    })) > 0;

  const groups = verwaltungGroups({
    isSuperAdmin: Boolean(user.isSuperAdmin),
    hasWegObjekte,
  });

  // Promise NICHT awaiten: die Shell rendert sofort, die Zähler streamen nach.
  const badgesPromise = loadCounts(user);

  return (
    <VerwaltungShell groups={groups} badgesPromise={badgesPromise}>
      {children}
    </VerwaltungShell>
  );
}
