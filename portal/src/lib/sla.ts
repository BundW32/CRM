import type { TicketPriority } from "@/generated/prisma/client";

// SLA in Stunden je Priorität – Fälligkeitsdatum wird beim Erstellen eines
// Vorgangs berechnet und bei Prioritätsänderung neu gesetzt.
const SLA_HOURS: Record<TicketPriority, number> = {
  NIEDRIG:  336, // 14 Tage
  NORMAL:   168, // 7 Tage
  HOCH:      72, // 3 Tage
  DRINGEND:  24, // 1 Tag
};

export function computeDueAt(priority: TicketPriority, from = new Date()): Date {
  const d = new Date(from.getTime());
  d.setHours(d.getHours() + SLA_HOURS[priority]);
  return d;
}
