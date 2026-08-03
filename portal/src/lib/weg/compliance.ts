// Reine Hilfslogik zur Einordnung der Fälligkeit einer Prüf-/Wartungspflicht.
// Wird sowohl im Dashboard als auch auf der Prüfpflichten-Seite verwendet, damit
// „überfällig / bald fällig / im Plan" überall gleich klassifiziert wird.
import { maintenanceIntervalMonths } from "@/lib/labels";

const DAY_MS = 1000 * 60 * 60 * 24;

export type DueStatus = "overdue" | "soon" | "ok";

// Anzahl Monate bis zur nächsten Fälligkeit je Intervall (null = einmalig).
// Einzige Quelle ist der Katalog in `labels.ts`.
export { maintenanceIntervalMonths as MAINTENANCE_INTERVAL_MONTHS };

// Verschiebt ein Datum um `months` Monate (mit Überlauf-Korrektur des Tages,
// damit z. B. der 31. nicht in den Folgemonat springt).
export function addMonths(from: Date, months: number): Date {
  const d = new Date(from.getTime());
  const targetDay = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const daysInTarget = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(targetDay, daysInTarget));
  return d;
}

// Ganze Tage bis zur Fälligkeit (negativ = überfällig). Kalendertagsgenau,
// unabhängig von der Uhrzeit.
export function daysUntilDue(dueDate: Date, now: Date = new Date()): number {
  const due = Date.UTC(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due - today) / DAY_MS);
}

// Fälligkeit einordnen. `soonDays` = Vorwarnfenster (Standard 14 Tage).
export function classifyDue(
  dueDate: Date,
  now: Date = new Date(),
  soonDays = 14,
): { days: number; status: DueStatus } {
  const days = daysUntilDue(dueDate, now);
  const status: DueStatus = days < 0 ? "overdue" : days <= soonDays ? "soon" : "ok";
  return { days, status };
}

// Menschenlesbarer Fälligkeitstext (deutsch).
export function dueLabel(days: number): string {
  if (days < 0) return `überfällig seit ${Math.abs(days)} Tag(en)`;
  if (days === 0) return "heute fällig";
  return `fällig in ${days} Tag(en)`;
}
