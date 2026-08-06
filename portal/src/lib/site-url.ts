// ── Öffentliche Basis-Adresse dieses Deployments ─────────────────────────────
// Canonical-Tags, robots.txt und sitemap.xml brauchen absolute Adressen. Ohne
// eine gemeinsame Quelle stünde dieselbe Domain an vier Stellen fest verdrahtet
// im Code – und auf der B&W-Tür stünde dort die falsche.
//
// Reihenfolge: PORTAL_BASE_URL (je Vercel-Projekt gesetzt, dieselbe Variable,
// die schon die absoluten Links in E-Mails trägt) → Produktionsdomain des
// Vercel-Projekts → Rückfall auf wegportal24.de.

const RUECKFALL = "https://www.wegportal24.de";

function ohneEndSchraegstrich(wert: string): string {
  return wert.endsWith("/") ? wert.slice(0, -1) : wert;
}

export function siteUrl(): string {
  const gesetzt = process.env.PORTAL_BASE_URL?.trim();
  if (gesetzt) return ohneEndSchraegstrich(gesetzt);

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return "https://" + ohneEndSchraegstrich(vercel);

  return RUECKFALL;
}
