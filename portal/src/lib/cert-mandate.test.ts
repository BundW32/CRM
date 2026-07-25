import { describe, expect, it } from "vitest";
import {
  CERT_MANDATE_SOURCES,
  certMandateGrantedOn,
  certMandateSourceLabels,
  hasCertMandate,
  isCertMandateSource,
} from "./cert-mandate";

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

describe("hasCertMandate – Quelle", () => {
  it("gilt unabhängig davon, wie die Vollmacht zustande kam", () => {
    // § 19 Abs. 5 BMG schreibt keine Form vor: Die schriftlich erteilte und im
    // CRM vermerkte Vollmacht trägt genauso wie die im Portal erteilte.
    for (const quelle of CERT_MANDATE_SOURCES) {
      expect(
        hasCertMandate({
          certMandateGrantedAt: T1,
          certMandateRevokedAt: null,
          certMandateSource: quelle,
        }),
        quelle,
      ).toBe(true);
    }
  });

  it("macht aus einer Quelle allein keine Vollmacht", () => {
    expect(
      hasCertMandate({
        certMandateGrantedAt: null,
        certMandateRevokedAt: null,
        certMandateSource: "SCHRIFTLICH",
      }),
    ).toBe(false);
  });
});

describe("isCertMandateSource", () => {
  it("erkennt die gültigen Quellen", () => {
    expect(isCertMandateSource("SELBST")).toBe(true);
    expect(isCertMandateSource("SCHRIFTLICH")).toBe(true);
  });

  it("weist Unbekanntes ab", () => {
    expect(isCertMandateSource("MUENDLICH")).toBe(false);
    expect(isCertMandateSource(null)).toBe(false);
    expect(isCertMandateSource(undefined)).toBe(false);
  });

  it("hat für jede Quelle eine Beschriftung", () => {
    for (const quelle of CERT_MANDATE_SOURCES) {
      expect(certMandateSourceLabels[quelle], quelle).not.toBe("");
    }
  });
});

describe("certMandateGrantedOn", () => {
  it("liefert den Zeitpunkt nur bei gültiger Vollmacht", () => {
    expect(certMandateGrantedOn({ certMandateGrantedAt: T1, certMandateRevokedAt: null })).toEqual(T1);
    expect(certMandateGrantedOn({ certMandateGrantedAt: T1, certMandateRevokedAt: T2 })).toBeNull();
  });
});
