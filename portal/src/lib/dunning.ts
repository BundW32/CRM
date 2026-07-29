// Mahnwesen-Logik (pure, testbar). Drei Stufen, KEINE Gebühren:
//   1 = Zahlungserinnerung (freundlich)
//   2 = 1. Mahnung
//   3 = 2. Mahnung (letzte)
// Gebühren bewusst nicht automatisch – nur tatsächlich entstandene Kosten dürften
// berechnet werden; das erledigt der Betreiber ggf. als manuelle Rechnungsposition.

import { datenblock, mailText } from "@/lib/mail-text";
import { platformBranding } from "@/lib/branding";

export const MAX_REMINDER_LEVEL = 3;

export function nextReminderLevel(current: number): number {
  return Math.min(current + 1, MAX_REMINDER_LEVEL);
}

export function reminderLevelLabel(level: number): string {
  switch (level) {
    case 1:
      return "Zahlungserinnerung";
    case 2:
      return "1. Mahnung";
    case 3:
      return "2. Mahnung";
    default:
      return "—";
  }
}

// Ist die Rechnung überfällig? (offen UND Fälligkeit überschritten)
export function isOverdue(
  invoice: { status: string; dueAt: Date | null },
  now: Date,
): boolean {
  return invoice.status === "OFFEN" && invoice.dueAt != null && invoice.dueAt < now;
}

// Darf erneut gemahnt werden? (Mindestabstand seit der letzten Mahnung)
export function canRemindAgain(
  lastReminderAt: Date | null,
  now: Date,
  minDays = 7,
): boolean {
  if (!lastReminderAt) return true;
  return now.getTime() - lastReminderAt.getTime() >= minDays * 86_400_000;
}

// Betreff + Text der Mahn-E-Mail für die jeweilige Stufe. Vorformatierte Werte
// (Betrag/Datum als String) hereinreichen, damit diese Datei pur bleibt.
export function reminderCopy(
  level: number,
  info: { invoiceNo: string; grossFormatted: string; dueDateFormatted: string; payWithinDays?: number },
): { subject: string; text: string } {
  const { invoiceNo, grossFormatted, dueDateFormatted } = info;
  const payWithin = info.payWithinDays ?? 7;
  const base = datenblock([
    ["Rechnung", invoiceNo],
    ["Offener Betrag", grossFormatted],
    ["Ursprünglich fällig am", dueDateFormatted],
  ]);
  const branding = platformBranding();

  if (level <= 1) {
    return {
      subject: `Zahlungserinnerung zu Rechnung ${invoiceNo}`,
      text: mailText({
        absaetze: [
          `sicher ist es Ihrer Aufmerksamkeit entgangen: die folgende Rechnung ist noch offen.`,
          base,
          `Bitte gleichen Sie den Betrag in den nächsten Tagen aus. Sollten Sie bereits ` +
            `gezahlt haben, betrachten Sie diese Erinnerung als gegenstandslos.`,
        ],
        branding,
      }),
    };
  }
  if (level === 2) {
    return {
      subject: `1. Mahnung zu Rechnung ${invoiceNo}`,
      text: mailText({
        absaetze: [
          `trotz unserer Erinnerung ist die folgende Rechnung weiterhin offen.`,
          base,
          `Wir bitten Sie, den Betrag innerhalb von ${payWithin} Tagen auszugleichen.`,
        ],
        branding,
      }),
    };
  }
  return {
    subject: `2. Mahnung zu Rechnung ${invoiceNo}`,
    text: mailText({
      absaetze: [
        `die folgende Rechnung ist trotz mehrfacher Aufforderung weiterhin unbeglichen.`,
        base,
        `Wir fordern Sie letztmalig auf, den offenen Betrag innerhalb von ${payWithin} Tagen zu ` +
          `begleichen. Nach fruchtlosem Ablauf behalten wir uns weitere Schritte vor.`,
      ],
      branding,
    }),
  };
}
