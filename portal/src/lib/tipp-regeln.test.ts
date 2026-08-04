import { readFileSync } from "node:fs";
import { join } from "node:path";
// `node:fs`-Typen kennen `globSync` in dieser Version noch nicht; die Laufzeit
// (Node 22) hat es. `fast-glob` liegt über vitest ohnehin im Baum.
import { globSync } from "tinyglobby";
import { describe, expect, it } from "vitest";

// Erklärende Hinweise sind abschaltbar (`User.showHints`). Warnungen und
// Fehlermeldungen sind es NICHT — und dieser Unterschied ist der ganze Punkt.
//
// Ein abgeschalteter Tipp darf niemanden in einen Fehler laufen lassen, den er
// hätte vermeiden können. Wer eine Warnung in ein `<Tipp>` verpackt, macht
// genau das: Sie verschwindet für die Person, die sie am dringendsten braucht —
// die, der die Erklärungen zu viel waren.
//
// Statisch geprüft, weil es sonst niemandem auffällt: Ein fehlender Hinweis
// sieht aus wie eine aufgeräumte Seite.

// Zwei Ebenen hoch: Diese Datei liegt in `src/lib`, gesucht wird ab der
// Projektwurzel. Mit nur einer Ebene fand der Glob nichts und der Test war
// leer grün — er meldete Erfolg, ohne eine einzige Datei gesehen zu haben.
const wurzel = join(__dirname, "..", "..");
const dateien = globSync(["src/app/**/*.tsx"], { cwd: wurzel }).map((p: string) => join(wurzel, p));

/** Grober, aber ausreichender Test: Steht ein `<Alert` innerhalb eines `<Tipp>`? */
function alertImTipp(quelle: string): boolean {
  let tiefe = 0;
  for (const treffer of quelle.matchAll(/<\/?Tipp[\s>]|<Alert[\s>]/g)) {
    const t = treffer[0];
    if (t.startsWith("</Tipp")) tiefe = Math.max(0, tiefe - 1);
    else if (t.startsWith("<Tipp")) tiefe++;
    else if (tiefe > 0) return true;
  }
  return false;
}

describe("Abschaltbare Hinweise", () => {
  it("sieht überhaupt Dateien", () => {
    // Ohne diese Zusicherung meldet ein falscher Pfad „bestanden", weil nichts
    // zu prüfen war. Genau das ist beim Schreiben dieses Tests passiert.
    expect(dateien.length).toBeGreaterThan(50);
  });

  it("verpackt keine Warnung oder Fehlermeldung in einen Tipp", () => {
    const verstoesse = dateien
      .filter((f: string) => alertImTipp(readFileSync(f, "utf8")))
      .map((f: string) => f.slice(wurzel.length + 1));
    expect(verstoesse).toEqual([]);
  });

  it("hält die Entscheidung an einer Stelle — Seiten lesen `showHints` nicht selbst aus", () => {
    // Sonst steht die Regel „Warnungen bleiben" bald in dreißig Seiten und
    // gilt in achtundzwanzig davon.
    const direkt = dateien
      .filter((f: string) => /\buser\.showHints\b|\bshowHints\s*\?/.test(readFileSync(f, "utf8")))
      .map((f) => f.slice(wurzel.length + 1))
      // Der Schalter selbst muss den Wert natürlich lesen.
      .filter((f: string) => !f.endsWith("konto/page.tsx"));
    expect(direkt).toEqual([]);
  });
});
