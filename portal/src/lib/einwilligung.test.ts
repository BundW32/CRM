import { describe, expect, it } from "vitest";
import {
  EINWILLIGUNG_FASSUNG,
  istWerbeCookie,
  istWerbeseite,
  leseEinwilligung,
  loeschDomaenen,
} from "./einwilligung";

// Die Pfadliste ist die eigentliche Sperre. Sie entscheidet, ob eine Adresse
// wie `/objekte/42/einheiten/7` als `page_path` an Google geht — und das darf
// sie nie. Ein Test, der nur die öffentlichen Pfade prüft, würde eine zu weit
// gefasste Liste durchgehen lassen; deshalb steht die Gegenprobe hier zuerst.
describe("istWerbeseite", () => {
  it("lässt das Werbe-Tag NICHT hinter die Anmeldung", () => {
    for (const pfad of [
      "/dashboard",
      "/objekte",
      "/objekte/42/einheiten/7",
      "/verwaltung/nutzer",
      "/weg/1/stammdaten",
      "/finanzen/buchungen",
      "/konto",
      "/onboarding",
      "/plattform/analytics/traffic",
    ]) {
      expect(istWerbeseite(pfad), pfad).toBe(false);
    }
  });

  it("lässt es auch nicht auf Adressen mit Token oder Kennung", () => {
    // `/auftraege/<token>` ist der Magic-Link des Handwerkers — die Adresse
    // IST die Zugangsberechtigung. Sie an Google zu melden, gäbe sie preis.
    expect(istWerbeseite("/auftraege/8f3c1d2e")).toBe(false);
    expect(istWerbeseite("/zugangsschreiben/12")).toBe(false);
    expect(istWerbeseite("/uebergabe/5")).toBe(false);
    expect(istWerbeseite("/login")).toBe(false);
  });

  it("erlaubt die öffentlichen Marken- und Rechtsseiten", () => {
    for (const pfad of [
      "/",
      "/preise",
      "/so-funktionierts",
      "/funktionen",
      "/funktionen/hausgeld",
      "/registrieren",
      "/registrieren/bestaetigt",
      "/datenschutz",
      "/impressum",
      "/agb",
    ]) {
      expect(istWerbeseite(pfad), pfad).toBe(true);
    }
  });

  it("trifft nur ganze Pfadabschnitte, nicht bloße Präfixe", () => {
    expect(istWerbeseite("/preise-intern")).toBe(false);
    expect(istWerbeseite("/registrierungen")).toBe(false);
  });

  it("ignoriert Query und Fragment", () => {
    expect(istWerbeseite("/preise?utm_source=google")).toBe(true);
    expect(istWerbeseite("/dashboard?utm_source=google")).toBe(false);
  });
});

describe("leseEinwilligung", () => {
  const gueltig = JSON.stringify({
    werbung: "erteilt",
    fassung: EINWILLIGUNG_FASSUNG,
    zeitpunkt: "2026-08-11T10:00:00.000Z",
  });

  it("liest eine gültige Entscheidung", () => {
    expect(leseEinwilligung(gueltig)).toEqual({
      werbung: "erteilt",
      fassung: EINWILLIGUNG_FASSUNG,
      zeitpunkt: "2026-08-11T10:00:00.000Z",
    });
  });

  it("gilt als ungefragt, wenn nichts gespeichert ist", () => {
    expect(leseEinwilligung(null)).toBeNull();
    expect(leseEinwilligung("")).toBeNull();
  });

  it("verwirft Unlesbares, statt es als Zustimmung zu deuten", () => {
    expect(leseEinwilligung("kein json")).toBeNull();
    expect(leseEinwilligung("null")).toBeNull();
    expect(leseEinwilligung('"erteilt"')).toBeNull();
    expect(leseEinwilligung(JSON.stringify({ werbung: "vielleicht" }))).toBeNull();
  });

  it("verwirft eine Zustimmung zu einer älteren Fassung", () => {
    // Sonst deckte eine Zustimmung von heute stillschweigend einen Dienst,
    // der erst morgen dazukommt.
    const alt = JSON.stringify({ werbung: "erteilt", fassung: "2020-01-01", zeitpunkt: "" });
    expect(leseEinwilligung(alt)).toBeNull();
  });
});

describe("Widerruf", () => {
  it("erkennt die Cookies von Google Ads", () => {
    expect(istWerbeCookie("_gcl_au")).toBe(true);
    expect(istWerbeCookie("_gcl_aw")).toBe(true);
    expect(istWerbeCookie("_gac_UA-1")).toBe(true);
    expect(istWerbeCookie("bw_session")).toBe(false);
  });

  it("löscht auch auf der registrierbaren Domain", () => {
    // Google setzt auf `.wegportal24.de`; ein Löschversuch nur auf dem Host
    // ginge ins Leere und das Cookie bliebe stehen.
    const domaenen = loeschDomaenen("www.wegportal24.de");
    expect(domaenen).toContain(".wegportal24.de");
    expect(domaenen).toContain("www.wegportal24.de");
    expect(domaenen).toContain(null);
  });

  it("kommt mit localhost zurecht", () => {
    expect(loeschDomaenen("localhost")).toEqual([null, "localhost"]);
  });
});
