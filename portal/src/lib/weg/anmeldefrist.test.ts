import { describe, expect, it } from "vitest";
import {
  anmeldefrist,
  anmeldemonat,
  bundesfeiertage,
  fristlage,
  istWerktag,
  ostersonntag,
} from "./anmeldefrist";

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

describe("Ostersonntag", () => {
  // Gegengeprüft an veröffentlichten Kalendern, nicht an der eigenen Formel.
  it.each([
    [2024, "2024-03-31"],
    [2025, "2025-04-20"],
    [2026, "2026-04-05"],
    [2027, "2027-03-28"],
    [2029, "2029-04-01"],
    [2038, "2038-04-25"], // spätestmöglicher Termin im Beispielzeitraum
  ])("%i", (jahr, erwartet) => {
    expect(iso(ostersonntag(jahr))).toBe(erwartet);
  });
});

describe("Anmeldefrist (§ 48a Abs. 1 EStG)", () => {
  it("ist der 10. des Folgemonats", () => {
    // 15.03.2026 gezahlt → 10.04.2026. Das ist ein Freitag, also unverschoben.
    expect(iso(anmeldefrist(new Date(2026, 2, 15)))).toBe("2026-04-10");
  });

  it("rollt über den Jahreswechsel", () => {
    // Dezember-Zahlung → Januar des Folgejahres. Der 10.01.2027 ist ein Sonntag,
    // also weiter auf Montag (§ 108 Abs. 3 AO).
    expect(iso(anmeldefrist(new Date(2026, 11, 31)))).toBe("2027-01-11");
  });

  it("schiebt vom Samstag auf den Montag", () => {
    // 10.10.2026 ist ein Samstag.
    expect(iso(anmeldefrist(new Date(2026, 8, 2)))).toBe("2026-10-12");
  });

  it("schiebt über einen Feiertag hinweg", () => {
    // Karfreitag fällt 2026 auf den 03.04. — der 10.04. ist frei. Prüfen wir
    // stattdessen 2020: Karfreitag war der 10.04.2020, danach kommt Ostern,
    // Ostermontag ist der 13.04. → erster Werktag ist Dienstag, der 14.04.
    expect(iso(anmeldefrist(new Date(2020, 2, 20)))).toBe("2020-04-14");
  });

  it("schiebt über Christi Himmelfahrt", () => {
    // 2029: Ostern 01.04., Christi Himmelfahrt = Ostern + 39 = 10.05.2029
    // (ein Donnerstag). Also weiter auf Freitag, den 11.05.
    expect(iso(anmeldefrist(new Date(2029, 3, 12)))).toBe("2029-05-11");
  });

  it("nennt den Monat der Zahlung, nicht den der Frist", () => {
    expect(anmeldemonat(new Date(2026, 11, 31))).toBe("2026-12");
  });
});

describe("Werktag", () => {
  it("erkennt Wochenende und bundeseinheitlichen Feiertag", () => {
    expect(istWerktag(new Date(2026, 9, 10))).toBe(false); // Samstag
    expect(istWerktag(new Date(2026, 9, 11))).toBe(false); // Sonntag
    expect(istWerktag(new Date(2026, 9, 3))).toBe(false); // Tag der Deutschen Einheit
    expect(istWerktag(new Date(2026, 9, 12))).toBe(true); // Montag
  });

  it("führt Landesfeiertage bewusst nicht", () => {
    // Fronleichnam 2026 = 04.06. Gilt nicht bundesweit; das Programm behandelt
    // ihn deshalb als Werktag und warnt damit höchstens einen Tag zu früh.
    const feiertage = bundesfeiertage(2026).map(iso);
    expect(feiertage).not.toContain("2026-06-04");
    expect(feiertage).toHaveLength(9);
  });
});

describe("Fristlage", () => {
  const frist = new Date(2026, 3, 10);

  it("ist am Fristtag selbst noch nicht überfällig", () => {
    // § 108 Abs. 1 AO i. V. m. § 188 Abs. 1 BGB: die Frist endet mit **Ablauf**
    // des Tages. Ein „überfällig" am Vormittag wäre schlicht falsch.
    expect(fristlage(frist, new Date(2026, 3, 10))).toBe("BALD");
  });

  it("wird am Folgetag überfällig", () => {
    expect(fristlage(frist, new Date(2026, 3, 11))).toBe("UEBERFAELLIG");
  });

  it("meldet sich sieben Tage vorher", () => {
    expect(fristlage(frist, new Date(2026, 3, 3))).toBe("BALD");
    expect(fristlage(frist, new Date(2026, 3, 2))).toBe("OFFEN");
  });
});
