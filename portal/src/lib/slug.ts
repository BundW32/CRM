// Reservierte Subdomains/Slugs – müssen mit RESERVED_SUBDOMAINS in src/proxy.ts
// konsistent bleiben. Diese Slugs dürfen von keinem Mandanten belegt werden
// (weder bei der Registrierung noch beim Branding-Slug-Wechsel).
export const RESERVED_SLUGS = new Set(["www", "app", "portal", "admin", "api"]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}
