import { describe, expect, it } from "vitest";
import { toDateInputValue } from "@/components/fields";

describe("toDateInputValue", () => {
  it("nimmt das lokale Datum, nicht das UTC-Datum", () => {
    // 1. März, kurz vor Mitternacht Ortszeit. `toISOString().slice(0, 10)` – der
    // Griff, der überall im Bestand stand – macht daraus in deutscher Zeitzone den
    // 28. Februar. Genau dieser Tagesversatz ist der Grund für den Helfer.
    expect(toDateInputValue(new Date(2026, 2, 1, 23, 30))).toBe("2026-03-01");
  });

  it("füllt Monat und Tag auf zwei Stellen auf", () => {
    expect(toDateInputValue(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("lässt das Feld ohne Wert leer, statt ein Datum zu erfinden", () => {
    expect(toDateInputValue(null)).toBeUndefined();
    expect(toDateInputValue(undefined)).toBeUndefined();
  });
});
