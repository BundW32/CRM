import { describe, expect, it } from "vitest";
import { bucketByMonth, lastNMonths, monthKey } from "./platform-stats";
import { buildCsv, csvEscape } from "./csv";

describe("monthKey / lastNMonths", () => {
  it("monthKey formatiert YYYY-MM", () => {
    expect(monthKey(new Date(2026, 0, 15))).toBe("2026-01");
    expect(monthKey(new Date(2026, 11, 1))).toBe("2026-12");
  });
  it("lastNMonths liefert n Monate, ältester zuerst, inkl. aktuellem", () => {
    const m = lastNMonths(new Date(2026, 6, 3), 3); // Jul 2026
    expect(m.map((x) => x.key)).toEqual(["2026-05", "2026-06", "2026-07"]);
  });
  it("überschreitet Jahresgrenzen korrekt", () => {
    const m = lastNMonths(new Date(2026, 1, 10), 3); // Feb 2026
    expect(m.map((x) => x.key)).toEqual(["2025-12", "2026-01", "2026-02"]);
  });
});

describe("bucketByMonth", () => {
  it("summiert Werte je Monat und richtet an Buckets aus", () => {
    const months = lastNMonths(new Date(2026, 6, 1), 3); // Mai, Jun, Jul
    const data = [
      { date: new Date(2026, 5, 2), value: 100 },
      { date: new Date(2026, 5, 20), value: 50 },
      { date: new Date(2026, 6, 1), value: 30 },
      { date: new Date(2025, 0, 1), value: 999 }, // außerhalb → ignoriert
    ];
    expect(bucketByMonth(data, months)).toEqual([0, 150, 30]);
  });
});

describe("csvEscape / buildCsv", () => {
  it("quotet und entschärft Formel-Injection", () => {
    expect(csvEscape("=SUM(A1)")).toBe(`"'=SUM(A1)"`);
    expect(csvEscape("+49 170")).toBe(`"'+49 170"`);
    expect(csvEscape('Say "hi"')).toBe(`"Say ""hi"""`);
  });
  it("lässt reine Zahlen (auch Komma) unentwertet", () => {
    expect(csvEscape("1234,50")).toBe(`"1234,50"`);
    expect(csvEscape("-5")).toBe(`"-5"`);
  });
  it("buildCsv setzt BOM und CRLF", () => {
    const csv = buildCsv([["a", "b"], ["1", "2"]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"a";"b"\r\n"1";"2"');
  });
});
