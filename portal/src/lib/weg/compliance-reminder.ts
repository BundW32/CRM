// E-Mail-Erinnerung an fällige/überfällige Prüfpflichten. Reiner Beschleuniger:
// Ohne konfigurierten SMTP-Adapter (isMailEnabled === false) passiert nichts —
// die Fälligkeiten stehen ohnehin im Dashboard. Wird per Cron täglich angestoßen.
import { getBrandingForOrg } from "@/lib/branding-server";
import { db } from "@/lib/db";
import { formatDateOnly, maintenanceIntervalLabels } from "@/lib/labels";
import { isMailEnabled, portalUrl, sendMail } from "@/lib/mailer";
import { dueLabel, daysUntilDue } from "@/lib/weg/compliance";

// Erinnere an Pflichten, die innerhalb dieses Fensters fällig werden …
const REMIND_WITHIN_DAYS = 14;
// … und nicht innerhalb dieser Frist bereits erinnert wurden (Anti-Spam).
const REMIND_COOLDOWN_DAYS = 7;

export type ReminderResult = {
  mailEnabled: boolean;
  organizations: number;
  tasksReminded: number;
  mailsSent: number;
};

export async function runComplianceReminders(now: Date = new Date()): Promise<ReminderResult> {
  const result: ReminderResult = {
    mailEnabled: isMailEnabled(),
    organizations: 0,
    tasksReminded: 0,
    mailsSent: 0,
  };
  // Ohne Mail-Adapter: kein Versand (Fallback = Dashboard).
  if (!result.mailEnabled) return result;

  const horizon = new Date(now.getTime());
  horizon.setDate(horizon.getDate() + REMIND_WITHIN_DAYS);
  const cooldown = new Date(now.getTime());
  cooldown.setDate(cooldown.getDate() - REMIND_COOLDOWN_DAYS);

  const due = await db.maintenanceTask.findMany({
    where: {
      active: true,
      catalogKey: { not: null },
      dueDate: { lte: horizon },
      OR: [{ lastReminderAt: null }, { lastReminderAt: { lt: cooldown } }],
      property: { managementType: "WEG" },
    },
    orderBy: { dueDate: "asc" },
    include: { property: { select: { id: true, name: true } } },
  });
  if (due.length === 0) return result;

  // Nach Organisation gruppieren (eine Digest-Mail je Org an deren Verwalter).
  const byOrg = new Map<string, typeof due>();
  for (const t of due) {
    const list = byOrg.get(t.organizationId) ?? [];
    list.push(t);
    byOrg.set(t.organizationId, list);
  }

  for (const [orgId, tasks] of byOrg) {
    const verwalter = await db.user.findMany({
      where: { organizationId: orgId, role: "VERWALTER", active: true, email: { not: null } },
      select: { email: true, name: true },
    });
    if (verwalter.length === 0) continue;

    result.organizations += 1;
    const branding = await getBrandingForOrg(orgId);
    const lines = tasks.map((t) => {
      const days = daysUntilDue(t.dueDate, now);
      return `• ${t.title} (${maintenanceIntervalLabels[t.interval]}) — ${t.property?.name ?? ""}: fällig ${formatDateOnly(t.dueDate)}, ${dueLabel(days)}`;
    });
    const body = [
      "folgende Prüfpflichten Ihrer Gemeinschaft sind fällig oder werden bald fällig:",
      "",
      ...lines,
      "",
      `Details und „Erledigt"-Quittierung im Portal: ${portalUrl("/verwaltung/weg")}`,
    ].join("\n");

    for (const v of verwalter) {
      await sendMail(
        v.email,
        "Fällige Prüfpflichten Ihrer WEG",
        `Guten Tag ${v.name},\n\n${body}\n\nMit freundlichen Grüßen\n${branding.legalName}`,
        undefined,
        branding,
      ).catch(() => {});
      result.mailsSent += 1;
    }

    await db.maintenanceTask.updateMany({
      where: { id: { in: tasks.map((t) => t.id) } },
      data: { lastReminderAt: now },
    });
    result.tasksReminded += tasks.length;
  }

  return result;
}
