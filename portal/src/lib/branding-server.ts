// Server-seitiges Laden des Brandings einer Organisation. Bewusst getrennt von
// lib/branding.ts, damit dort KEIN db-Import landet (lib/branding.ts wird auch
// von Client-Komponenten importiert).
import { db } from "./db";
import { DEFAULT_BRANDING, brandingFromOrg, type OrgBranding } from "./branding";

const BRANDING_SELECT = {
  slug: true,
  name: true,
  legalName: true,
  email: true,
  phone: true,
  website: true,
  street: true,
  zip: true,
  city: true,
  primaryColor: true,
  logoStoredName: true,
} as const;

// Lädt das Branding zu einer Organisations-ID. Ohne ID greift DEFAULT_BRANDING.
export async function getBrandingForOrg(
  organizationId: string | null | undefined
): Promise<OrgBranding> {
  if (!organizationId) return DEFAULT_BRANDING;
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: BRANDING_SELECT,
  });
  return brandingFromOrg(org);
}
