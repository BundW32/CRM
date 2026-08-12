import { describe, expect, it } from "vitest";
import { istTrackingPfad, leseEntscheidung } from "./consent";

/**
 * Die Allowlist ist die einzige Sperre zwischen Google und dem angemeldeten
 * Portalbereich. gtag.js meldet bei jedem Aufruf `page_location` und
 * `page_title` — auf `/verwaltung/nutzer/…` wären das Kennungen und Namen von
 * Personen, für die B&W nur Auftragsverarbeiterin ist. Ein Fehler an dieser
 * Stelle ist deshalb kein Messfehler, sondern eine unbefugte Übermittlung.
 */
describe("istTrackingPfad", () => {
  it("erlaubt die öffentlichen Werbe- und Rechtsseiten", () => {
    for (const p of [
      "/",
      "/funktionen",
      "/funktionen/finanzen",
      "/so-funktionierts",
      "/preise",
      "/registrieren",
      "/datenschutz",
      "/impressum",
      "/agb",
      "/avv",
      "/widerruf",
      "/ki-transparenz",
    ]) {
      expect(istTrackingPfad(p), p).toBe(true);
    }
  });

  it("sperrt den angemeldeten Bereich und alles Unbekannte", () => {
    for (const p of [
      "/verwaltung",
      "/verwaltung/nutzer/abc123",
      "/plattform/analytics/traffic",
      "/onboarding",
      "/login",
      "/auftraege/tok123",
      "/zugangsschreiben/abc",
      "/uebergabe/xyz",
      "/setup",
      "/api/t",
      "/eine-neue-seite",
      "",
    ]) {
      expect(istTrackingPfad(p), p).toBe(false);
    }
  });

  it("behandelt den abschließenden Schrägstrich wie dieselbe Seite", () => {
    expect(istTrackingPfad("/preise/")).toBe(true);
    expect(istTrackingPfad("/verwaltung/")).toBe(false);
  });

  it("lässt sich nicht durch einen Namen mit gleichem Anfang austricksen", () => {
    // "/funktionen" ist freigegeben, "/funktionen-intern" nicht: Die Freigabe
    // hängt am Präfix MIT Schrägstrich, nicht am Wortanfang.
    expect(istTrackingPfad("/funktionen-intern")).toBe(false);
    expect(istTrackingPfad("/registrieren-alt")).toBe(false);
  });
});

describe("leseEntscheidung", () => {
  it("nimmt nur die beiden bekannten Werte an", () => {
    expect(leseEntscheidung("granted")).toBe("granted");
    expect(leseEntscheidung("denied")).toBe("denied");
  });

  it("wertet alles andere als „noch nicht entschieden“", () => {
    // Wichtig: Ein beschädigter Wert darf nicht als Zustimmung durchgehen.
    for (const roh of [null, undefined, "", "ja", "true", "GRANTED"]) {
      expect(leseEntscheidung(roh)).toBeNull();
    }
  });
});
