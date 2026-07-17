// Öffentliche Marketing-Seiten gehören nur auf die Hauptdomain. Auf
// Mandanten-Subdomains (White-Label) bleibt der gebrandete Login der einzige
// öffentliche Einstieg – dorthin wird umgeleitet.
import { redirect } from "next/navigation";
import { getTenantOrg } from "./tenant";

export async function assertMainDomain() {
  if (await getTenantOrg()) redirect("/login");
}
