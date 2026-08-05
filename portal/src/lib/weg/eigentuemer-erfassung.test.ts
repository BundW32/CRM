import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Hält die Korrekturen aus dem zweiten Testlauf fest.
 *
 * Alle drei Befunde hingen an derselben Lücke: Der Weg, den JEDER Neukunde
 * zuerst geht — „Objekt anlegen" —, kannte weder Miteigentumsanteile noch eine
 * Dublettenprüfung über seine eigenen Zeilen, und danach ließ sich der Anteil
 * nicht mehr korrigieren. Ergebnis: 1.147 Stimmanteile statt 1.000 und zwei
 * Zugänge für einen Eigentümer mit zwei Einheiten.
 *
 * Bewusst statische Prüfungen: Was hier schiefgeht, ist kein Rechenfehler
 * (`mea-sync` rechnete die ganze Zeit richtig), sondern ein Feld, das es nicht
 * gibt. Ein fehlendes Feld fällt weder der Typprüfung noch einem Rechentest
 * auf — es schreibt still den Vorgabewert.
 */

const src = (...teile: string[]) => join(process.cwd(), "src", ...teile);
const lies = (pfad: string) => readFileSync(pfad, "utf8");

const NEU_ACTIONS = lies(src("app", "(portal)", "verwaltung", "objekte", "neu", "actions.ts"));
const NEU_FORM = lies(src("app", "(portal)", "verwaltung", "objekte", "neu", "ObjektForm.tsx"));
const STAMMDATEN_ACTIONS = lies(
  src("app", "(portal)", "verwaltung", "weg", "[propertyId]", "stammdaten", "actions.ts"),
);
const STAMMDATEN_PAGE = lies(
  src("app", "(portal)", "verwaltung", "weg", "[propertyId]", "stammdaten", "page.tsx"),
);
const PLAN_ACTIONS = lies(
  src("app", "(portal)", "verwaltung", "weg", "[propertyId]", "wirtschaftsplan", "actions.ts"),
);

describe("Objekt anlegen: Miteigentumsanteil", () => {
  it("schreibt den Anteil in die Einheiten-Eigentümerschaft", () => {
    // Ohne dieses Feld blieb jede Eigentümerschaft auf 100 %, und `mea-sync`
    // zählte den MEA einer geteilten Einheit für jeden Miteigentümer voll.
    expect(NEU_ACTIONS).toContain('formData.getAll("wegOwnerShare")');
    expect(NEU_ACTIONS).toMatch(/sharePercent:\s*ownerShares\[i\]/);
  });

  it("bietet das Feld auch im Formular an", () => {
    expect(NEU_FORM).toContain('name="wegOwnerShare"');
  });

  it("leitet den Anteil über den gemeinsamen Helfer aus, nicht mit eigener Auslegung", () => {
    // Drei Formulare schreiben `UnitOwnership`. Als jedes seine eigene
    // Prozent-Auslegung hatte, kannte eines den Anteil überhaupt nicht.
    expect(NEU_ACTIONS).toContain('from "@/lib/weg/anteil"');
    expect(STAMMDATEN_ACTIONS).toContain('from "@/lib/weg/anteil"');
  });
});

describe("Objekt anlegen: Dubletten innerhalb des Formulars", () => {
  it("führt ein Verweisfeld auf eine frühere Zeile", () => {
    // `PersonVorschlag` sucht in der Datenbank und kann hier nichts finden:
    // Beim Anlegen einer neuen WEG entstehen alle Eigentümer in derselben
    // Absendung. Wer zwei Einheiten besitzt, bekam zwei Zugänge.
    expect(NEU_FORM).toContain('name="wegOwnerSameAs"');
    expect(NEU_ACTIONS).toContain('formData.getAll("wegOwnerSameAs")');
  });

  it("akzeptiert nur Rückverweise auf frühere Zeilen", () => {
    // Ein Vorwärts- oder Selbstverweis zeigte auf eine Person, die es noch
    // nicht gibt — das darf nicht still eine falsche Zuordnung erzeugen.
    expect(NEU_ACTIONS).toMatch(/verweis\s*>=\s*0\s*&&\s*verweis\s*<\s*i/);
  });

  it("sperrt das Absenden, solange die Frage offen ist", () => {
    // Ein zweiter Zugang für dieselbe Person darf nicht die stille Vorgabe
    // sein, wenn der Hinweis überlesen wird.
    expect(NEU_FORM).toContain("offeneDubletten");
    expect(NEU_FORM).toMatch(/disabled=\{offeneDubletten\}/);
  });

  it("führt Personen nicht automatisch über den Namen zusammen", () => {
    // Zwei verschiedene Menschen können gleich heißen — entscheiden muss der
    // Mensch am Formular. Deshalb beide Antworten sichtbar.
    expect(NEU_FORM).toContain("Ja, dieselbe Person");
    expect(NEU_FORM).toContain("Nein, zwei verschiedene Menschen");
  });
});

describe("Stammdaten: Anteil bleibt korrigierbar", () => {
  it("nimmt den Anteil beim Ändern einer bestehenden Zuordnung entgegen", () => {
    // Vorher ging Korrigieren nur über Beenden und neu Eintragen — und dabei
    // entstand über den Zugangsschreiben-Weg eine zweite Person.
    expect(STAMMDATEN_ACTIONS).toMatch(
      /updateOwnershipStart[\s\S]{0,3000}?parseAnteil\(formData\.get\("sharePercent"\)\)/,
    );
    expect(STAMMDATEN_PAGE).toContain('name="sharePercent"');
  });

  it("rechnet die Stimmgewichte nach der Änderung neu", () => {
    // Ohne diesen Lauf stünde die Korrektur in der Zuordnung, und die
    // MEA-Summe zeigte weiter den alten, falschen Wert.
    expect(STAMMDATEN_ACTIONS).toMatch(
      /updateOwnershipStart[\s\S]{0,3000}?syncOwnerVotingWeights\(property\.id\)/,
    );
  });
});

describe("Wirtschaftsplan: ein Tippfehler kostet nur seine Zeile", () => {
  it("bricht die Planwert-Schleife nicht beim ersten unlesbaren Betrag ab", () => {
    // Vorher: `if (cents === null) back(…)` mitten in der Schleife. Gespeichert
    // wurde nichts (das `update` steht dahinter), die Seite rendert die Felder
    // wieder aus der Datenbank — neun eingetippte Positionen waren weg.
    const schleife = PLAN_ACTIONS.match(
      /const updates: \{ id: string; amountCents: number \}\[\] = \[\];[\s\S]*?\n  \}\n/,
    );
    expect(schleife, "Planwert-Schleife nicht gefunden").not.toBeNull();
    expect(schleife![0]).not.toMatch(/back\(/);
  });

  it("meldet die betroffenen Positionen namentlich", () => {
    expect(PLAN_ACTIONS).toContain("unlesbar");
    expect(PLAN_ACTIONS).toContain("positionen=");
  });
});
