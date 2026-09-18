import { SignJWT, jwtVerify } from "jose";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_TYP,
  istInaktiv,
  latVeraltet,
  sessionCookieAttribute,
} from "@/lib/session-inaktiv";

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

// Icons je Deployment. Browser fragen `/favicon.ico` von sich aus ab, ohne die
// Angaben im <head> zu beachten, und der Service Worker (`public/sw.js`) ist
// eine statische Datei ohne Zugriff auf `APP_MODE`. Beide bekommen deshalb hier
// die passende Datei untergeschoben.
//
// Bewusst hier und nicht als `rewrites()` in `next.config.ts`: Jene werden zur
// **Bauzeit** festgeschrieben. Alles andere im Programm — Titel, Logo,
// Manifest — liest `APP_MODE` zur Laufzeit; eine Weiche, die als Einzige am
// Build hängt, läuft früher oder später auseinander.
const ICONS: Record<string, { weg: string; verwaltung: string }> = {
  "/favicon.ico": { weg: "/favicon-wegportal24.ico", verwaltung: "/favicon-bw.ico" },
  "/app-icon-192.png": { weg: "/icon-wegportal24-192.png", verwaltung: "/icon-192.png" },
  // iOS, einige Android-Browser und Suchmaschinen fragen diesen Pfad direkt
  // ab, ohne die Angaben im <head> zu lesen — ohne Weiche stand auf
  // wegportal24.de das B&W-Signet auf dem Homescreen und in Suchergebnissen.
  "/apple-touch-icon.png": {
    weg: "/apple-touch-icon-wegportal24.png",
    verwaltung: "/apple-touch-icon.png",
  },
};

// ── Inaktivitäts-Timeout der Anmeldung ───────────────────────────────────────
// Das Sitzungs-Token trägt `idle` (Minuten, 0 = aus) und `lat` (letzte
// Aktivität, Unix-Sekunden); die Regel steht in `lib/session-inaktiv.ts` und
// gilt hier und in `getSession` gleichermaßen. Der Proxy ist die einzige
// Stelle, die bei einer gewöhnlichen Seitenanfrage einen Cookie setzen kann —
// Server-Komponenten dürfen das nicht. Deshalb schreibt er `lat` fort und
// beendet die Sitzung, sobald sie zu lange still war. `iat` und `exp` bleiben
// beim Fortschreiben stehen: Die Sieben-Tage-Obergrenze und der Widerruf über
// `sessionsValidFrom` rechnen mit dem Ausstellungszeitpunkt der Anmeldung.
//
// Ohne `SESSION_SECRET` oder bei einem ungültigen Token tut der Proxy nichts —
// die Sitzung verwirft dann `getSession`, wie bisher.
type Sitzung = {
  sub: string;
  idle: number | null;
  lat: number | null;
  iat: number;
  exp: number;
};

function secret(): Uint8Array | null {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) return null;
  return new TextEncoder().encode(value);
}

async function leseSitzung(token: string | undefined, key: Uint8Array): Promise<Sitzung | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key);
    if (typeof payload.sub !== "string" || payload.typ !== SESSION_TYP) return null;
    if (typeof payload.iat !== "number" || typeof payload.exp !== "number") return null;
    return {
      sub: payload.sub,
      idle: typeof payload.idle === "number" ? payload.idle : null,
      lat: typeof payload.lat === "number" ? payload.lat : null,
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

/** Dasselbe Token mit neuem `lat`; Ausstellung und Ablauf bleiben. */
function erneuereToken(sitzung: Sitzung, nowSekunden: number, key: Uint8Array): Promise<string> {
  return new SignJWT({ sub: sitzung.sub, typ: SESSION_TYP, idle: sitzung.idle ?? 0, lat: nowSekunden })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(sitzung.iat)
    .setExpirationTime(sitzung.exp)
    .sign(key);
}

// Vorab-Ladungen des Routers (Links im Sichtfeld) sind keine Handlung der
// Person — sie halten die Sitzung nicht wach.
function istPrefetch(request: NextRequest): boolean {
  return (
    request.headers.get("next-router-prefetch") === "1" ||
    request.headers.get("purpose") === "prefetch" ||
    request.headers.get("sec-purpose")?.includes("prefetch") === true
  );
}

export async function proxy(request: NextRequest) {
  const icon = ICONS[request.nextUrl.pathname];
  if (icon) {
    const ziel = process.env.APP_MODE === "weg" ? icon.weg : icon.verwaltung;
    // Zeigt die Weiche auf denselben Pfad (B&W-Datei unter ihrem Originalnamen),
    // braucht es kein Rewrite — die statische Datei wird direkt ausgeliefert.
    if (ziel === request.nextUrl.pathname) return NextResponse.next();
    return NextResponse.rewrite(new URL(ziel, request.url));
  }

  const slug = tenantSlugFromHost(request.headers.get("host"));

  const requestHeaders = new Headers(request.headers);
  if (slug) {
    requestHeaders.set("x-tenant-slug", slug);
  } else {
    // Verhindert, dass ein von außen gesetzter Header durchrutscht.
    requestHeaders.delete("x-tenant-slug");
  }

  const key = secret();
  const sitzung = key ? await leseSitzung(request.cookies.get(SESSION_COOKIE)?.value, key) : null;
  const now = Date.now();

  if (key && sitzung && istInaktiv(sitzung.lat, sitzung.idle, now)) {
    // Abgelaufen: Cookie weg, und bei einem Seitenaufruf zur Anmeldung mit
    // dem Grund. Auf der Anmeldeseite selbst und bei Server-Actions (POST)
    // nur der Cookie — dort meldet `requireUser` den Grund auf demselben Weg.
    const seitenaufruf = request.method === "GET" && !request.nextUrl.pathname.startsWith("/login");
    const response = seitenaufruf
      ? NextResponse.redirect(new URL("/login?grund=inaktiv", request.url))
      : NextResponse.next({ request: { headers: requestHeaders } });
    response.cookies.delete(SESSION_COOKIE);
    return response;
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (key && sitzung && sitzung.idle && !istPrefetch(request) && latVeraltet(sitzung.lat, now)) {
    // Nicht bei jedem Klick ein neuer Cookie — erst, wenn `lat` eine Minute
    // alt ist. Der Cookie läuft mit dem Token ab, nicht sieben Tage ab jetzt.
    const nowSekunden = Math.floor(now / 1000);
    const token = await erneuereToken(sitzung, nowSekunden, key);
    response.cookies.set(SESSION_COOKIE, token, sessionCookieAttribute(Math.max(sitzung.exp - nowSekunden, 0)));
  }
  return response;
}

export const config = {
  // Auf allen Seiten-Routen laufen; statische Assets/API ausnehmen.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)",
    // Die beiden Icon-Pfade sind vom Muster oben ausgenommen (Dateiendung) und
    // müssen einzeln aufgeführt werden.
    "/favicon.ico",
    "/app-icon-192.png",
    "/apple-touch-icon.png",
  ],
};
