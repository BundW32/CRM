import { describe, expect, it } from "vitest";
import {
  canRemindAgain,
  isOverdue,
  nextReminderLevel,
  reminderCopy,
  reminderLevelLabel,
} from "./dunning";

describe("nextReminderLevel", () => {
  it("erhöht bis maximal 3", () => {
    expect(nextReminderLevel(0)).toBe(1);
    expect(nextReminderLevel(2)).toBe(3);
    expect(nextReminderLevel(3)).toBe(3);
  });
});

describe("reminderLevelLabel", () => {
  it("benennt die Stufen", () => {
    expect(reminderLevelLabel(0)).toBe("—");
    expect(reminderLevelLabel(1)).toBe("Zahlungserinnerung");
    expect(reminderLevelLabel(2)).toBe("1. Mahnung");
    expect(reminderLevelLabel(3)).toBe("2. Mahnung");
  });
});

describe("isOverdue", () => {
  const now = new Date("2026-07-10T00:00:00Z");
  it("nur offene mit überschrittener Fälligkeit", () => {
    expect(isOverdue({ status: "OFFEN", dueAt: new Date("2026-07-01") }, now)).toBe(true);
    expect(isOverdue({ status: "OFFEN", dueAt: new Date("2026-07-20") }, now)).toBe(false);
    expect(isOverdue({ status: "OFFEN", dueAt: null }, now)).toBe(false);
    expect(isOverdue({ status: "BEZAHLT", dueAt: new Date("2026-07-01") }, now)).toBe(false);
  });
});

describe("canRemindAgain", () => {
  const now = new Date("2026-07-10T00:00:00Z");
  it("erste Mahnung immer erlaubt", () => {
    expect(canRemindAgain(null, now)).toBe(true);
  });
  it("Mindestabstand 7 Tage", () => {
    expect(canRemindAgain(new Date("2026-07-05"), now)).toBe(false); // 5 Tage
    expect(canRemindAgain(new Date("2026-07-03"), now)).toBe(true); // 7 Tage
  });
});

describe("reminderCopy", () => {
  const info = { invoiceNo: "BW-2026-0001", grossFormatted: "119,00 €", dueDateFormatted: "01.07.2026" };
  it("liefert je Stufe einen passenden Betreff", () => {
    expect(reminderCopy(1, info).subject).toMatch(/Zahlungserinnerung/);
    expect(reminderCopy(2, info).subject).toMatch(/1\. Mahnung/);
    expect(reminderCopy(3, info).subject).toMatch(/2\. Mahnung/);
  });
  it("nennt Rechnungsnummer und Betrag im Text", () => {
    const t = reminderCopy(2, info).text;
    expect(t).toContain("BW-2026-0001");
    expect(t).toContain("119,00 €");
  });
});
