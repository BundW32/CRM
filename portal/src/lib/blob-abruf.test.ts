import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Hält fest, dass das Blob-Zugriffs-Token nie an einen ungeprüften Host geht.
 *
 * `BLOB_READ_WRITE_TOKEN` trägt Lese- UND Schreibrecht auf sämtliche
 * Kundendateien **aller** Mandanten. `storedName` kommt aus der Datenbank;
 * gelangte dort je eine fremde URL hinein (Import, Migration, Manipulation),
 * ginge das Token an einen beliebigen fremden Server — SSRF mit
 * Credential-Exfiltration. Deshalb schreibt `src/lib/storage.ts` die Prüfung
 * `isBlobUrl()` für JEDEN Abruf vor, der ein Token mitschickt.
 *
 * Diese Prüfung ist bereits zweimal an derselben Stelle vergessen worden:
 * zuerst bei den Teilbereichsanfragen in `api/files/[kind]/[id]`, dann bis zum
 * 11.08.2026 in `api/branding/[slug]/logo` — dort sogar auf einer Route, die
 * ohne Anmeldung erreichbar ist. Beide Male fiel es niemandem auf, weil der
 * Abruf ja funktionierte. Ein eigener Abruf ist deshalb nur zulässig, wenn er
 * die Prüfung sichtbar mitbringt.
 */

const APP = join(process.cwd(), "src", "app");

// Geprüft wird der WIRKSAME Quelltext. Die Kopfkommentare beider Routen
// zitieren den entfernten Token-Abruf, um festzuhalten, was warum verschwunden
// ist — sie dürfen die Prüfung nicht auslösen.
const ohneKommentare = (q: string) =>
  q.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

function quelldateien(): { pfad: string; inhalt: string }[] {
  return readdirSync(APP, { recursive: true, encoding: "utf8" })
    .filter((d) => (d.endsWith(".ts") || d.endsWith(".tsx")) && !d.includes(".test."))
    .map((d) => ({ pfad: d, inhalt: ohneKommentare(readFileSync(join(APP, d), "utf8")) }));
}

describe("Blob-Abruf mit Zugriffs-Token", () => {
  it("prüft den Host überall, wo eine Route das Token selbst mitschickt", () => {
    const ohnePruefung = quelldateien()
      .filter((d) => d.inhalt.includes("BLOB_READ_WRITE_TOKEN"))
      .filter((d) => !d.inhalt.includes("isBlobUrl"))
      .map((d) => d.pfad);

    // Wer das Token braucht, nimmt entweder `readUpload` (prüft selbst) oder
    // ruft `isBlobUrl` vor dem Abruf auf. Eine dritte Möglichkeit gibt es nicht.
    expect(ohnePruefung, "Token-Abruf ohne isBlobUrl-Prüfung").toEqual([]);
  });

  it("liefert das Mandanten-Logo über die geprüfte Leseroutine aus", () => {
    const logo = ohneKommentare(
      readFileSync(join(APP, "api", "branding", "[slug]", "logo", "route.ts"), "utf8"),
    );
    // Die Route ist unauthentifiziert erreichbar — hier wiegt ein eigener
    // Abrufpfad am schwersten.
    expect(logo).toContain("readUpload");
    expect(logo).not.toContain("Authorization");
    expect(logo).not.toContain("BLOB_READ_WRITE_TOKEN");
  });
});
