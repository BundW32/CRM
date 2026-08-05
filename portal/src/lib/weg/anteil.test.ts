import { describe, expect, it } from "vitest";
import { anteilSummeStatus, namensSchluessel, parseAnteil } from "./anteil";

describe("parseAnteil", () => {
  it("nimmt 100 % an, wenn nichts dasteht", () => {
    expect(parseAnteil(null)).toBe(100);
    expect(parseAnteil("")).toBe(100);
    expect(parseAnteil("   ")).toBe(100);
  });

  it("liest das deutsche Dezimalkomma", () => {
    expect(parseAnteil("33,33")).toBe(33.33);
    expect(parseAnteil("50.5")).toBe(50.5);
  });

  it("fällt bei unbrauchbaren Werten auf 100 zurück statt sie durchzureichen", () => {
    // Ein negativer oder zu großer Anteil würde die Summenprüfung still
    // unbrauchbar machen — dann lieber der sichtbare Vorgabewert.
    for (const roh of ["0", "-5", "101", "abc", "1e999"]) {
      expect(parseAnteil(roh)).toBe(100);
    }
  });

  it("rundet auf zwei Nachkommastellen", () => {
    expect(parseAnteil("33,333333")).toBe(33.33);
  });
});

describe("anteilSummeStatus", () => {
  it("erkennt die vollständige Einheit", () => {
    expect(anteilSummeStatus([50, 50]).vollstaendig).toBe(true);
    expect(anteilSummeStatus([100]).vollstaendig).toBe(true);
  });

  it("erkennt die Überzeichnung — der Fall, der den MEA verdoppelt hat", () => {
    const s = anteilSummeStatus([100, 100]);
    expect(s.summe).toBe(200);
    expect(s.ueberzeichnet).toBe(true);
    expect(s.vollstaendig).toBe(false);
  });

  it("meldet einen Zwischenstand nicht als Überzeichnung", () => {
    expect(anteilSummeStatus([50]).ueberzeichnet).toBe(false);
  });

  it("rechnet Drittel ohne Fließkomma-Rauschen", () => {
    expect(anteilSummeStatus([33.33, 33.33, 33.34]).summe).toBe(100);
  });
});

describe("namensSchluessel", () => {
  it("erkennt dieselbe Person trotz Schreibweise", () => {
    expect(namensSchluessel("Thomas", "Berger")).toBe(namensSchluessel(" thomas ", "BERGER"));
  });

  it("normalisiert Umlaute", () => {
    expect(namensSchluessel("Jörg", "Müller")).toBe("joerg mueller");
  });

  it("hält verschiedene Namen auseinander", () => {
    expect(namensSchluessel("Thomas", "Berger")).not.toBe(namensSchluessel("Tomas", "Berger"));
  });
});
