// Auflösung des Mandanten (Organisation) für UNAUTHENTIFIZIERTE Kontexte
// (Login, öffentliche Seiten) anhand der Subdomain. Der Proxy (src/proxy.ts)
// setzt dazu den Header `x-tenant-slug`; hier wird daraus die Org geladen.
//
// Für authentifizierte Seiten gilt weiterhin getOrganization() (Org des
// angemeldeten Nutzers) – die ist verbindlich und unabhängig von der Domain.
import { headers } from "next/headers";
import { cache } from "react";
import { db } from "./db";
import { brandingFromOrg, DEFAULT_BRANDING, type OrgBranding } from "./branding";

// Liest den vom Proxy gesetzten Mandanten-Slug (oder null im Single-Tenant-/
// Apex-Fall).
export async function getTenantSlug(): Promise<string | null> {
  const h = await headers();
  return h.get("x-tenant-slug");
}

// Lädt die Organisation zur aktuellen Subdomain (oder null). Pro Request gecacht.
export const getTenantOrg = cache(async () => {
  const slug = await getTenantSlug();
  if (!slug) return null;
  const org = await db.organization.findFirst({
    where: { slug, active: true },
  });
  return org;
});

// Branding für den aktuellen Mandanten der Subdomain. Fällt auf DEFAULT_BRANDING
// zurück, wenn keine Subdomain aufgelöst werden kann (Apex/Single-Tenant).
export async function getTenantBranding(): Promise<OrgBranding> {
  const org = await getTenantOrg();
  return org ? brandingFromOrg(org) : DEFAULT_BRANDING;
}
