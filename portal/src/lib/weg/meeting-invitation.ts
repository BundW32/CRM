// Reine Fristenlogik für die Einladung zur Eigentümerversammlung.
// § 24 Abs. 4 S. 2 WEG: die Einladung muss in Textform mit einer Frist von
// mindestens DREI WOCHEN erfolgen (sofern die Gemeinschaftsordnung keine längere
// Frist vorsieht). Maßgeblich ist der Zeitraum zwischen Versanddatum der
// Einladung und dem Versammlungstermin.
import { daysUntilDue } from "@/lib/weg/compliance";

export const INVITATION_MIN_WEEKS = 3;
export const INVITATION_MIN_DAYS = INVITATION_MIN_WEEKS * 7; // 21

// Kalendertage zwischen Versand und Versammlung (uhrzeitunabhängig, damit ein
// später Versand am selben Tag nicht „einen Tag mehr" vortäuscht).
export function invitationLeadDays(scheduledAt: Date, sendDate: Date): number {
  return daysUntilDue(scheduledAt, sendDate);
}

// Spätestes Versanddatum, um die Mindestfrist noch zu wahren (Termin − 21 Tage).
export function latestSendDate(scheduledAt: Date): Date {
  const d = new Date(scheduledAt.getTime());
  d.setDate(d.getDate() - INVITATION_MIN_DAYS);
  return d;
}

export type InvitationDeadlineCheck = {
  leadDays: number; // Tage zwischen Versand und Versammlung
  meets: boolean; // Mindestfrist gewahrt?
  shortfallDays: number; // fehlende Tage bei Unterschreitung (sonst 0)
};

// Prüft, ob ein Versand am `sendDate` (Standard: heute) die Mindestfrist wahrt.
export function checkInvitationDeadline(
  scheduledAt: Date,
  sendDate: Date = new Date(),
): InvitationDeadlineCheck {
  const leadDays = invitationLeadDays(scheduledAt, sendDate);
  const meets = leadDays >= INVITATION_MIN_DAYS;
  return {
    leadDays,
    meets,
    shortfallDays: meets ? 0 : INVITATION_MIN_DAYS - leadDays,
  };
}
