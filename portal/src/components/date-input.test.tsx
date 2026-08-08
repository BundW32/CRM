import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Der Befund: Ein Klick in die rechte Hälfte eines leeren Datumsfelds fokussiert
// das Monats- oder Jahressegment. Die anschließend getippte Ziffernfolge landet
// im falschen Segment — aus „15072026" wurde „tt.12.72026". Betroffen sind
// Stichtage, Beschlussdaten und Buchungstage, also Felder, an denen rechtlich
// etwas hängt; ein falsches Datum sieht dabei nicht falsch aus, nur anders.
//
// Das Verhalten selbst hängt an der Segment-Implementierung des Browsers und
// lässt sich in jsdom nicht nachstellen (dort ist `type="date"` ein Textfeld
// ohne Segmente). Geprüft wird deshalb die Struktur: dass die Korrektur
// überhaupt existiert, dass sie am zentralen Baustein hängt — und dass sie ein
// **gefülltes** Feld in Ruhe lässt, denn dort will man gezielt ein Segment
// ändern.

const wurzel = join(__dirname, "..", "..");
const quelle = readFileSync(join(wurzel, "src", "components", "date-input.tsx"), "utf8");

describe("DateInput setzt den Fokus auf das Tagessegment", () => {
  it("greift beim Klick, nicht erst nach dem Tippen", () => {
    expect(quelle).toMatch(/onMouseDown/);
  });

  it("setzt die Auswahl auf den Anfang des Feldes", () => {
    expect(quelle).toMatch(/setSelectionRange\(0, 0\)/);
  });

  it("lässt ein bereits gefülltes Feld unangetastet", () => {
    // Ohne diese Bedingung könnte man den Monat eines eingetragenen Datums
    // nicht mehr direkt anklicken — der Fokus spränge jedes Mal auf den Tag.
    expect(quelle).toMatch(/if \(!el \|\| el\.value\) return/);
  });

  it("überlebt Browser ohne Auswahl-API auf Datumsfeldern", () => {
    expect(quelle).toMatch(/try \{[\s\S]*setSelectionRange[\s\S]*\} catch/);
  });
});

describe("Alle Datumsfelder laufen über den Baustein", () => {
  it("DateField rendert DateInput statt eines rohen Feldes", () => {
    const fields = readFileSync(join(wurzel, "src", "components", "fields.tsx"), "utf8");
    expect(fields).toMatch(/<DateInput/);
    expect(ohneKommentare(fields)).not.toMatch(/<input[^>]*type="date"/);
  });

  it('außerhalb des Bausteins steht kein rohes <input type="date"> mehr', () => {
    // Die ESLint-Regel verbietet es bereits; dieser Test hält zusätzlich fest,
    // dass es keinen Rückweg gibt. Ein rohes Feld hätte die Fokus-Korrektur
    // nicht und brächte den Fehler still zurück — auch in einer Datei, die auf
    // der Ausnahmeliste steht und von der Regel deshalb nicht geprüft wird.
    const treffer = tsxDateien(join(wurzel, "src"))
      .filter((pfad) => /<input[^>]*type="date"/.test(ohneKommentare(readFileSync(pfad, "utf8"))))
      .map((pfad) => pfad.replace(`${wurzel}/`, ""));
    expect(treffer).toEqual(["src/components/date-input.tsx"]);
  });
});

/** Alle .tsx-Dateien unterhalb eines Verzeichnisses. */
function tsxDateien(verzeichnis: string): string[] {
  return readdirSync(verzeichnis, { withFileTypes: true }).flatMap((eintrag) => {
    const pfad = join(verzeichnis, eintrag.name);
    if (eintrag.isDirectory()) return tsxDateien(pfad);
    // Prüfdateien selbst reden über das Muster, statt es zu verwenden.
    return eintrag.name.endsWith(".tsx") && !eintrag.name.endsWith(".test.tsx")
      ? [pfad]
      : [];
  });
}

/**
 * Kommentare entfernen. Ohne das schlägt der Test bei jeder Datei an, die das
 * verbotene Muster nur *beschreibt* — die Baustein-Datei tut genau das.
 */
function ohneKommentare(quelle: string): string {
  return quelle.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}
