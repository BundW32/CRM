import { describe, expect, it } from "vitest";
import { formatMea, leseMea, meaEingabe, meaGewicht, meaGleich, summeMea } from "./mea";

describe("leseMea", () => {
  it("liest ganze Zahlen und bis zu vier Nachkommastellen mit Komma oder Punkt", () => {
    expect(leseMea("205")).toBe(205);
    expect(leseMea("250,17")).toBe(250.17);
    expect(leseMea("25.017")).toBe(25.017);
    expect(leseMea(" 1000 ")).toBe(1000);
    expect(leseMea("0")).toBe(0);
  });
  it("leer ist null, Unsinn ist undefined", () => {
    expect(leseMea("")).toBeNull();
    expect(leseMea(null)).toBeNull();
    expect(leseMea("abc")).toBeUndefined();
    expect(leseMea("-5")).toBeUndefined();
    expect(leseMea("1.000,5")).toBeUndefined();
    expect(leseMea("1,23456")).toBeUndefined();
  });
});

describe("Rechnen", () => {
  it("summiert und vergleicht ohne Fließkomma-Artefakte", () => {
    // 250,17 + 749,83 ist in IEEE-754 nicht exakt 1000.
    expect(summeMea([250.17, 749.83])).toBe(1000);
    expect(meaGleich(summeMea([250.17, 749.83]), 1000)).toBe(true);
    expect(meaGleich(250.17, 250.1701)).toBe(false);
    expect(meaGleich(null, null)).toBe(true);
    expect(meaGleich(null, 1)).toBe(false);
    expect(summeMea([null, 5])).toBe(5);
  });
  it("gewichtet in Zehntausendsteln", () => {
    expect(meaGewicht(250.17)).toBe(2501700);
    expect(meaGewicht(205)).toBe(2050000);
  });
});

describe("Anzeige", () => {
  it("zeigt so viele Stellen wie nötig", () => {
    expect(formatMea(205)).toBe("205");
    expect(formatMea(250.17)).toBe("250,17");
    expect(formatMea(1000)).toBe("1.000");
    expect(formatMea(25.017)).toBe("25,017");
    expect(formatMea(null)).toBe("—");
  });
  it("füllt Eingabefelder ohne Tausenderpunkt", () => {
    expect(meaEingabe(1000)).toBe("1000");
    expect(meaEingabe(250.17)).toBe("250,17");
    expect(meaEingabe(null)).toBe("");
  });
});
