// Datenschutz-Aufbewahrung: entfernt IP-Adressen aus alten Audit-Log-Einträgen
// (der Aktionssatz bleibt für die Rechenschaftspflicht erhalten) und räumt
// abgelaufene Rate-Limit-Zeilen auf. Wird täglich per Vercel-Cron aufgerufen
// (siehe src/app/api/cron/cleanup/route.ts + vercel.json).
import { db } from "./db";

// IP-Adressen im Audit-Log nach dieser Frist entfernen.
export const AUDIT_IP_RETENTION_DAYS = 90;

// Verarbeitete Stripe-Event-Ids nach dieser Frist entfernen. Stripe wiederholt
// Zustellungen höchstens wenige Tage — 30 Tage sind reichlich Puffer, danach
// dient die Zeile keinem Duplikatschutz mehr und wächst nur die Tabelle.
export const STRIPE_EVENT_RETENTION_DAYS = 30;

export async function runRetentionCleanup(now: Date = new Date()) {
  const ipCutoff = new Date(now.getTime() - AUDIT_IP_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  // 1) Audit-Log: IP nach 90 Tagen entfernen; die reine Aktions-Historie bleibt.
  const auditIp = await db.auditLog.updateMany({
    where: { createdAt: { lt: ipCutoff }, NOT: { ip: null } },
    data: { ip: null },
  });

  // 2) Abgelaufene Rate-Limit-Zeilen sicher entfernen (bisher nur ~1 % zufällig).
  const rateLimit = await db.rateLimit.deleteMany({ where: { expiresAt: { lt: now } } });

  // 3) Alte Stripe-Event-Ids (Idempotenz-Wand des Billing-Webhooks) entfernen.
  const stripeCutoff = new Date(
    now.getTime() - STRIPE_EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  );
  const stripeEvents = await db.stripeEvent.deleteMany({
    where: { createdAt: { lt: stripeCutoff } },
  });

  return {
    auditIpCleared: auditIp.count,
    rateLimitDeleted: rateLimit.count,
    stripeEventsDeleted: stripeEvents.count,
  };
}
