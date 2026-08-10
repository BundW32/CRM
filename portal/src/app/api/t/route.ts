import { headers } from "next/headers";
import { parsePageview, istBot } from "@/lib/analytics/tracking";
import { schreibePageview } from "@/lib/analytics/tracking-server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// First-Party-Tracking-Endpoint (sendBeacon-kompatibel: nimmt text/plain).
//
// Bewusst NICHT Edge-Runtime, obwohl der ursprüngliche Plan das vorsah: Die
// Datenbank hängt über Prisma + node-postgres an einer TCP-Verbindung, die es
// im Edge-Runtime nicht gibt — ein zweiter Datenpfad nur für diesen Endpoint
// wäre genau die Doppelstruktur, die das Projekt sonst überall vermeidet.
//
// Antwort ist IMMER 204 ohne Inhalt — auch bei verworfenen Ereignissen (Bot,
// Limit, kaputte Nutzlast). Ein Tracking-Endpoint, der Fehler unterscheidbar
// beantwortet, ist ein Orakel dafür, wie man ihn umgeht; und dem Snippet im
// Browser ist die Antwort ohnehin gleichgültig.
const NO_CONTENT = () => new Response(null, { status: 204 });

export async function POST(request: Request) {
  try {
    const h = await headers();
    const userAgent = h.get("user-agent")?.slice(0, 500) ?? "";
    if (istBot(userAgent)) return NO_CONTENT();

    const payload = parsePageview(await request.text());
    if (!payload) return NO_CONTENT();

    // Rate-Limit je IP (120 Ereignisse/Minute): großzügig genug für schnelles
    // Klicken durch die Seite, eng genug gegen Fluten. Der Schlüssel trägt die
    // IP nur flüchtig — die RateLimit-Zeile verfällt nach 60 Sekunden und wird
    // vom Cleanup gelöscht, gespeichert wird sie nie im TrackEvent.
    const ip = await getClientIp();
    if (!(await checkRateLimit(`track:${ip}`, 120, 60))) return NO_CONTENT();

    await schreibePageview({
      payload,
      ip,
      userAgent,
      country: h.get("x-vercel-ip-country"),
      host: h.get("host"),
    });
  } catch (err) {
    // Tracking bricht nichts und meldet nichts — Fehler nur ins Log.
    console.error("Tracking: Pageview nicht geschrieben", err);
  }
  return NO_CONTENT();
}
