import { execFileSync } from "node:child_process";
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

/**
 * Der stillste denkbare Fehler: Eine Aktion leitet mit `?flash=xyz` zurück,
 * aber `xyz` steht nicht in der Liste. `resolveFlash` liefert dann `null`, der
 * ToastHost schweigt – und niemand merkt es, weil nichts kaputtgeht. Genau das
 * ist beim Bauen dieses Durchgangs einmal passiert, als die generischen Codes
 * bei einem Rollback verloren gingen: 66 Rückmeldungen waren stumm geschaltet,
 * ohne dass Typprüfung, Linter oder Build etwas gemerkt hätten.
 *
 * Deshalb hier die Gegenprobe über den echten Quelltext.
 */
describe("Codes im Quelltext", () => {
  it("verwendet ausschließlich Codes, die es auch gibt", () => {
    const treffer = execFileSync(
      "grep",
      ["-rhoE", "[?&]flash=[a-z-]+", "src/app", "src/components"],
      { encoding: "utf8" },
    )
      .split("\n")
      .filter(Boolean)
      .map((z) => z.replace(/^[?&]flash=/, ""));

    expect(treffer.length).toBeGreaterThan(0);
    const unbekannt = [...new Set(treffer)].filter((c) => !(c in flashMessages));
    expect(unbekannt, `Unbekannte Flash-Codes: ${unbekannt.join(", ")}`).toEqual([]);
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
