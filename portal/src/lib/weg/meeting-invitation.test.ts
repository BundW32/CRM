import { describe, expect, it } from "vitest";
import {
  INVITATION_MIN_DAYS,
  checkInvitationDeadline,
  invitationLeadDays,
  latestSendDate,
} from "./meeting-invitation";

describe("invitationLeadDays", () => {
  it("zählt Kalendertage unabhängig von der Uhrzeit", () => {
    const send = new Date(2026, 0, 1, 23, 0);
    expect(invitationLeadDays(new Date(2026, 0, 22, 6, 0), send)).toBe(21);
    expect(invitationLeadDays(new Date(2026, 0, 15, 6, 0), send)).toBe(14);
  });
});

describe("checkInvitationDeadline", () => {
  const send = new Date(2026, 0, 1, 12, 0);

  it("wahrt die Mindestfrist bei genau 3 Wochen", () => {
    const c = checkInvitationDeadline(new Date(2026, 0, 22, 18, 0), send);
    expect(c.leadDays).toBe(21);
    expect(c.meets).toBe(true);
    expect(c.shortfallDays).toBe(0);
  });

  it("warnt bei Unterschreitung und nennt die fehlenden Tage", () => {
    const c = checkInvitationDeadline(new Date(2026, 0, 18, 18, 0), send); // 17 Tage
    expect(c.leadDays).toBe(17);
    expect(c.meets).toBe(false);
    expect(c.shortfallDays).toBe(INVITATION_MIN_DAYS - 17); // 4
  });

  it("erkennt einen Termin in der Vergangenheit als klare Unterschreitung", () => {
    const c = checkInvitationDeadline(new Date(2025, 11, 20), send);
    expect(c.meets).toBe(false);
    expect(c.leadDays).toBeLessThan(0);
  });
});

describe("latestSendDate", () => {
  it("ist der Versammlungstermin minus 21 Tage", () => {
    expect(latestSendDate(new Date(2026, 0, 22))).toEqual(new Date(2026, 0, 1));
  });
});
