import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { DEFAULT_BRANDING } from "./branding";
import { datenblock, mailText } from "./mail-text";
import { extractCallToAction } from "./mailer";

const branding = { ...DEFAULT_BRANDING, legalName: "Muster GmbH" };

describe("mailText", () => {
  it("setzt Anrede, Inhalt, Aufforderung und Gruß in dieser Reihenfolge", () => {
    expect(
      mailText({
        anrede: "Frau Beispiel",
        absaetze: ["Es gibt Neues."],
        aktion: { label: "Vorgang öffnen", url: "https://p.example/v/1" },
        branding,
      }),
    ).toBe(
      "Guten Tag Frau Beispiel,\n\n" +
        "Es gibt Neues.\n\n" +
        "Vorgang öffnen: https://p.example/v/1\n\n" +
        "Mit freundlichen Grüßen\nMuster GmbH",
    );
  });

  it("lässt die Anrede weg, statt eine leere Anredezeile zu schreiben", () => {
    expect(mailText({ absaetze: ["Text."], branding })).not.toContain("Guten Tag");
  });

  it("wirft bedingte Absätze heraus, statt Leerzeilen zu hinterlassen", () => {
    const text = mailText({ absaetze: ["A", null, false, "  ", "B"], branding });
    expect(text.startsWith("A\n\nB")).toBe(true);
  });

  it("unterdrückt den Gruß nur bei ausdrücklichem null", () => {
    expect(mailText({ absaetze: ["X"], gruss: null, branding })).toBe("X");
    expect(mailText({ absaetze: ["X"], branding })).toContain("Mit freundlichen Grüßen");
  });

  /**
   * Die Kopplung zwischen Bauplan und Layout: Ein Doppelpunkt in der
   * Beschriftung würde die Zeile zerlegen, und der Knopf entfiele — ohne dass
   * irgendetwas kaputtgeht. Genau die Art Fehler, die niemand bemerkt.
   */
  it("erzeugt eine Aufforderung, die das Layout auch als Knopf erkennt", () => {
    const text = mailText({
      anrede: "Herr Beispiel",
      absaetze: ["Inhalt."],
      aktion: { label: "Termin: bestätigen", url: "https://p.example/t/1" },
      branding,
    });
    const { cta, after } = extractCallToAction(text);
    expect(cta).toEqual({ label: "Termin bestätigen", url: "https://p.example/t/1" });
    // Die Grußformel steht hinter dem Knopf, nicht davor.
    expect(after).toContain("Mit freundlichen Grüßen");
  });

  it("kürzt eine zu lange Beschriftung, statt das Layout zu sprengen", () => {
    const text = mailText({
      absaetze: ["X"],
      aktion: { label: "A".repeat(80), url: "https://p.example/x" },
      branding,
    });
    expect(extractCallToAction(text).cta?.label.length).toBeLessThanOrEqual(40);
  });
});

describe("Anrede nach Geschlecht", () => {
  // Dieselbe Regel wie bei den Briefen (documents/anrede.ts) – die Mails waren
  // vorher durchgehend beim unpersönlichen „Guten Tag <voller Name>," geblieben,
  // auch wenn Anrede und Nachname in der Datenbank standen.
  it("spricht Frauen und Männer mit Nachnamen an", () => {
    expect(
      mailText({ anrede: { name: "Ayşe Şahin", lastName: "Şahin", salutation: "Frau" }, absaetze: ["X"], branding }),
    ).toContain("Sehr geehrte Frau Şahin,");
    expect(
      mailText({ anrede: { name: "Jan Kiefer", lastName: "Kiefer", salutation: "Herr" }, absaetze: ["X"], branding }),
    ).toContain("Sehr geehrter Herr Kiefer,");
  });

  it("unterstellt ohne hinterlegte Anrede kein Geschlecht", () => {
    expect(
      mailText({ anrede: { name: "Alex Wachtel", lastName: "Wachtel" }, absaetze: ["X"], branding }),
    ).toContain("Guten Tag Alex Wachtel,");
  });

  it("weicht bei mehreren Empfängern in einem Namensfeld aus", () => {
    // Eheleute/Erbengemeinschaft: jede Einzelanrede wäre falsch.
    expect(
      mailText({ anrede: { name: "Jan Kiefer, Ayşe Şahin", salutation: "Herr" }, absaetze: ["X"], branding }),
    ).toContain("Sehr geehrte Damen und Herren,");
  });

  it("nimmt eine fertige Zeichenkette weiterhin als Namen (Handwerker ohne Konto)", () => {
    expect(mailText({ anrede: "Jan Kiefer", absaetze: ["X"], branding })).toContain(
      "Guten Tag Jan Kiefer,",
    );
  });
});

