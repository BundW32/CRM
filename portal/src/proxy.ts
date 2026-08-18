import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

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

// ── Marketing-Seiten: Wächter hier, damit die Seiten statisch bleiben ───────
// Startseite, /funktionen/*, /so-funktionierts, /preise und /kontakt/* sind
// die öffentlichen Marken-Seiten. Die meisten davon werden als statische
// Seiten mit Hintergrund-Aktualisierung (ISR) ausgeliefert — das drückt die
// Antwortzeit von Serverless-Rendern (samt Kaltstart und DB-Zählabfrage der
// Willkommensaktion) auf CDN-Niveau. Statisch heißt aber: Die Seite selbst
// kann weder `headers()` noch `cookies()` lesen. Ihre drei Wächter (früher
// lib/marketing.ts) laufen deshalb HIER, wo Host, Cookies und `APP_MODE` zur
// Laufzeit vorliegen — und damit an EINER Stelle für alle diese Seiten,
// gleich ob statisch oder dynamisch (/kontakt bleibt wegen `searchParams`
// dynamisch):
//  1. APP_MODE=weg — in der B&W-Tür ist der Login der einzige öffentliche
//     Einstieg; die Landing würde dort auf eine gesperrte Registrierung zeigen.
//  2. Hauptdomain — auf Mandanten-Subdomains (White Label) bleibt der
//     gebrandete Login der Einstieg, sonst überschriebe wegportal24 die Marke
//     des Mandanten.
//  3. Nur Startseite: Angemeldete gehören ins Portal, nicht auf die Werbung.
//
// NICHT hierher gehören die Rechtsseiten (/impressum, /datenschutz, /agb,
// /avv, /ki-transparenz): Die müssen in beiden Türen erreichbar bleiben –
// /ki-transparenz insbesondere, weil Art. 50 EU-KI-VO auch für B&W gilt.
const MARKETING_PATHS = new Set(["/", "/so-funktionierts", "/preise", "/kontakt"]);

function isMarketingPath(pathname: string): boolean {
  return (
    MARKETING_PATHS.has(pathname) ||
    pathname.startsWith("/funktionen/") ||
    pathname.startsWith("/kontakt/")
  );
}

// Trägt der Request eine gültige Sitzung? Nur Signatur und Token-Typ — die
// volle Prüfung (Nutzer existiert, Sitzung nicht widerrufen) macht weiterhin
// `getSession()` auf der Zielseite: Wer hier mit einem widerrufenen Token
// durchrutscht, landet auf /dashboard und wird dort zum Login geschickt.
// Fehler (fehlendes SESSION_SECRET, kaputtes Token) heißen „nicht angemeldet"
// — ein Wächter, der die Startseite zu Fall bringt, wäre schlimmer als eine
// ausgelassene Weiterleitung.
async function hatSitzung(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get("bw_session")?.value;
  const secret = process.env.SESSION_SECRET;
  if (!token || !secret || secret.length < 32) return false;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    return payload.typ === "session" && typeof payload.sub === "string";
  } catch {
    return false;
  }
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

  if (isMarketingPath(request.nextUrl.pathname)) {
    // Wächter 1+2: falsche Tür oder Mandanten-Subdomain → gebrandeter Login.
    if (process.env.APP_MODE !== "weg" || slug) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    // Wächter 3: Angemeldete von der Startseite direkt ins Portal.
    if (request.nextUrl.pathname === "/" && (await hatSitzung(request))) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

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
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)",
    // Die beiden Icon-Pfade sind vom Muster oben ausgenommen (Dateiendung) und
    // müssen einzeln aufgeführt werden.
    "/favicon.ico",
    "/app-icon-192.png",
    "/apple-touch-icon.png",
  ],
};
