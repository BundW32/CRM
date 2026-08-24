import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Bindet die Rechtstexte an den Code.
 *
 * Stand 11.08.2026 nannte die Datenschutzerklärung zwei KI-Funktionen — im
 * Code waren es drei; der Objekt-Import (`objekt-extraction.ts`) sendet das
 * hochgeladene PDF vollständig an Google und kam in keinem Rechtstext vor.
 * Zugleich lief die gesamte Zahlungsabwicklung über Stripe, ohne dass
 * `/datenschutz` oder `/avv` den Dienst genannt hätten.
 *
 * Beides ist auf demselben Weg entstanden: Eine Funktion wurde gebaut, der
 * Text blieb stehen. Kein Typfehler, kein fehlschlagender Test, kein roter
 * Build — nur eine Pflichtinformation nach Art. 13 DSGVO, die etwas anderes
 * behauptet, als die Software tut. Genau deshalb geht diese Prüfung **vom Code
 * aus**: Sie zählt die Schalter und Dienste im Quelltext und verlangt, dass die
 * Texte dazu passen. Eine vierte KI-Funktion lässt sie fehlschlagen, bis die
 * Texte nachgezogen sind.
 */

const src = (...t: string[]) => join(process.cwd(), "src", ...t);
const lies = (p: string) => readFileSync(p, "utf8");

const DATENSCHUTZ = lies(src("app", "datenschutz", "page.tsx"));
const DATENSCHUTZ_SAAS = lies(src("app", "datenschutz-saas", "page.tsx"));
const AVV = lies(src("app", "avv", "page.tsx"));
const KI_TRANSPARENZ = lies(src("app", "ki-transparenz", "page.tsx"));
const IMPRESSUM = lies(src("app", "impressum", "page.tsx"));

// Kommentare erklären, was früher dastand — sie dürfen eine Prüfung auf den
// SICHTBAREN Text nicht auslösen. Dasselbe Vorgehen wie in
// `verbraucherrecht.test.ts`.
const ohneKommentare = (q: string) =>
  q.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

// Für Prüfungen auf den gelesenen Satz, nicht auf seine Auszeichnung: Ob die
// Zahl fett steht oder nicht, ist eine Frage der Gestaltung — dass sie
// dasteht, ist die Frage dieser Datei. Die Prüfung hing zuvor am Literal
// `<strong>drei</strong>` und schlug fehl, als die Fettungen auf
// /ki-transparenz ausgedünnt wurden, obwohl der Satz unverändert „drei"
// sagt. Ein Test, der an der Auszeichnung hängt, schützt den Text nicht.
const nurText = (q: string) =>
  ohneKommentare(q)
    .replace(/<\/?(?:strong|em|b|i)>/g, "")
    .replace(/\s*\{"\s*"\}\s*/g, " ")
    .replace(/\s+/g, " ");