describe("datenblock", () => {
  it("baut einen Absatz aus Bezeichnung und Wert", () => {
    expect(datenblock([["Objekt", "Goethestraße 42"], ["Termin", "14.09."]])).toBe(
      "Objekt: Goethestraße 42\nTermin: 14.09.",
    );
  });

  it("lässt leere Werte weg, statt eine Zeile ohne Wert zu hinterlassen", () => {
    expect(datenblock([["Objekt", "A"], ["Ort", null], ["Etage", "  "]])).toBe("Objekt: A");
  });

  it("gibt null zurück, wenn nichts übrig bleibt – der Absatz entfällt dann", () => {
    expect(datenblock([["Ort", null]])).toBeNull();
  });
});

/**
 * Gegenprobe über den Quelltext: Die alten, von Hand zusammengesetzten Texte
 * sind die Fehlerquelle, die dieser Bauplan ablöst. Käme eine neue Mail wieder
 * mit `Guten Tag ${…},\n\n` daher, wäre sie sofort wieder uneinheitlich –
 * und niemand würde es beim Review bemerken.
 */
describe("Mailtexte im Quelltext", () => {
  // grep endet mit Code 1, wenn es nichts findet – genau der Erfolgsfall hier.
  function dateienMit(muster: string, pfade = ["src/app", "src/lib"]): string[] {
    try {
      return execFileSync("grep", ["-rlE", muster, ...pfade], { encoding: "utf8" })
        .split("\n")
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  /**
   * Der eigentliche Zweck des Bauplans: Anrede, Aufbau und Grußformel liegen an
   * **einer** Stelle. Baut eine neue Mail ihren Text wieder von Hand zusammen,
   * ist sie sofort wieder uneinheitlich – und beim Review fällt das nicht auf,
   * weil nichts kaputtgeht. Genau so war der Bestand entstanden, den dieser
   * Durchgang abgelöst hat.
   */
  it("baut jede versendende Datei ihre Texte über den Bauplan", () => {
    const versender = dateienMit("\\bsendMail\\(").filter(
      (f) =>
        // Der Versand selbst und seine Tests kennen keinen Text.
        !f.startsWith("src/lib/mailer") &&
        // Reicht Betreff/Text unverändert weiter (Übergabeprotokoll: der
        // Verwalter tippt den Text im Formular selbst).
        !f.includes("uebergabe/") &&
        !f.startsWith("src/lib/platform-invoice-service"),
    );
    expect(versender.length).toBeGreaterThan(10);

    const ohneBauplan = versender.filter((f) => !dateienMit("mail-text", [f]).length);
    expect(ohneBauplan, `Mailtext von Hand gebaut in: ${ohneBauplan.join(", ")}`).toEqual([]);
  });

  it("hängt keine Grußformel mehr von Hand an", () => {
    const treffer = dateienMit("Mit freundlichen Grüßen..n\\$\\{").filter(
      // PDF-Schreiben nach DIN 5008 bringen ihre eigene Grußformel mit.
      (f) => !f.startsWith("src/lib/documents/"),
    );
    expect(treffer, `Handgebaute Grußformel in: ${treffer.join(", ")}`).toEqual([]);
  });
});
