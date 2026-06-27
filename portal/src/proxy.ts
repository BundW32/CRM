import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Tenant-/Mandanten-Auflösung pro Subdomain (White-Label, Phase 4.4).
// Der Proxy bleibt bewusst DB-frei: er ermittelt nur den Mandanten-Slug aus
// dem Hostnamen und reicht ihn als Request-Header `x-tenant-slug` weiter. Die
// eigentliche Org-Auflösung passiert in den Server-Komponenten (lib/tenant.ts).
//
// Voraussetzung für den Produktiveinsatz: Wildcard-DNS + Vercel-Domain
// (*.<TENANT_BASE_DOMAIN>) müssen konfiguriert sein. Ohne TENANT_BASE_DOMAIN
// ist die Subdomain-Auflösung deaktiviert (Single-Tenant-Betrieb).

// Hostnamen, die nie ein Mandant sind (Apex, www, lokale/Preview-Domains).
const RESERVED_SUBDOMAINS = new Set(["www", "app", "portal", "admin", "api"]);

function tenantSlugFromHost(host: string | null): string | null {
  if (!host) return null;
  const hostname = host.split(":")[0].toLowerCase().trim();
  if (!hostname || hostname === "localhost" || /^\d+(\.\d+){3}$/.test(hostname)) {
    return null;
  }

  const baseDomain = (process.env.TENANT_BASE_DOMAIN ?? "").toLowerCase().trim();
  if (!baseDomain) return null;

  // Nur Subdomains der konfigurierten Basis-Domain sind Mandanten-Slugs.
  const suffix = `.${baseDomain}`;
  if (!hostname.endsWith(suffix)) return null;

  const sub = hostname.slice(0, -suffix.length);
  // Genau eine Ebene tief (kein "a.b.basis.de"); reservierte Namen ignorieren.
  if (!sub || sub.includes(".") || RESERVED_SUBDOMAINS.has(sub)) return null;
  return sub;
}

export function proxy(request: NextRequest) {
  const slug = tenantSlugFromHost(request.headers.get("host"));

  const requestHeaders = new Headers(request.headers);
  if (slug) {
    requestHeaders.set("x-tenant-slug", slug);
  } else {
    // Verhindert, dass ein von außen gesetzter Header durchrutscht.
    requestHeaders.delete("x-tenant-slug");
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  // Auf allen Seiten-Routen laufen; statische Assets/API ausnehmen.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)"],
};