describe("KI-Funktionen: Text und Code stimmen überein", () => {
  // Jede KI-Funktion hängt an einem eigenen Env-Schalter `AI_…_ENABLED`.
  // Rekursiv: Die Suche lief bis zum 13.08.2026 nur über die oberste Ebene von
  // `src/lib` — eine KI-Funktion in einem Unterordner (`lib/weg/kostenart-ki.ts`)
  // wäre der Zählung entgangen, und genau davor soll diese Prüfung schützen.
  const schalter = new Set<string>();
  const durchsuche = (ordner: string) => {
    for (const eintrag of readdirSync(ordner, { withFileTypes: true })) {
      const pfad = join(ordner, eintrag.name);
      if (eintrag.isDirectory()) {
        durchsuche(pfad);
        continue;
      }
      if (!eintrag.name.endsWith(".ts") || eintrag.name.includes(".test.")) continue;
      for (const m of lies(pfad).matchAll(/process\.env\.(AI_[A-Z0-9_]+_ENABLED)/g)) {
        schalter.add(m[1]);
      }
    }
  };
  durchsuche(src("lib"));

  it("kennt genau die vier dokumentierten Schalter", () => {
    // Schlägt diese Zusicherung fehl, ist eine KI-Funktion dazugekommen oder
    // weggefallen. Dann gehören /datenschutz, /avv und /ki-transparenz
    // nachgezogen — und die Zahl unten in dieser Datei.
    expect([...schalter].sort()).toEqual([
      "AI_ASSISTANT_ENABLED",
      "AI_KOSTENART_ENABLED",
      "AI_OBJEKT_IMPORT_ENABLED",
      "AI_TRIAGE_ENABLED",
    ]);
  });

  it("nennt in Datenschutzerklärung und KI-Transparenz dieselbe Anzahl", () => {
    expect(schalter.size).toBe(4);
    // Die Texte schreiben die Zahl aus. „zwei" stand dort, als es längst drei
    // waren — der teuerste Zustand, weil er nach Vollständigkeit aussieht.
    expect(nurText(DATENSCHUTZ)).toContain("vier optionale KI-Funktionen");
    expect(nurText(KI_TRANSPARENZ)).toContain("vier KI-Funktionen");
    expect(ohneKommentare(DATENSCHUTZ)).not.toMatch(/(zwei|drei) optionale KI-Funktionen/);
  });

  it("nennt den Kostenart-Vorschlag überall, wo die anderen stehen", () => {
    // Er läuft im Finanzbereich — dort, wo die Texte sonst ausdrücklich
    // versprechen, dass keine KI mitwirkt. Eine Lücke wäre hier besonders teuer.
    for (const [name, text] of [
      ["/datenschutz", DATENSCHUTZ],
      ["/avv", AVV],
      ["/ki-transparenz", KI_TRANSPARENZ],
      ["/datenschutz-saas", DATENSCHUTZ_SAAS],
    ] as const) {
      expect(ohneKommentare(text), `${name} nennt den Kostenart-Vorschlag nicht`).toMatch(
        /Kostenart-Vorschlag/,
      );
    }
  });

  it("nennt den Objekt-Import überall, wo die anderen beiden stehen", () => {
    for (const [name, text] of [
      ["/datenschutz", DATENSCHUTZ],
      ["/avv", AVV],
      ["/ki-transparenz", KI_TRANSPARENZ],
      ["/datenschutz-saas", DATENSCHUTZ_SAAS],
    ] as const) {
      expect(ohneKommentare(text), `${name} nennt den Objekt-Import nicht`).toMatch(
        /Objekt-Import/,
      );
    }
  });

  it("verschweigt nicht, dass der Objekt-Import ganze PDFs weitergibt", () => {
    // `objekt-extraction.ts` sendet `inline_data` mit dem Base64-PDF. Solange
    // das so ist, darf kein Text das Gegenteil behaupten.
    expect(lies(src("lib", "objekt-extraction.ts"))).toContain("inline_data");
    expect(ohneKommentare(KI_TRANSPARENZ)).toContain("vollständig und unverändert");
    expect(ohneKommentare(DATENSCHUTZ)).toMatch(/PDF[\s\S]{0,80}vollständig/);
    // Die Seite versprach bis zum 11.08.2026 pauschal das Gegenteil.
    expect(ohneKommentare(KI_TRANSPARENZ)).not.toContain("Dokumente werden nicht ausgelesen");
  });
});

describe("Stripe steht in den Empfängerlisten", () => {
  it("wird eingesetzt — also gehört er in die Texte", () => {
    // Die Zahlungsabwicklung ist keine Option, sie läuft.
    expect(lies(src("lib", "stripe.ts"))).toMatch(/stripe/i);
    for (const [name, text] of [
      ["/datenschutz", DATENSCHUTZ],
      ["/avv", AVV],
      ["/datenschutz-saas", DATENSCHUTZ_SAAS],
    ] as const) {
      expect(ohneKommentare(text), `${name} nennt Stripe nicht`).toContain("Stripe");
    }
  });

  it("wird im AVV ausdrücklich außerhalb der Subprozessoren eingeordnet", () => {
    // Stripe erhält Vertragsdaten der Kundin, keine Auftragsdaten. Ihn in die
    // Subprozessorenliste zu setzen, würde der Verantwortlichen das Falsche
    // sagen — nämlich, ihre Bewohnerdaten gingen dorthin.
    expect(ohneKommentare(AVV)).toContain(
      "<strong>Kein Subprozessor ist der Zahlungsdienstleister Stripe.</strong>",
    );
  });
});

describe("Stand-Daten", () => {
  it("stehen auf jeder Rechtsseite", () => {
    // Ohne Stand ist nicht erkennbar, welche Fassung jemand gelesen hat. Das
    // Impressum und /datenschutz-saas trugen bis zum 11.08.2026 keines.
    for (const [name, text] of [
      ["/datenschutz", DATENSCHUTZ],
      ["/datenschutz-saas", DATENSCHUTZ_SAAS],
      ["/avv", AVV],
      ["/ki-transparenz", KI_TRANSPARENZ],
      ["/impressum", IMPRESSUM],
    ] as const) {
      expect(ohneKommentare(text), `${name} trägt kein Stand-Datum`).toMatch(
        /Stand: \d{1,2}\. \w+ 2\d{3}/,
      );
    }
  });

  it("passen zur Zustimmungsversion der Registrierung", () => {
    // AGB und AVV sind Teil der Zustimmung. Ändert sich ihr Inhalt, muss sich
    // die gespeicherte Version unterscheiden — sonst ist nicht mehr
    // feststellbar, wem welche Fassung vorlag.
    const REGISTRIEREN = lies(src("app", "registrieren", "actions.ts"));
    const version = REGISTRIEREN.match(/const TERMS_VERSION = "(\d{4}-\d{2}-\d{2})"/)?.[1];
    expect(version, "TERMS_VERSION nicht gefunden").toBeDefined();
    expect(ohneKommentare(AVV)).toContain("Stand: 13. August 2026");
    expect(version).toBe("2026-08-13");
  });
});
