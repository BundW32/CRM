// Benachrichtigungswege des Billings — vom Webhook UND vom täglichen Abgleich
// (api/cron/billing-abgleich) genutzt. Zwei Kopien dieser Helfer liefen
// auseinander; deshalb liegen sie hier und nicht in den Routen.
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import { parseAdminAllowlist } from "@/lib/platform-admin";

// DIE Alarm-Adresse des Betreibers — BILLING_ALERT_EMAIL, ersatzweise die
// erste Betreiber-Adresse. Auch die Fehler-Alarmierung (lib/fehler-alarm.ts)
// nutzt sie: Es gibt genau eine Adresse, auf der Alarme ankommen, nicht je
// Alarmweg eine eigene Env-Variable, die dann halb gepflegt ist.
export function betreiberAlarmAdresse(): string | undefined {
  return (
    process.env.BILLING_ALERT_EMAIL ||
    parseAdminAllowlist(process.env.PLATFORM_ADMIN_EMAILS)[0]
  );
}

// Alarm an den Betreiber. Billing-Fehler sind STILLE Umsatz-/Zugriffsfehler:
// Kein Kunde meldet sie, sie fallen erst beim Zahlenabgleich auf. Deshalb geht
// jeder Verarbeitungsfehler und jede Drift per Mail raus.
export async function alertBetreiber(subject: string, text: string): Promise<void> {
  const to = betreiberAlarmAdresse();
  if (!to) return;
  try {
    await sendMail(to, `[Billing-Alarm] ${subject}`, text);
  } catch {
    // Der Alarmweg darf den Hauptfluss nicht unterbrechen.
  }
}

// Mail an die SuperAdmins der Organisation — die einzigen, die am Abo etwas
// ändern können.
export async function mailOrgSuperAdmins(
  organizationId: string,
  subject: string,
  text: string,
): Promise<void> {
  const admins = await db.user.findMany({
    where: {
      organizationId,
      role: "VERWALTER",
      isSuperAdmin: true,
      active: true,
      email: { not: null },
    },
    select: { email: true },
  });
  await Promise.all(admins.map((a) => sendMail(a.email, subject, text)));
}
