import { readFileSync } from "node:fs";
import { join } from "node:path";
import { globSync } from "tinyglobby";
import { describe, expect, it, vi } from "vitest";

// Erst-Passwörter reisten bis zum 03.08.2026 in der Adresszeile: fünf Aktionen
// leiteten mit `?pw=<Klartext>` weiter, die Sammel-Variante mit
// `?u=id~pw~id~pw~…` für ein ganzes Objekt auf einmal. Eine URL steht im
// Zugriffsprotokoll jedes Servers und jedes Proxys davor, im Browserverlauf und
// im `Referer` jeder nachgeladenen Ressource — und keiner dieser Speicher lässt
// sich nachträglich aufräumen.
//
// Zwei Prüfungen: dass die Übergabe selbst hält, und dass niemand den alten Weg
// versehentlich wieder einführt.

const cookieStore = { set: vi.fn(), get: vi.fn() };
vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));

const { liesErstzugaenge, merkeErstzugaenge, merkeErstzugang } = await import("./zugangsschreiben");

function gesetzterWert() {
  const letzter = cookieStore.set.mock.calls.at(-1);
  return { wert: letzter?.[1] as string, optionen: letzter?.[2] as Record<string, unknown> };
}

describe("Erst-Passwörter übergeben", () => {
  it("setzt ein Cookie, das nicht in Protokollen landet", async () => {
    cookieStore.set.mockClear();
    await merkeErstzugang("u1", "Geheim-2026!");

    const { wert, optionen } = gesetzterWert();
    expect(JSON.parse(wert)).toEqual({ u1: "Geheim-2026!" });
    // httpOnly: kein Zugriff aus Skripten. Pfadgebunden: wird nicht an jede
    // Anfrage des Portals mitgeschickt. Kurzlebig: räumt sich selbst auf.
    expect(optionen.httpOnly).toBe(true);
    expect(optionen.sameSite).toBe("strict");
    expect(optionen.path).toBe("/zugangsschreiben");
    expect(optionen.maxAge).toBeLessThanOrEqual(600);
    expect(optionen.maxAge).toBeGreaterThan(0);
  });

  it("überträgt mehrere Personen in einem Zug", async () => {
    cookieStore.set.mockClear();
    await merkeErstzugaenge([
      { id: "u1", pw: "eins" },
      { id: "u2", pw: "zwei" },
    ]);
    expect(JSON.parse(gesetzterWert().wert)).toEqual({ u1: "eins", u2: "zwei" });
  });

  it("setzt nichts, wenn es nichts zu übergeben gibt", async () => {
    cookieStore.set.mockClear();
    await merkeErstzugang("u1", null);
    await merkeErstzugaenge([]);
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it("liest die Zuordnung zurück", async () => {
    cookieStore.get.mockReturnValue({ value: JSON.stringify({ u1: "eins" }) });
    expect((await liesErstzugaenge()).get("u1")).toBe("eins");
  });

  it("behandelt ein fehlendes oder beschädigtes Cookie als „kein Passwort“", async () => {
    // Kein Fehlerfall: Nach Ablauf ist genau das der Normalzustand, und die
    // Seite sagt dann, dass ein neues Schreiben zu erzeugen ist.
    cookieStore.get.mockReturnValue(undefined);
    expect((await liesErstzugaenge()).size).toBe(0);
    cookieStore.get.mockReturnValue({ value: "kein json" });
    expect((await liesErstzugaenge()).size).toBe(0);
    cookieStore.get.mockReturnValue({ value: JSON.stringify(["nicht", "objekt"]) });
    expect((await liesErstzugaenge()).size).toBe(0);
  });
});

describe("Kein Passwort in der Adresszeile", () => {
  it("leitet nirgends mehr mit einem Passwort im Pfad weiter", () => {
    // Statisch geprüft, weil der Rückfall billig ist und niemandem auffiele:
    // Ein `?pw=` in einem neuen `redirect()` sieht aus wie jeder andere
    // Parameter und funktioniert tadellos — nur eben mit dem Passwort in jedem
    // Log auf dem Weg.
    const wurzel = join(__dirname, "..", "..");
    const treffer: string[] = [];
    for (const datei of globSync(["src/**/*.ts", "src/**/*.tsx"], { cwd: wurzel })) {
      if (datei.endsWith("zugangsschreiben.test.ts")) continue;
      const zeilen = readFileSync(join(wurzel, datei), "utf8").split("\n");
      zeilen.forEach((zeile, i) => {
        if (zeile.trimStart().startsWith("//")) return;
        if (/redirect\(\s*[`"'][^`"']*[?&](pw|u)=/.test(zeile)) {
          treffer.push(`${datei}:${i + 1}`);
        }
      });
    }
    expect(treffer, `Passwort in der URL: ${treffer.join(", ")}`).toEqual([]);
  });
});
