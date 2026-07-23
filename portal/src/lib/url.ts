import { headers } from "next/headers";

// Absolute Portal-URL aus einer FESTEN Basis (PORTAL_BASE_URL). Für Kontexte
// OHNE eingehenden Request (Cronjobs, Hintergrund-Mails) – dort gibt es keinen
// Host, aus dem sich die Domain ableiten ließe.
export function portalUrl(path: string) {
  const base = process.env.PORTAL_BASE_URL ?? "http://localhost:3000";
  return base.replace(/\/$/, "") + path;
}

// Absolute Portal-URL aus dem AKTUELLEN Request-Host. So zeigt ein Einladungs-/
// Reset-/Bestätigungslink immer auf die Domain, über die der Nutzer gerade
// arbeitet (z. B. portal.bundwimmobilien.de) – nicht auf die interne
// *.vercel.app-Deployment-URL. Funktioniert automatisch mit mehreren Domains
// (z. B. dem späteren WEG-Selbstverwaltungs-Zugang), für die ein einzelnes
// PORTAL_BASE_URL nicht gleichzeitig stimmen kann. Fällt auf portalUrl() zurück,
// wenn kein Request-Host ermittelbar ist.
export async function portalUrlFromRequest(path: string) {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) {
      const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
      return `${proto}://${host}${path}`;
    }
  } catch {
    // headers() außerhalb eines Request-Kontexts → Fallback unten.
  }
  return portalUrl(path);
}
