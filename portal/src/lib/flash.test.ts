import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { flashMessages, resolveFlash } from "./flash";

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

  /**
   * Der zweitstillste Fehler, und der Test darüber hatte ihn nicht gesehen:
   * Reihenfolge.
   *
   * `redirect("/beschluesse#abc?flash=gespeichert")` sieht richtig aus und ist
   * es nicht. Nach den URL-Regeln beginnt das Fragment beim ersten `#` und
   * reicht bis zum Ende — `abc?flash=gespeichert` ist also **vollständig**
   * Fragment, und einen Suchparameter `flash` gibt es nicht. Der ToastHost
   * liest `searchParams` und schweigt. So lagen drei Rückmeldungen der
   * Beschlüsse-Seite still, darunter die nach jeder Stimmabgabe.
   *
   * Der Test oben greift das nicht ab: Sein `grep` findet `?flash=gespeichert`
   * auch mitten im Fragment und hält den Code für in Ordnung — er ist es ja
   * auch, er kommt nur nie an. Die richtige Reihenfolge steht in AGENTS.md
   * („Buttons"): erst der Parameter, dann der Anker.
   */
  it("setzt den Parameter VOR den Anker, nicht dahinter", () => {
    // grep endet mit Code 1, wenn es nichts findet — und genau das ist hier der
    // Erfolgsfall. `execFileSync` wirft dann, deshalb der Fang.
    let zeilen = "";
    try {
      zeilen = execFileSync(
        "grep",
        ["-rnE", "[\"'`][^\"'`]*#[^\"'`]*[?&]flash=", "src/app", "src/components"],
        { encoding: "utf8" },
      ).trim();
    } catch {
      zeilen = "";
    }

    expect(
      zeilen,
      `Anker steht vor dem flash-Parameter, die Meldung kommt nie an:\n${zeilen}`,
    ).toBe("");
  });
});

