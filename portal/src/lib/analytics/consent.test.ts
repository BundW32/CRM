import { describe, expect, it } from "vitest";
import { CONSENT_VERSION, neuerConsent, parseConsent } from "./consent";

describe("parseConsent", () => {
  it("liest einen gespeicherten Consent der aktuellen Version", () => {
    const c = neuerConsent({ statistik: true, marketing: false }, new Date("2026-08-24T10:00:00Z"));
    expect(parseConsent(JSON.stringify(c))).toEqual({
      version: CONSENT_VERSION,
      statistik: true,
      marketing: false,
      zeitpunkt: "2026-08-24T10:00:00.000Z",
    });
  });

  it("ältere Versionen gelten als nicht erteilt — das Banner fragt neu", () => {
    const alt = { version: CONSENT_VERSION - 1, statistik: true, marketing: true, zeitpunkt: "2026-01-01T00:00:00.000Z" };
    expect(parseConsent(JSON.stringify(alt))).toBeNull();
  });

  it("verwirft Kaputtes, statt zu raten", () => {
    expect(parseConsent(null)).toBeNull();
    expect(parseConsent("")).toBeNull();
    expect(parseConsent("kein json")).toBeNull();
    expect(parseConsent(JSON.stringify({ version: CONSENT_VERSION, statistik: "ja" }))).toBeNull();
  });
});
