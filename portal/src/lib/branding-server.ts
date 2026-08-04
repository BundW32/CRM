// Server-seitiges Laden des Brandings einer Organisation. Bewusst getrennt von
// lib/branding.ts, damit dort KEIN db-Import landet (lib/branding.ts wird auch
// von Client-Komponenten importiert).
import { db } from "./db";
import { isWegSaas } from "./app-mode";
import {
  DEFAULT_BRANDING,
  WEG_SAAS_BRANDING,
  brandingFromOrg,
  type OrgBranding,
} from "./branding";

// Rückfall-Branding des laufenden Deployments. Liegt hier und nicht in
// lib/branding.ts, weil es die Server-Env APP_MODE liest – im Client-Bündel wäre
// sie undefiniert und die Marke stillschweigend falsch.
export function fallbackBranding(): OrgBranding {
  return isWegSaas() ? WEG_SAAS_BRANDING : DEFAULT_BRANDING;
}

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

// Lädt das Branding zu einer Organisations-ID. Ohne ID greift der Rückfall des
// jeweiligen Deployments (B&W bzw. wegportal24).
export async function getBrandingForOrg(
  organizationId: string | null | undefined
): Promise<OrgBranding> {
  if (!organizationId) return fallbackBranding();
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: BRANDING_SELECT,
  });
  return brandingFromOrg(org);
}
