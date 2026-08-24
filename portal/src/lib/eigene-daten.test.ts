import { describe, expect, it } from "vitest";
import { leseKontaktdaten, normalisiereEmail } from "./eigene-daten";

describe("normalisiereEmail", () => {
  it("trimmt und schreibt klein — sonst wären „Max@…“ und „max@…“ zwei Konten", () => {
    expect(normalisiereEmail("  Max.Mustermann@Beispiel.DE ")).toBe("max.mustermann@beispiel.de");
  });

  it("weist ab, was keine Adresse sein kann", () => {
    for (const eingabe of ["", "  ", "max", "max@", "@beispiel.de", "max@beispiel", "a@b.de x"]) {
      expect(normalisiereEmail(eingabe), eingabe).toBeNull();
    }
  });

  it("weist eine zweite @-Stelle ab (häufiger Tippfehler beim Kopieren)", () => {
    expect(normalisiereEmail("max@alt@beispiel.de")).toBeNull();
  });

  it("lässt Sonderfälle durch, die gültig sind", () => {
    // Bewusst genügsam geprüft: Die eigentliche Prüfung ist die
    // Bestätigungsmail. Eine strenge Mustererkennung wiese hier reihenweise
    // gültige Adressen ab — Plus-Adressierung und Umlaut-Domains etwa.
    expect(normalisiereEmail("max+weg@beispiel.co.uk")).toBe("max+weg@beispiel.co.uk");
    expect(normalisiereEmail("verwaltung@müller-immobilien.de")).toBe(
      "verwaltung@müller-immobilien.de",
    );
  });

  it("nimmt fehlende Werte hin, statt zu werfen", () => {
    expect(normalisiereEmail(undefined)).toBeNull();
    expect(normalisiereEmail(null)).toBeNull();
  });
});

describe("leseKontaktdaten", () => {
  it("macht aus einem leeren Feld `null`, nicht den leeren Text", () => {
    // Sonst stünde in der Datenbank "" statt „nicht angegeben" — und jede
    // Anzeige müsste beides gegen leer prüfen.
    const daten = leseKontaktdaten({ phone: "   ", street: "", zip: undefined, city: null });
    expect(daten).toEqual({
      phone: null,
      street: null,
      zip: null,
      city: null,
      preferredContact: null,
    });
  });

  it("übernimmt getrimmte Werte", () => {
    const daten = leseKontaktdaten({
      phone: " 0221 12345 ",
      street: "Musterweg 3",
      zip: "50667",
      city: "Köln",
      preferredContact: "TELEFON",
    });
    expect(daten.phone).toBe("0221 12345");
    expect(daten.preferredContact).toBe("TELEFON");
  });

  it("wertet einen unbekannten Kontaktweg als „keine Angabe“", () => {
    // Das Feld ist ein <select> mit fester Liste; ein anderer Wert kann nur von
    // Hand konstruiert sein. Dann ist „keine Angabe" die harmlose Auslegung —
    // ein Fehler wäre hier nur Lärm.
    expect(leseKontaktdaten({ preferredContact: "BRIEFTAUBE" }).preferredContact).toBeNull();
  });

  it("kappt überlange Eingaben, statt sie abzulehnen", () => {
    expect(leseKontaktdaten({ city: "x".repeat(500) }).city).toHaveLength(120);
  });
});
