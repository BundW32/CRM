import { describe, expect, it } from "vitest";
import { fiscalYearOf, isDateLocked } from "./statement-lock";

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

describe("fiscalYearOf", () => {
  it("entspricht bei Kalenderjahr dem Jahr des Datums", () => {
    expect(fiscalYearOf(utc(2026, 1, 1), 1)).toBe(2026);
    expect(fiscalYearOf(utc(2026, 12, 31), 1)).toBe(2026);
  });

  it("ordnet Monate vor dem Beginn dem Vorjahr zu", () => {
    // Wirtschaftsjahr ab Juli: 2026-07 … 2027-06 heißt „2026"
    expect(fiscalYearOf(utc(2026, 7, 1), 7)).toBe(2026);
    expect(fiscalYearOf(utc(2026, 12, 31), 7)).toBe(2026);
    expect(fiscalYearOf(utc(2027, 6, 30), 7)).toBe(2026);
    expect(fiscalYearOf(utc(2027, 7, 1), 7)).toBe(2027);
    expect(fiscalYearOf(utc(2026, 3, 15), 7)).toBe(2025);
  });

  it("trifft die Grenztage des Wirtschaftsjahres genau", () => {
    expect(fiscalYearOf(utc(2026, 3, 31), 4)).toBe(2025);
    expect(fiscalYearOf(utc(2026, 4, 1), 4)).toBe(2026);
  });

  it("weist einen ungültigen Beginn ab", () => {
    expect(() => fiscalYearOf(utc(2026, 1, 1), 0)).toThrow();
    expect(() => fiscalYearOf(utc(2026, 1, 1), 13)).toThrow();
  });
});

describe("isDateLocked", () => {
  it("sperrt nur Daten aus abgeschlossenen Jahren", () => {
    const locked = new Set([2025]);
    expect(isDateLocked(utc(2025, 6, 1), locked, 1)).toBe(true);
    expect(isDateLocked(utc(2026, 6, 1), locked, 1)).toBe(false);
  });

  it("berücksichtigt den Wirtschaftsjahr-Beginn", () => {
    const locked = new Set([2025]); // 07/2025 – 06/2026
    expect(isDateLocked(utc(2026, 5, 1), locked, 7)).toBe(true);
    expect(isDateLocked(utc(2026, 8, 1), locked, 7)).toBe(false);
  });

  it("sperrt nichts, solange keine Abrechnung fertig ist", () => {
    expect(isDateLocked(utc(2025, 6, 1), new Set(), 1)).toBe(false);
  });
});
