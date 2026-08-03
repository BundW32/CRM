// Wächter der öffentlichen Marketing-Seiten (Startseite, /funktionen/*,
// /so-funktionierts). Sie werben für die Self-Service-Registrierung und tragen
// die Marke wegportal.24 – beides gibt es nur in der WEG-SaaS.
//
// Zwei Bedingungen müssen zusammen erfüllt sein:
//  1. APP_MODE=weg – in der B&W-Tür (portal.bundwimmobilien.de) ist der Login
//     der einzige öffentliche Einstieg; eine Landing mit „Kostenlos starten"
//     würde dort auf eine gesperrte Registrierung zeigen.
//  2. Hauptdomain – auf Mandanten-Subdomains (White Label) bleibt der
//     gebrandete Login der Einstieg, sonst überschriebe wegportal.24 die Marke
//     des Mandanten.
//
// NICHT hierher gehören die Rechtsseiten (/impressum, /datenschutz, /agb,
// /avv, /ki-transparenz): Die müssen in beiden Türen erreichbar bleiben –
// /ki-transparenz insbesondere, weil Art. 50 EU-KI-VO auch für B&W gilt. Sie
// laufen über `LegalPage` und holen sich ihr Logo modusabhängig.
import { redirect } from "next/navigation";
import { isWegSaas } from "./app-mode";
import { getTenantOrg } from "./tenant";

export async function assertMainDomain() {
  if (!isWegSaas()) redirect("/login");
  if (await getTenantOrg()) redirect("/login");
}
