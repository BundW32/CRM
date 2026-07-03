import { afterEach, describe, expect, it, vi } from "vitest";
import {
  computeTrialEnd,
  formatCents,
  formatInvoiceNumber,
  isPlatformAdminUser,
  parseAdminAllowlist,
  trialDays,
} from "./platform";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("parseAdminAllowlist", () => {
  it("gibt bei undefined/leer eine leere Liste zurück", () => {
    expect(parseAdminAllowlist(undefined)).toEqual([]);
    expect(parseAdminAllowlist(null)).toEqual([]);
    expect(parseAdminAllowlist("")).toEqual([]);
    expect(parseAdminAllowlist("  ,  , ")).toEqual([]);
  });
  it("trimmt, kleinschreibt und filtert leere Einträge", () => {
    expect(parseAdminAllowlist(" A@x.de , B@Y.DE ,")).toEqual(["a@x.de", "b@y.de"]);
  });
});

describe("isPlatformAdminUser", () => {
  it("verlangt Flag UND E-Mail in der Allowlist", () => {
    vi.stubEnv("PLATFORM_ADMIN_EMAILS", "chef@bw.de");
    expect(isPlatformAdminUser({ isPlatformAdmin: true, email: "Chef@BW.de" })).toBe(true);
    expect(isPlatformAdminUser({ isPlatformAdmin: false, email: "chef@bw.de" })).toBe(false);
    expect(isPlatformAdminUser({ isPlatformAdmin: true, email: "andere@bw.de" })).toBe(false);
    expect(isPlatformAdminUser({ isPlatformAdmin: true, email: null })).toBe(false);
  });
  it("ohne Env-Allowlist immer false", () => {
    vi.stubEnv("PLATFORM_ADMIN_EMAILS", "");
    expect(isPlatformAdminUser({ isPlatformAdmin: true, email: "chef@bw.de" })).toBe(false);
  });
});

describe("trialDays", () => {
  it("90 Tage über HausMatch, sonst 30", () => {
    expect(trialDays("hausmatch")).toBe(90);
    expect(trialDays(null)).toBe(30);
    expect(trialDays("google")).toBe(30);
  });
});

describe("computeTrialEnd", () => {
  const now = new Date("2026-07-03T12:00:00Z");
  it("verlängert ab jetzt, wenn kein/abgelaufenes Ende", () => {
    expect(computeTrialEnd(null, now, 30)).toEqual(new Date("2026-08-02T12:00:00Z"));
    expect(computeTrialEnd(new Date("2026-01-01T00:00:00Z"), now, 30)).toEqual(
      new Date("2026-08-02T12:00:00Z"),
    );
  });
  it("verlängert ab dem noch laufenden Ende (verkürzt nie)", () => {
    const future = new Date("2026-09-01T00:00:00Z");
    expect(computeTrialEnd(future, now, 30)).toEqual(new Date("2026-10-01T00:00:00Z"));
  });
});

describe("formatInvoiceNumber", () => {
  it("BW-JAHR-NNNN mit führenden Nullen", () => {
    expect(formatInvoiceNumber(2026, 1)).toBe("BW-2026-0001");
    expect(formatInvoiceNumber(2026, 1234)).toBe("BW-2026-1234");
    expect(formatInvoiceNumber(2026, 12345)).toBe("BW-2026-12345");
  });
});

describe("formatCents", () => {
  it("deutsche Währungsdarstellung", () => {
    expect(formatCents(123450)).toMatch(/1\.234,50/);
    expect(formatCents(0)).toMatch(/0,00/);
  });
});
