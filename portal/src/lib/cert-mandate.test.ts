import { describe, expect, it } from "vitest";
import { certMandateGrantedOn, hasCertMandate } from "./cert-mandate";

const T1 = new Date("2026-01-01T10:00:00Z");
const T2 = new Date("2026-06-01T10:00:00Z");

describe("hasCertMandate", () => {
  it("verneint ohne Erteilung", () => {
    expect(hasCertMandate({ certMandateGrantedAt: null, certMandateRevokedAt: null })).toBe(false);
  });

  it("verneint für fehlende Person", () => {
    expect(hasCertMandate(null)).toBe(false);
    expect(hasCertMandate(undefined)).toBe(false);
  });

  it("bejaht nach Erteilung ohne Widerruf", () => {
    expect(hasCertMandate({ certMandateGrantedAt: T1, certMandateRevokedAt: null })).toBe(true);
  });

  it("verneint nach einem Widerruf, der auf die Erteilung folgt", () => {
    expect(hasCertMandate({ certMandateGrantedAt: T1, certMandateRevokedAt: T2 })).toBe(false);
  });

  it("bejaht bei erneuter Erteilung nach einem Widerruf", () => {
    // Wer nach dem Widerruf erneut bevollmächtigt, darf nicht am alten
    // Widerruf hängen bleiben.
    expect(hasCertMandate({ certMandateGrantedAt: T2, certMandateRevokedAt: T1 })).toBe(true);
  });
});

describe("certMandateGrantedOn", () => {
  it("liefert den Zeitpunkt nur bei gültiger Vollmacht", () => {
    expect(certMandateGrantedOn({ certMandateGrantedAt: T1, certMandateRevokedAt: null })).toEqual(T1);
    expect(certMandateGrantedOn({ certMandateGrantedAt: T1, certMandateRevokedAt: T2 })).toBeNull();
  });
});
