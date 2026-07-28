import { readFileSync } from "node:fs";
import { join } from "node:path";
import { globSync } from "tinyglobby";
import { describe, expect, it } from "vitest";

// Eine Fehlermeldung, die nur sagt *dass* etwas fehlt, lässt den Nutzer suchen.
// Eine, die sagt *wo*, schickt ihn hin. Der Unterschied entscheidet, ob jemand
// die Jahresabrechnung fertigstellt oder aufgibt.
//
// Geprüft wird die schwächste Stelle: Meldungen, die auf Stammdaten verweisen,
// ohne dorthin zu verlinken. Der Rest ist Sache der Durchsicht — eine Regel,
// die jede Formulierung bewertet, gäbe es nicht.

const wurzel = join(__dirname, "..", "..");
const dateien = globSync(["src/app/**/*.tsx"], { cwd: wurzel }).map((p: string) =>
  join(wurzel, p),
);

/** Verweist der Text auf die Stammdaten, ohne dass die Datei dorthin verlinkt? */
function verweistOhneWeg(quelle: string): boolean {
  const nenntStammdaten = /(in den Stammdaten|Zu den Stammdaten|Stammdaten nachtragen)/.test(quelle);
  if (!nenntStammdaten) return false;
  return !/\/stammdaten#|\/stammdaten`|stammdatenHref/.test(quelle);
}

describe("Fehlermeldungen führen zum Ziel", () => {
  it("sieht überhaupt Dateien", () => {
    // Ein falscher Pfad ließe diesen Test „bestehen", ohne etwas zu prüfen.
    expect(dateien.length).toBeGreaterThan(50);
  });

  it("verweist nirgends auf die Stammdaten, ohne dorthin zu verlinken", () => {
    const ohneWeg = dateien
      .filter((f: string) => verweistOhneWeg(readFileSync(f, "utf8")))
      .map((f: string) => f.slice(wurzel.length + 1));
    expect(ohneWeg).toEqual([]);
  });

  it("hält die Sprungziele der Stammdaten-Seite bereit", () => {
    // Die Anker, auf die verlinkt wird, müssen dort auch existieren — sonst
    // landet man oben auf der Seite und sucht weiter.
    const stammdaten = readFileSync(
      join(wurzel, "src/app/(portal)/verwaltung/weg/[propertyId]/stammdaten/page.tsx"),
      "utf8",
    );
    for (const anker of ["einheiten", "eigentuemer", "konten", "kostenarten"]) {
      expect(stammdaten).toContain(`id="${anker}"`);
    }
    // Zeilenanker: je Einheit, Kostenart und Konto ein eigenes Sprungziel.
    expect(stammdaten).toContain("id={`zeile-${u.id}`}");
    expect(stammdaten).toContain("id={`eigentuemer-${u.id}`}");
  });
});
