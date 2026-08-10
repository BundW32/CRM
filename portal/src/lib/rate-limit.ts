import { headers } from "next/headers";
import { db } from "@/lib/db";

// IP-Quelle an die Plattform gebunden (P1-9): Auf Vercel setzt die Plattform
// `x-real-ip` selbst und überschreibt dabei, was ein Client mitschickt — dieser
// Header ist dort verlässlich. Der Rückfall auf `x-forwarded-for` gilt nur
// AUSSERHALB der Plattform (lokal, Selbst-Hosting hinter eigenem Proxy): Dort
// ist der erste Eintrag frei setzbar, und ein Angreifer würde sich mit jedem
// Request eine frische „IP" geben — jedes IP-Rate-Limit liefe ins Leere.
export async function getClientIp(): Promise<string> {
  const h = await headers();
  if (process.env.VERCEL) {
    return h.get("x-real-ip") ?? "unknown";
  }
  return (
    h.get("x-real-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

/**
 * Zählt einen Versuch und meldet, ob er noch im Limit liegt.
 * Gibt false zurück, wenn das Limit überschritten ist (→ 429 / Redirect).
 *
 * Atomar in EINEM Statement (INSERT … ON CONFLICT … RETURNING): Die frühere
 * Fassung las den Zähler, prüfte ihn und schrieb dann — unter parallelen
 * Requests verloren sich dabei Erhöhungen, und genau ein Angreifer erzeugt
 * parallele Requests. Ein abgelaufenes Fenster wird im selben Statement auf 1
 * zurückgesetzt.
 *
 * Fehlerverhalten ist wählbar:
 * - Standard fail-open: Ein DB-Fehler blockiert nie legitime Nutzer
 *   (Registrierung, Inbound-Mail, Versand-Limits).
 * - `failClosed` für die Anmeldung: Wenn die Zählung nicht funktioniert, wird
 *   NICHT unbegrenzt weiterprobiert. Aussperren kann das niemanden zusätzlich —
 *   ohne Datenbank scheitert auch die Passwortprüfung selbst.
 */
export async function checkRateLimit(
  key: string,
  max: number,
  windowSeconds: number,
  opts: { failClosed?: boolean } = {}
): Promise<boolean> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + windowSeconds * 1000);

  try {
    const rows = await db.$queryRaw<{ count: number }[]>`
      INSERT INTO "RateLimit" ("key", "count", "expiresAt")
      VALUES (${key}, 1, ${expiresAt})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN "RateLimit"."expiresAt" < ${now} THEN 1
          ELSE "RateLimit"."count" + 1
        END,
        "expiresAt" = CASE
          WHEN "RateLimit"."expiresAt" < ${now} THEN ${expiresAt}
          ELSE "RateLimit"."expiresAt"
        END
      RETURNING "count"
    `;

    // Probabilistisches Cleanup abgelaufener Einträge (≈1 % der Anfragen);
    // die tägliche Aufräumroutine (lib/retention.ts) räumt den Rest.
    if (Math.random() < 0.01) {
      db.rateLimit.deleteMany({ where: { expiresAt: { lt: now } } }).catch(() => {});
    }

    return (rows[0]?.count ?? 1) <= max;
  } catch {
    return !opts.failClosed;
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
 * Fail-open: Ein DB-Fehler darf niemanden aussperren.
 */
export async function resetRateLimit(key: string): Promise<void> {
  try {
    await db.rateLimit.deleteMany({ where: { key } });
  } catch {
    // bewusst still
  }
}
