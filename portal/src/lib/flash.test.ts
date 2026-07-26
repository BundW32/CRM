import { describe, expect, it } from "vitest";
import { flashMessages, resolveFlash, withFlash } from "./flash";

describe("resolveFlash", () => {
  it("übersetzt bekannte Codes", () => {
    expect(resolveFlash("nutzer-geloescht")?.tone).toBe("success");
    expect(resolveFlash("nutzer-geloescht")?.text).toContain("gelöscht");
  });

  it("bleibt bei unbekannten oder fehlenden Codes stumm", () => {
    expect(resolveFlash("gibt-es-nicht")).toBeNull();
    expect(resolveFlash(null)).toBeNull();
    expect(resolveFlash("")).toBeNull();
  });

  it("hat für jeden Code einen Text und einen gültigen Tonfall", () => {
    for (const [code, meldung] of Object.entries(flashMessages)) {
      expect(meldung.text, code).not.toBe("");
      expect(["success", "error", "info"], code).toContain(meldung.tone);
    }
  });
});

describe("withFlash", () => {
  it("hängt den Code an einen Pfad ohne Querystring", () => {
    expect(withFlash("/verwaltung/kontakte", "kontakt-angelegt")).toBe(
      "/verwaltung/kontakte?flash=kontakt-angelegt",
    );
  });

  it("respektiert einen vorhandenen Querystring", () => {
    expect(withFlash("/verwaltung/kontakte?q=abc", "kontakt-angelegt")).toBe(
      "/verwaltung/kontakte?q=abc&flash=kontakt-angelegt",
    );
  });
});
