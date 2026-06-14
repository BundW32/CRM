// Web-Push-Versand. Ohne VAPID-Schlüssel deaktiviert (wie der E-Mail-Versand
// ohne SMTP). Fehler blockieren nie eine Nutzeraktion.
import webpush from "web-push";
import { db } from "./db";

type PushPayload = { title: string; body: string; url?: string };

function configured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let initialized = false;
function init() {
  if (initialized) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:info@bundwimmobilien.de",
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  initialized = true;
}

export async function sendPushToUsers(userIds: string[], payload: PushPayload) {
  if (!configured() || userIds.length === 0) return;
  init();

  const subs = await db.pushSubscription.findMany({
    where: { userId: { in: userIds } },
  });
  if (subs.length === 0) return;

  const data = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/dashboard",
  });

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          data
        );
      } catch (error) {
        const code = (error as { statusCode?: number }).statusCode;
        // Abgelaufene/ungültige Abos entfernen
        if (code === 404 || code === 410) {
          await db.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        }
      }
    })
  );
}

export async function sendPush(userId: string, payload: PushPayload) {
  await sendPushToUsers([userId], payload);
}
