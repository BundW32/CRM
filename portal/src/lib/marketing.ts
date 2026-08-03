// Die öffentlichen Marketing-Seiten gehören allein zur WEG-SaaS-Variante
// (APP_MODE=weg) und dort nur auf die Hauptdomain. In der Verwaltungs-Variante
// und auf Mandanten-Subdomains (White-Label) bleibt der gebrandete Login der
// einzige öffentliche Einstieg – dorthin wird umgeleitet.
//
// Ein Wächter für alle Unterseiten, damit das Gating nicht auf fünf Seiten
// getrennt gepflegt werden muss; `src/app/page.tsx` prüft dasselbe inline,
// weil es davor noch den eingeloggten Nutzer ins Portal schickt.
import { redirect } from "next/navigation";
import { getTenantOrg } from "./tenant";
import { isWegSaas } from "./app-mode";

export async function assertMainDomain() {
  if (!isWegSaas()) redirect("/login");
  if (await getTenantOrg()) redirect("/login");
}
