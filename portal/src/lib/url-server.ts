import { headers } from "next/headers";
import { portalUrl } from "./url";

// Absolute Portal-URL aus dem AKTUELLEN Request-Host. So zeigt ein Einladungs-/
// Reset-/Bestätigungslink immer auf die Domain, über die der Nutzer gerade
// arbeitet (z. B. portal.bundwimmobilien.de) – nicht auf die interne
// *.vercel.app-Deployment-URL. Funktioniert automatisch mit mehreren Domains
// (z. B. dem späteren WEG-Selbstverwaltungs-Zugang), für die ein einzelnes
// PORTAL_BASE_URL nicht gleichzeitig stimmen kann.
//
// SERVER-ONLY: nutzt next/headers und darf daher niemals in eine Client-
// Komponente importiert werden (deshalb getrennt von url.ts). Fällt auf
// portalUrl() zurück, wenn kein Request-Host ermittelbar ist (z. B. Cron-Mails).
export async function portalUrlFromRequest(path: string) {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    // Interne Vercel-Deployment-/Preview-Hosts (*.vercel.app) NIEMALS in Kunden-
    // Links übernehmen – auch dann nicht, wenn der Verwalter das Portal gerade
    // über eine solche URL testet. Für sie (und Kontexte ohne Request) greift die
    // konfigurierte PORTAL_BASE_URL. Echte (Kunden-)Domains haben Vorrang, damit
    // der Link auf die tatsächlich genutzte Domain zeigt (auch die spätere WEG-Domain).
    if (host && !host.endsWith(".vercel.app")) {
      const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
      return `${proto}://${host}${path}`;
    }
  } catch {
    // headers() außerhalb eines Request-Kontexts → Fallback unten.
  }
  return portalUrl(path);
}
