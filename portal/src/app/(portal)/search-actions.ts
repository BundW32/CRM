"use server";

import { requireUser } from "@/lib/session";
import type { SearchHit } from "@/lib/portal-search";
import { searchPortal } from "@/lib/portal-search-server";

/**
 * Datensuche der ⌘K-Palette.
 *
 * Liegt auf Ebene des Portal-Layouts, weil die Palette zu jeder Portalseite
 * gehört und nicht zu einer einzelnen Route.
 *
 * `requireUser` statt `requireVerwalter`: Die Palette bekommt jede Rolle (für
 * die Sprungliste), nur liefert `searchPortal` für Nicht-Verwalter nichts
 * zurück. So braucht die Aktion keinen eigenen Rollen-Zweig – die Grenze liegt
 * an einer Stelle.
 */
export async function searchPortalData(query: string): Promise<SearchHit[]> {
  const user = await requireUser();
  return searchPortal(user, query);
}
