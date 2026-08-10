// First-Party-Tracking: Server-Seite. Salt-Verwaltung, Hashing und das
// Schreiben von TrackEvent-Zeilen — für den Endpoint /api/t und für die
// serverseitigen Funnel-Ereignisse (Registrierung, Checkout, Webhook).
//
// Eiserne Regel: Tracking darf NIE einen Geschäftsablauf brechen. Alle
// Funnel-Helfer fangen ihre Fehler selbst — eine gescheiterte Protokollzeile
// ist ein Loch in der Statistik, eine geplatzte Registrierung ein Schaden.

import { createHash, randomBytes } from "crypto";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { utcTag } from "@/lib/analytics/zeitraum";
import {
  type FunnelEventType,
  type PageviewPayload,
  bereinigeReferrer,
  geraetAusUserAgent,
  sessionFenster,
} from "@/lib/analytics/tracking";
import { getClientIp } from "@/lib/rate-limit";

// ── Tages-Salt ──────────────────────────────────────────────────────────────
// Erzeugt beim ersten Ereignis des Tages (lazy statt per Cron: so gibt es nie
// ein Fenster ohne Salt). Der Cleanup-Cron löscht die Zeilen vergangener Tage
// — erst diese Löschung macht die Wiedererkennung über den Tag hinaus
// technisch unmöglich, deshalb ist sie Teil der Datenschutz-Zusage und nicht
// bloß Aufräumen. Prozess-lokaler Cache, damit nicht jedes Ereignis liest.
let saltCache: { key: number; salt: string } | null = null;

export async function tagesSalt(now: Date = new Date()): Promise<string> {
  const day = utcTag(now);
  const key = day.getTime();
  if (saltCache?.key === key) return saltCache.salt;
  const zeile = await db.trackingSalt.upsert({
    where: { day },
    // Konflikt heißt: Eine parallele Anfrage war schneller — deren Salt gilt.
    update: {},
    create: { day, salt: randomBytes(32).toString("hex") },
    select: { salt: true },
  });
  saltCache = { key, salt: zeile.salt };
  return zeile.salt;
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Besucher-Kennung: SHA-256(IP + User-Agent + Tages-Salt). Die IP verlässt diese Funktion nicht. */
export function visitorHashFuer(ip: string, userAgent: string, salt: string): string {
  return sha256(`${ip}|${userAgent}|${salt}`);
}

/** Sitzungs-Kennung: Besucher-Hash + 30-Minuten-Fenster (siehe tracking.ts). */
export function sessionHashFuer(visitorHash: string, ts: Date): string {
  return sha256(`${visitorHash}|${sessionFenster(ts)}`);
}

// ── Pageview schreiben (vom Endpoint /api/t) ────────────────────────────────
export async function schreibePageview(args: {
  payload: PageviewPayload;
  ip: string;
  userAgent: string;
  /** Vercel-Geo-Header, z. B. "DE" — abgeleitet aus der IP, die IP selbst wird verworfen. */
  country: string | null;
  host: string | null;
}): Promise<void> {
  const now = new Date();
  const salt = await tagesSalt(now);
  const visitorHash = visitorHashFuer(args.ip, args.userAgent, salt);
  await db.trackEvent.create({
    data: {
      ts: now,
      visitorHash,
      sessionHash: sessionHashFuer(visitorHash, now),
      type: "pageview",
      path: args.payload.path,
      referrer: bereinigeReferrer(args.payload.referrer, args.host),
      utmSource: args.payload.utmSource,
      utmMedium: args.payload.utmMedium,
      utmCampaign: args.payload.utmCampaign,
      country: args.country,
      device: geraetAusUserAgent(args.userAgent),
      meta: args.payload.breite != null ? { breite: args.payload.breite } : undefined,
    },
  });
}

// ── Funnel-Ereignisse (serverseitig) ────────────────────────────────────────
/**
 * Funnel-Ereignis aus einem Request-Kontext (Server-Action): Besucher-Hash
 * aus IP + User-Agent des HANDELNDEN — dadurch verbindet sich das Ereignis
 * mit den Pageviews desselben Besuchers am selben Tag (Attribution, Phase 5).
 * Fängt alle Fehler; der Aufrufer merkt nichts.
 */
export async function trackFunnelEvent(
  type: FunnelEventType,
  args: { path: string; meta?: Record<string, string | number> } = { path: "/" },
): Promise<void> {
  try {
    const h = await headers();
    const ip = await getClientIp();
    const userAgent = h.get("user-agent")?.slice(0, 500) ?? "";
    const now = new Date();
    const salt = await tagesSalt(now);
    const visitorHash = visitorHashFuer(ip, userAgent, salt);
    await db.trackEvent.create({
      data: {
        ts: now,
        visitorHash,
        sessionHash: sessionHashFuer(visitorHash, now),
        type,
        path: args.path,
        country: h.get("x-vercel-ip-country"),
        device: userAgent ? geraetAusUserAgent(userAgent) : null,
        meta: args.meta,
      },
    });
  } catch (err) {
    console.error(`Tracking: Funnel-Ereignis ${type} nicht geschrieben`, err);
  }
}

/**
 * Funnel-Ereignis OHNE Request-Kontext des Nutzers (Stripe-Webhook: dort
 * telefoniert Stripe, nicht der Kunde). Die Kennung ist ein Pseudonym der
 * Organisation mit demselben Tages-Salt; die Organisations-Id wandert
 * zusätzlich in `meta`, damit Phase 5 Abo-Abschlüsse Kanälen zuordnen kann —
 * das ist ein Geschäftsereignis unserer Kundin, kein Besucher-Tracking.
 */
export async function trackFunnelEventFuerOrg(
  type: FunnelEventType,
  orgId: string,
  meta: Record<string, string | number> = {},
): Promise<void> {
  try {
    const now = new Date();
    const salt = await tagesSalt(now);
    const visitorHash = sha256(`org|${orgId}|${salt}`);
    await db.trackEvent.create({
      data: {
        ts: now,
        visitorHash,
        sessionHash: sessionHashFuer(visitorHash, now),
        type,
        path: "/",
        meta: { orgId, ...meta },
      },
    });
  } catch (err) {
    console.error(`Tracking: Funnel-Ereignis ${type} (Org) nicht geschrieben`, err);
  }
}
