import { describe, expect, it } from "vitest";
import { istIdleTimeoutStufe, istInaktiv, latVeraltet } from "./session-inaktiv";

const NOW = Date.parse("2026-09-18T10:00:00Z");
const vorMinuten = (m: number) => Math.floor((NOW - m * 60_000) / 1000);

describe("istInaktiv", () => {
  it("läuft ohne Timeout nie ab — egal wie alt die letzte Aktivität ist", () => {
    expect(istInaktiv(vorMinuten(10_000), 0, NOW)).toBe(false);
    expect(istInaktiv(vorMinuten(10_000), null, NOW)).toBe(false);
    expect(istInaktiv(null, 0, NOW)).toBe(false);
  });

  it("gilt als abgelaufen, wenn die letzte Aktivität länger als der Timeout zurückliegt", () => {
    expect(istInaktiv(vorMinuten(29), 30, NOW)).toBe(false);
    expect(istInaktiv(vorMinuten(30), 30, NOW)).toBe(false); // genau an der Grenze: noch drin
    expect(istInaktiv(vorMinuten(31), 30, NOW)).toBe(true);
  });

  it("verwirft ein Token ohne Aktivitätsstempel, sobald ein Timeout gesetzt ist", () => {
    expect(istInaktiv(null, 15, NOW)).toBe(true);
    expect(istInaktiv(undefined, 15, NOW)).toBe(true);
  });
});

describe("latVeraltet", () => {
  it("schreibt nicht bei jedem Klick, aber nach einer Minute", () => {
    expect(latVeraltet(Math.floor(NOW / 1000) - 10, NOW)).toBe(false);
    expect(latVeraltet(Math.floor(NOW / 1000) - 60, NOW)).toBe(true);
    expect(latVeraltet(null, NOW)).toBe(true);
  });
});

describe("istIdleTimeoutStufe", () => {
  it("kennt nur die angebotenen Stufen", () => {
    expect(istIdleTimeoutStufe(0)).toBe(true);
    expect(istIdleTimeoutStufe(30)).toBe(true);
    expect(istIdleTimeoutStufe(45)).toBe(false);
    expect(istIdleTimeoutStufe(-1)).toBe(false);
  });
});
