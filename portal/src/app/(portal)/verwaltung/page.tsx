import { redirect } from "next/navigation";
import { isSelfManaged } from "@/lib/access";
import { getOrganization, requireVerwalter } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Der frühere Kachel-Hub ist entfallen – seine Punkte stehen jetzt vollständig in
 * der linken Navigationsleiste. Die Route bleibt als Weiterleitung bestehen, damit
 * ältere Links (Dashboard-Schnellzugriff, Wohnungsübergabe, Lesezeichen) und die
 * Rücksprünge der Einzelseiten weiterhin irgendwo sinnvoll landen.
 */
export default async function VerwaltungPage() {
  await requireVerwalter();
  const org = await getOrganization();
  redirect(isSelfManaged(org) ? "/verwaltung/weg" : "/verwaltung/objekte");
}
