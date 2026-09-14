// Lädt, was `stimmverbot.ts` zum Entscheiden braucht.
//
// Getrennt von der Regelkunde aus demselben Grund wie bei den
// Zuordnungsvorschlägen: Die Regel bleibt ohne Datenbank prüfbar, und derselbe
// Kontext speist zwei Stellen — die Sperre in den Stimm-Aktionen und die
// Anzeige auf der Beschlüsse-Seite. Zwei getrennte Ladewege wären zwei
// Wahrheiten, und bei einer Sperre ist das die schlechteste Sorte Fehler:
// Die Oberfläche zeigte einen Eigentümer zur Auswahl, den der Server dann
// ablehnt.
import { db } from "@/lib/db";
import {
  erkenneThema,
  type Beteiligte,
  type BeschlussThema,
} from "./stimmverbot";

/**
 * Wer ist bei diesem Objekt Verwaltung — und zugleich Eigentümer?
 *
 * Genau dieser Schnitt ist gemeint. Ein externer Verwalter hält kein Eigentum
 * und hat ohnehin kein Stimmrecht; das Stimmverbot trifft den Fall, für den
 * dieses Portal gebaut ist: die Selbstverwaltung, in der ein Eigentümer das
 * Amt übernommen hat.
 *
 * „Verwaltung dieses Objekts" heißt: Nutzer mit der Rolle VERWALTER in der
 * Organisation des Objekts, die entweder Super-Admin sind (sehen alle Objekte)
 * oder diesem Objekt ausdrücklich zugewiesen (`PropertyAssignment`) — dieselbe
 * Grenze, die auch `propertyIdsForVerwalter` in `lib/access.ts` zieht.
 */
export async function ladeBeteiligte(propertyId: string): Promise<Beteiligte> {
  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: { organizationId: true },
  });
  if (!property) return { verwalterIds: [], beiratsIds: [] };

  const [verwalter, beirat] = await Promise.all([
    db.user.findMany({
      where: {
        organizationId: property.organizationId,
        role: "VERWALTER",
        active: true,
        // … und zugleich Eigentümer dieses Objekts. Ownership ODER
        // UnitOwnership: In der Praxis ist mal das eine, mal das andere
        // gepflegt, und wer nur eine Hälfte abfragt, übersieht die andere.
        OR: [
          { ownerships: { some: { propertyId } } },
          { unitOwnerships: { some: { unit: { propertyId } } } },
        ],
        // Zuständig für dieses Objekt.
        AND: [
          {
            OR: [{ isSuperAdmin: true }, { propertyAssignments: { some: { propertyId } } }],
          },
        ],
      },
      select: { id: true },
    }),
    db.ownership.findMany({
      where: { propertyId, isBoardMember: true },
      select: { userId: true },
    }),
  ]);

  return {
    verwalterIds: verwalter.map((v) => v.id),
    beiratsIds: beirat.map((b) => b.userId),
  };
}

/**
 * Das Thema eines Beschlusses — über seinen Tagesordnungspunkt, sonst über den
 * eigenen Titel.
 *
 * Ein Umlaufbeschluss hat keinen TOP; auch er kann aber eine Entlastung
 * betreffen, und dann gilt dasselbe Stimmverbot. Der Titel ist dort die einzige
 * Quelle.
 */
export async function ladeThema(resolutionId: string): Promise<BeschlussThema> {
  const resolution = await db.resolution.findUnique({
    where: { id: resolutionId },
    select: {
      title: true,
      agendaItems: { select: { templateKey: true, title: true }, take: 1 },
    },
  });
  if (!resolution) return null;
  const top = resolution.agendaItems[0];
  return erkenneThema({
    templateKey: top?.templateKey ?? null,
    title: top?.title ?? resolution.title,
  });
}
