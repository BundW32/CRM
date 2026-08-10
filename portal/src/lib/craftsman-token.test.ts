import { describe, expect, it } from "vitest";
import {
  MAGIC_LINK_GUELTIG_TAGE,
  istCraftsmanTokenGueltig,
  neuesCraftsmanToken,
} from "./craftsman-token";

const TAG = 86_400_000;
const jetzt = new Date("2026-08-10T12:00:00Z");
const vorTagen = (tage: number) => new Date(jetzt.getTime() - tage * TAG);

describe("istCraftsmanTokenGueltig", () => {
  it("akzeptiert ein frisches Token", () => {
    expect(
      istCraftsmanTokenGueltig(
        { accessToken: "abc", accessTokenIssuedAt: vorTagen(1) },
        jetzt,
      ),
    ).toBe(true);
  });

  it("akzeptiert ein Token bis kurz vor Fristende", () => {
    expect(
      istCraftsmanTokenGueltig(
        { accessToken: "abc", accessTokenIssuedAt: vorTagen(MAGIC_LINK_GUELTIG_TAGE - 1) },
        jetzt,
      ),
    ).toBe(true);
  });

  it("lehnt ein abgelaufenes Token ab", () => {
    expect(
      istCraftsmanTokenGueltig(
        { accessToken: "abc", accessTokenIssuedAt: vorTagen(MAGIC_LINK_GUELTIG_TAGE + 1) },
        jetzt,
      ),
    ).toBe(false);
  });

  it("lehnt ohne Token ab", () => {
    expect(
      istCraftsmanTokenGueltig({ accessToken: null, accessTokenIssuedAt: vorTagen(1) }, jetzt),
    ).toBe(false);
  });

  it("lehnt ein Token ohne Ausstellungsdatum ab (fail closed)", () => {
    // Die Migration setzt das Datum für den Bestand; fehlt es trotzdem, hat
    // eine Schreibstelle den Ablauf umgangen — dann soll der Link auffallen,
    // nicht unbegrenzt weiterleben.
    expect(
      istCraftsmanTokenGueltig({ accessToken: "abc", accessTokenIssuedAt: null }, jetzt),
    ).toBe(false);
  });
});

describe("neuesCraftsmanToken", () => {
  it("erzeugt 48 Hex-Zeichen und keine Dubletten", () => {
    const a = neuesCraftsmanToken();
    expect(a).toMatch(/^[0-9a-f]{48}$/);
    expect(neuesCraftsmanToken()).not.toBe(a);
  });
});
