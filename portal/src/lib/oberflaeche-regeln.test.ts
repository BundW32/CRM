import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { oberflaecheBestand, oberflaecheBaustein } from "../../eslint.oberflaeche.mjs";

// Die Ausnahmeliste der Oberflächen-Regeln ist der wunde Punkt: Sie schaltet die
// Regeln für einzelne Dateien ab. Ohne Wächter passiert zweierlei –
//
// 1. Jemand trägt eine neue Datei ein, statt den Baustein zu benutzen. Dann wächst
//    die Uneinheitlichkeit weiter, obwohl es die Regeln gibt.
// 2. Ein Eintrag bleibt stehen, nachdem die Datei umgestellt oder gelöscht wurde.
//    Dann ist die Regel für diese Datei still abgeschaltet, und niemand merkt es.
//
// Beides fängt dieser Test ab.

const wurzel = join(__dirname, "..", "..");

/** Die Maskierung für den Glob-Abgleich rückgängig machen (`\[id\]` → `[id]`). */
const alsPfad = (muster: string) => muster.replace(/\\/g, "");

describe("Ausnahmeliste der Oberflächen-Regeln", () => {
  const eintraege: string[] = oberflaecheBestand.files;

  it("wird nur kürzer, nie länger", () => {
    // Stand: 49 beim Einführen der Regeln, 37 nach der Welle „Stammdaten".
    // Die Zahl wird mit jeder Welle gesenkt – erhöht wird sie nicht. Wer eine neue Datei einträgt,
    // umgeht die Regel; dann gehört stattdessen der Baustein benutzt.
    expect(eintraege.length).toBeLessThanOrEqual(37);
  });

  it("enthält keine Einträge für Dateien, die es nicht mehr gibt", () => {
    const verwaist = eintraege.filter((m) => !existsSync(join(wurzel, alsPfad(m))));
    expect(verwaist).toEqual([]);
  });

  it("nimmt den Baustein selbst dauerhaft aus", () => {
    // `DateField` muss ein rohes `<input type="date">` enthalten – sonst gäbe es
    // nichts, worauf die anderen Seiten umsteigen könnten.
    expect(oberflaecheBaustein.files).toContain("src/components/fields.tsx");
  });
});
