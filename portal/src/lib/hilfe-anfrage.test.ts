import { afterEach, describe, expect, it } from "vitest";
import { baueHilfeMail, hilfeEmpfaenger, hilfeSchema } from "./hilfe-anfrage";

const absender = {
  id: "u_1",
  name: "Erika Muster",
  email: "erika@example.org",
  rolle: "Eigentümer",
  organisation: "WEG Musterstraße 1",
};

describe("hilfeSchema", () => {
  it("nimmt eine vollständige Meldung an", () => {
    const r = hilfeSchema.safeParse({
      art: "fehler",
      nachricht: "Beim Speichern der Zählerstände kommt ein Fehler.",
      seite: "/verbrauch",
      browser: "Mozilla/5.0",
    });
    expect(r.success).toBe(true);
  });

  it("weist eine zu kurze Schilderung ab", () => {
    expect(hilfeSchema.safeParse({ art: "fehler", nachricht: "kaputt" }).success).toBe(false);
  });

  it("weist eine unbekannte Art ab", () => {
    expect(hilfeSchema.safeParse({ art: "lob", nachricht: "Alles super, danke!" }).success).toBe(false);
  });

  it("begrenzt Seite und Browser — die Angaben stammen aus dem Client", () => {
    expect(
      hilfeSchema.safeParse({
        art: "frage",
        nachricht: "Wo finde ich die Abrechnung?",
        browser: "x".repeat(501),
      }).success,
    ).toBe(false);
  });
});

describe("baueHilfeMail", () => {
  it("nennt Art, Person, Kontext und Schilderung", () => {
    const m = baueHilfeMail(
      {
        art: "fehler",
        nachricht: "Beim Speichern der Zählerstände kommt ein Fehler.",
        seite: "/verbrauch",
        browser: "Mozilla/5.0 (Test)",
      },
      absender,
      new Date("2026-09-07T10:30:00Z"),
    );
    expect(m.betreff).toBe("[Hilfe] Etwas funktioniert nicht – Erika Muster (WEG Musterstraße 1)");
    expect(m.text).toContain("Name: Erika Muster");
    expect(m.text).toContain("E-Mail: erika@example.org");
    expect(m.text).toContain("Rolle: Eigentümer");
    expect(m.text).toContain("Seite: /verbrauch");
    expect(m.text).toContain("Browser: Mozilla/5.0 (Test)");
    expect(m.text).toContain("Schilderung:\nBeim Speichern der Zählerstände kommt ein Fehler.");
    expect(m.text).toContain("Bitte an erika@example.org antworten.");
    // Berliner Zeit, nicht UTC.
    expect(m.text).toContain("Eingang: 7. September 2026 um 12:30");
  });

  it("lässt leere Kontextzeilen weg", () => {
    const m = baueHilfeMail({ art: "frage", nachricht: "Wo finde ich die Abrechnung?" }, absender);
    expect(m.text).not.toContain("Seite:");
    expect(m.text).not.toContain("Browser:");
  });

  it("weist auf Zugänge ohne E-Mail-Adresse hin", () => {
    const m = baueHilfeMail(
      { art: "sonstiges", nachricht: "Ich komme nicht weiter, bitte um Rückruf." },
      { ...absender, email: null },
    );
    expect(m.text).toContain("E-Mail: – (Zugang ohne E-Mail-Adresse)");
    expect(m.text).toContain("keine E-Mail-Adresse hinterlegt");
    expect(m.text).not.toContain("Bitte an");
  });
});

describe("hilfeEmpfaenger", () => {
  const vorher = process.env.APP_MODE;
  afterEach(() => {
    if (vorher === undefined) delete process.env.APP_MODE;
    else process.env.APP_MODE = vorher;
  });

  it("geht auf wegportal24 an das Service-Postfach", () => {
    process.env.APP_MODE = "weg";
    expect(hilfeEmpfaenger()).toBe("service@wegportal24.de");
  });

  it("geht auf der Verwaltungs-Tür an die Betreiber-Adresse", () => {
    process.env.APP_MODE = "verwaltung";
    expect(hilfeEmpfaenger()).toBe("info@bundwimmobilien.de");
  });
});
