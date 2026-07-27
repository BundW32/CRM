import { headers } from "next/headers";
import { db } from "@/lib/db";

export async function getClientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-real-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

// Gibt false zurück wenn das Limit überschritten ist (→ 429 / Redirect).
// Fail-open: DB-Fehler blockieren nie legitime Nutzer.
export async function checkRateLimit(
  key: string,
  max: number,
  windowSeconds: number
): Promise<boolean> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + windowSeconds * 1000);

  try {
    const existing = await db.rateLimit.findUnique({ where: { key } });

    if (!existing || existing.expiresAt < now) {
      // Abgelaufenes oder neues Fenster – zurücksetzen
      await db.rateLimit.upsert({
        where: { key },
        create: { key, count: 1, expiresAt },
        update: { count: 1, expiresAt },
      });
      // Probabilistisches Cleanup abgelaufener Einträge (≈1 % der Anfragen)
      if (Math.random() < 0.01) {
        db.rateLimit.deleteMany({ where: { expiresAt: { lt: now } } }).catch(() => {});
      }
      return true;
    }

    if (existing.count >= max) return false;

    await db.rateLimit.update({
      where: { key },
      data: { count: { increment: 1 } },
    });
    return true;
  } catch {
    return true;
  }
}

/**
 * Setzt einen Zähler zurück – nach einer *erfolgreichen* Anmeldung.
 *
 * Ohne das zählt die Sperre auch geglückte Versuche mit und sperrt am Ende
 * genau den aus, der sein Passwort kennt: Wer sich an einem Vormittag fünfmal
 * an- und abmeldet, säße vor „zu viele Versuche". Gezählt gehören Fehlversuche;
 * ein Erfolg ist der Beweis, dass hier niemand durchprobiert.
 *
 * Fail-open wie `checkRateLimit`: Ein DB-Fehler darf niemanden aussperren.
 */
export async function resetRateLimit(key: string): Promise<void> {
  try {
    await db.rateLimit.deleteMany({ where: { key } });
  } catch {
    // bewusst still
  }
}
