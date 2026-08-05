import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Hält die Formulierungen fest, die das Gesetz vorschreibt.
 *
 * Diese Zeichenketten sind keine Textentwürfe, sondern Tatbestandsmerkmale.
 * „Vertrag beenden“ statt „Verträge hier kündigen“ liest sich freundlicher und
 * erfüllt § 312k Abs. 2 Satz 3 BGB nicht mehr — mit der Folge, dass die
 * Kündigungsfrist nicht zu laufen beginnt und der Verbraucher jederzeit
 * fristlos kündigen kann (§ 312k Abs. 6 BGB). Genau solche gut gemeinten
 * Umbenennungen fängt diese Prüfung ab.
 */

const src = (...t: string[]) => join(process.cwd(), "src", ...t);
const lies = (p: string) => readFileSync(p, "utf8");

const KUENDIGEN = lies(src("app", "kuendigen", "page.tsx"));
const KUENDIGEN_ACTION = lies(src("app", "kuendigen", "actions.ts"));
const WIDERRUF = lies(src("app", "widerruf", "page.tsx"));
const AGB = lies(src("app", "agb", "page.tsx"));
const AVV = lies(src("app", "avv", "page.tsx"));
const MARKETING_FOOTER = lies(src("components", "marketing", "site.tsx"));

describe("Kündigungsschaltfläche (§ 312k BGB)", () => {
  it("trägt die vom Gesetz vorgegebene Beschriftung", () => {
    // Abs. 2 Satz 3: „Verträge hier kündigen“ oder entsprechend eindeutig.
    expect(MARKETING_FOOTER).toContain("Verträge hier kündigen");
    expect(KUENDIGEN).toContain("Verträge hier kündigen");
  });

  it("beschriftet die Bestätigungsschaltfläche mit „jetzt kündigen“", () => {
    // Abs. 2 Satz 4 — eine andere Beschriftung erfüllt den Tatbestand nicht.
    expect(KUENDIGEN).toMatch(/>\s*Jetzt kündigen\s*</);
  });

  it("verlangt keine Anmeldung", () => {
    // Abs. 2 Satz 2: ständig verfügbar sowie unmittelbar und leicht zugänglich.
    // Eine Kündigung hinter dem Login hinge am Passwort — daran scheitert sie
    // im Zweifel genau dann, wenn sie gebraucht wird.
    expect(KUENDIGEN).not.toMatch(/requireUser|requireVerwalter|getSession/);
    expect(KUENDIGEN_ACTION).not.toMatch(/requireUser|requireVerwalter/);
  });

  it("bestätigt den Zugang in Textform", () => {
    // Abs. 4: Bestätigung mit Inhalt, Zeitpunkt des Zugangs und Zeitpunkt der
    // Beendigung. Ohne Mail an die erklärende Person bliebe es bei einer
    // Bildschirmmeldung.
    expect(KUENDIGEN_ACTION).toContain("sendMail");
    expect(KUENDIGEN_ACTION).toMatch(/Eingang: \$\{eingangText\}/);
  });

  it("löscht oder sperrt nichts", () => {
    // Der Weg steht ohne Anmeldung offen. Würde er Konten abschalten, könnte
    // ein Fremder mit geratener Adresse eine Gemeinschaft aussperren.
    expect(KUENDIGEN_ACTION).not.toMatch(/db\.|delete|deactivate|active: false/);
  });
});

describe("Widerrufsbelehrung (Art. 246a EGBGB)", () => {
  it("nennt Frist, Erklärungsempfänger und Musterformular", () => {
    expect(WIDERRUF).toContain("vierzehn Tagen");
    expect(WIDERRUF).toContain("Muster-Widerrufsformular");
    // Ohne ladungsfähige Anschrift und Kontaktweg ist die Belehrung unwirksam.
    expect(WIDERRUF).toContain("Goethestraße 42");
    expect(WIDERRUF).toContain("info@bundwimmobilien.de");
  });
});

describe("AGB und AVV der WEG-Tür", () => {
  it("schließen Verbraucher nicht mehr aus", () => {
    // Die alte Klausel („nicht für Verbraucher bestimmt“) war für die
    // beworbene Zielgruppe unwirksam und verlängerte die Widerrufsfrist auf
    // zwölf Monate und 14 Tage (§ 356 Abs. 3 Satz 2 BGB).
    expect(AGB).not.toContain("nicht für Verbraucher bestimmt");
    expect(AGB).toContain("VIII ZR 243/13");
  });

  it("tragen kein Entwurfs-Etikett mehr", () => {
    // Ein Dokument, das beim Anhaken als Entwurf zu erkennen gibt, ist die
    // denkbar schlechteste Grundlage für eine Zustimmung.
    expect(AVV).not.toMatch(/^\s*draft\s*$/m);
    expect(AGB).not.toMatch(/^\s*draft\s*$/m);
  });

  it("räumt das Widerspruchsrecht bei neuen Subprozessoren ein", () => {
    // Art. 28 Abs. 2 DSGVO: Ohne Ankündigung und Einspruchsmöglichkeit trägt
    // die allgemeine Genehmigung nicht.
    expect(AVV).toContain("widersprechen");
    expect(AVV).toContain("allgemeine schriftliche Genehmigung");
  });

  it("verweist nicht auf Unterlagen, die es nicht gibt", () => {
    // Zwei tote Verweise standen bis zum 05.08.2026 im Vertrag. Geprüft wird
    // der SICHTBARE Text: Der Kopfkommentar der Datei zitiert die entfernten
    // Formulierungen, um festzuhalten, was warum verschwunden ist — er darf
    // die Prüfung nicht auslösen.
    const ohneKommentare = AVV.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    expect(ohneKommentare).not.toContain("Anlage zu diesem Vertrag");
    expect(ohneKommentare).not.toContain("gesondert dokumentiert");
  });
});
