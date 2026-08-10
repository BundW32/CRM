// First-Party-Tracking: die puren Teile (ohne DB und ohne Request-Kontext),
// damit Bot-Erkennung, Geräte-Ableitung, Referrer-Bereinigung und die
// Payload-Prüfung unit-testbar bleiben. Alles mit Datenbank oder headers()
// liegt in tracking-server.ts.
//
// Datenschutz-Grundsätze (verbindlich, siehe auch TrackEvent im Schema):
// keine Cookies, kein localStorage, IP wird NIE gespeichert — sie geht nur in
// den täglich rotierenden visitorHash und in die Ableitung des Landes ein und
// wird danach verworfen.

import { z } from "zod";

// ── Ereignistypen ────────────────────────────────────────────────────────────
// Der Client (/api/t) darf NUR Pageviews melden. Die Funnel-Ereignisse
// entstehen serverseitig an den Stellen, an denen sie fachlich passieren
// (Registrierung, Checkout, Stripe-Webhook) — ein Client, der „subscribed"
// schicken könnte, wäre eine offene Tür für erfundene Conversion-Zahlen.
export const CLIENT_EVENT_TYPES = ["pageview"] as const;
export const FUNNEL_EVENT_TYPES = [
  "signup_start",
  "signup_done",
  "checkout_start",
  "subscribed",
  "canceled",
] as const;
export type FunnelEventType = (typeof FUNNEL_EVENT_TYPES)[number];

// ── Bot-Erkennung ────────────────────────────────────────────────────────────
// Absichtlich eine Liste gängiger Marker statt einer gepflegten Datenbank:
// Sie fängt Crawler, Vorschau-Dienste und Headless-Browser — wer seinen
// User-Agent fälscht, ist mit keiner UA-Liste der Welt zu fangen.
const BOT_RE =
  /bot|crawl|spider|slurp|preview|scan|monitor|fetch|curl|wget|python-requests|headless|lighthouse|pingdom|uptime|facebookexternalhit|whatsapp|telegram|skype|vkshare|semrush|ahrefs|dataprovider/i;

export function istBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true; // ohne User-Agent kein Browser
  return BOT_RE.test(userAgent);
}

// ── Geräte-Ableitung ────────────────────────────────────────────────────────
export type Geraet = "mobil" | "tablet" | "desktop";

export function geraetAusUserAgent(userAgent: string): Geraet {
  if (/iPad|Tablet|Silk/i.test(userAgent)) return "tablet";
  // Android-Tablets tragen "Android" OHNE "Mobile" — Android-Telefone mit.
  if (/Android(?!.*Mobile)/i.test(userAgent)) return "tablet";
  if (/Mobi|Android|iPhone|iPod/i.test(userAgent)) return "mobil";
  return "desktop";
}

// ── Referrer-Bereinigung ────────────────────────────────────────────────────
/**
 * Behalten wird nur Host + Pfad OHNE Query — Query-Strings fremder Seiten
 * können Such- und Personendaten tragen, die hier nichts verloren haben.
 * Interne Verweise (gleicher Host) werden zu null: Der Weg DURCH die eigene
 * Seite steht schon in den Pageviews selbst.
 */
export function bereinigeReferrer(
  referrer: string | null | undefined,
  eigenerHost: string | null,
): string | null {
  if (!referrer) return null;
  try {
    const url = new URL(referrer);
    if (!/^https?:$/.test(url.protocol)) return null;
    if (eigenerHost && url.host.toLowerCase() === eigenerHost.toLowerCase()) return null;
    const pfad = url.pathname === "/" ? "" : url.pathname;
    return `${url.host}${pfad}`.slice(0, 300);
  } catch {
    return null;
  }
}

// ── Payload des Client-Snippets ─────────────────────────────────────────────
// Kurze Feldnamen, damit das Snippet klein bleibt: t=Typ, p=Pfad, r=Referrer,
// w=Bildschirmbreite, us/um/uc=UTM. Alles Unbekannte oder Übergroße wird
// verworfen — der Endpoint ist öffentlich und bekommt, was immer jemand schickt.
const utm = z
  .string()
  .trim()
  .max(120)
  .transform((s) => s.replace(/[\u0000-\u001F\u007F]/g, ""))
  .nullish();

const pageviewSchema = z.object({
  t: z.literal("pageview"),
  p: z
    .string()
    .startsWith("/")
    .max(300)
    .transform((s) => s.replace(/[\u0000-\u001F\u007F]/g, "")),
  r: z.string().max(2000).nullish(),
  w: z.number().int().min(0).max(20000).nullish(),
  us: utm,
  um: utm,
  uc: utm,
});

export type PageviewPayload = {
  path: string;
  referrer: string | null;
  breite: number | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
};

/** Rohtext (sendBeacon liefert text/plain) → geprüfte Nutzlast oder null. */
export function parsePageview(rawBody: string): PageviewPayload | null {
  if (rawBody.length > 4096) return null;
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return null;
  }
  const parsed = pageviewSchema.safeParse(json);
  if (!parsed.success) return null;
  const d = parsed.data;
  return {
    path: d.p,
    referrer: d.r ?? null,
    breite: d.w ?? null,
    utmSource: d.us || null,
    utmMedium: d.um || null,
    utmCampaign: d.uc || null,
  };
}

// ── Sitzungsfenster ─────────────────────────────────────────────────────────
/**
 * Sitzungs-Zuordnung ohne Cookie und ohne Zustand: Der sessionHash hängt am
 * 30-Minuten-Fenster des Zeitstempels. Eine Sitzung, die über die
 * Fenstergrenze läuft, zählt dadurch doppelt — der Preis dafür, dass weder
 * ein Cookie gesetzt noch je Ereignis in der DB nachgeschlagen wird. Für die
 * Leitfragen des Dashboards (Besucher, Funnel) zählt ohnehin der Tages-Hash.
 */
export const SESSION_FENSTER_MINUTEN = 30;

export function sessionFenster(ts: Date): number {
  return Math.floor(ts.getTime() / (SESSION_FENSTER_MINUTEN * 60_000));
}
