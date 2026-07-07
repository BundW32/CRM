import { describe, expect, it } from "vitest";
import { computeOutcome, weightFor, type WeightedVote } from "./weg-voting";

// Kürzel für gewichtete Stimmen.
const v = (choice: WeightedVote["choice"], weight = 1, missingWeight = false): WeightedVote => ({
  choice,
  weight,
  missingWeight,
});

describe("computeOutcome – EINFACH", () => {
  it("angenommen, wenn mehr Ja als Nein (Enthaltungen zählen nicht)", () => {
    const r = computeOutcome({ majority: "EINFACH", votes: [v("JA"), v("JA"), v("NEIN"), v("ENTHALTUNG")] });
    expect(r.suggestion).toBe("ANGENOMMEN");
  });
  it("abgelehnt bei Gleichstand", () => {
    expect(computeOutcome({ majority: "EINFACH", votes: [v("JA"), v("NEIN")] }).suggestion).toBe("ABGELEHNT");
  });
});

describe("computeOutcome – DREIVIERTEL", () => {
  it("exakt 3/4 → angenommen (3 Ja, 1 Nein)", () => {
    expect(computeOutcome({ majority: "DREIVIERTEL", votes: [v("JA"), v("JA"), v("JA"), v("NEIN")] }).suggestion).toBe(
      "ANGENOMMEN",
    );
  });
  it("knapp unter 3/4 → abgelehnt (2 Ja, 1 Nein)", () => {
    expect(computeOutcome({ majority: "DREIVIERTEL", votes: [v("JA"), v("JA"), v("NEIN")] }).suggestion).toBe(
      "ABGELEHNT",
    );
  });
});

describe("computeOutcome – DOPPELT_QUALIFIZIERT", () => {
  it("exakt 2/3 der Stimmen → abgelehnt (Grenze ist >, nicht >=)", () => {
    // 2 Ja / 1 Nein = genau 2/3 → NICHT über 2/3.
    const r = computeOutcome({
      majority: "DOPPELT_QUALIFIZIERT",
      votes: [v("JA", 100), v("JA", 100), v("NEIN", 100)],
      meaJa: 200,
      meaTotal: 300,
    });
    expect(r.suggestion).toBe("ABGELEHNT");
  });
  it("über 2/3 der Stimmen UND über die Hälfte aller MEA → angenommen", () => {
    const r = computeOutcome({
      majority: "DOPPELT_QUALIFIZIERT",
      votes: [v("JA", 300), v("JA", 300), v("JA", 300), v("NEIN", 100)],
      meaJa: 900,
      meaTotal: 1000,
    });
    expect(r.suggestion).toBe("ANGENOMMEN");
  });
  it("MEA-Hälfte exakt erreicht → abgelehnt (Grenze ist >, nicht >=)", () => {
    const r = computeOutcome({
      majority: "DOPPELT_QUALIFIZIERT",
      votes: [v("JA", 500), v("NEIN", 0)],
      meaJa: 500,
      meaTotal: 1000,
    });
    expect(r.suggestion).toBe("ABGELEHNT");
  });
  it("unvollständige MEA-Pflege → unzuverlässig", () => {
    const r = computeOutcome({
      majority: "DOPPELT_QUALIFIZIERT",
      votes: [v("JA", 600), v("NEIN", 100)],
      meaJa: 600,
      meaTotal: 700,
      meaIncomplete: true,
    });
    expect(r.reliable).toBe(false);
    expect(r.warnings.join(" ")).toMatch(/MEA/);
  });
});

describe("computeOutcome – ALLSTIMMIG (Köpfe, nicht Gewichte)", () => {
  const full = { eligibleCount: 2, ballotsCast: 2 };
  it("ein Nein mit Gewicht 0 verhindert Allstimmigkeit", () => {
    const r = computeOutcome({
      majority: "ALLSTIMMIG",
      votes: [v("JA", 500), v("NEIN", 0)],
      ...full,
    });
    expect(r.suggestion).toBe("ABGELEHNT");
  });
  it("eine Enthaltung verhindert Allstimmigkeit", () => {
    const r = computeOutcome({
      majority: "ALLSTIMMIG",
      votes: [v("JA", 100), v("ENTHALTUNG", 100)],
      ...full,
    });
    expect(r.suggestion).toBe("ABGELEHNT");
  });
  it("alle Ja bei voller Beteiligung → angenommen", () => {
    const r = computeOutcome({
      majority: "ALLSTIMMIG",
      votes: [v("JA", 1), v("JA", 1)],
      ...full,
    });
    expect(r.suggestion).toBe("ANGENOMMEN");
  });
  it("nicht vollständige Beteiligung → abgelehnt und unsicher", () => {
    const r = computeOutcome({
      majority: "ALLSTIMMIG",
      votes: [v("JA", 1)],
      eligibleCount: 2,
      ballotsCast: 1,
    });
    expect(r.suggestion).toBe("ABGELEHNT");
    expect(r.reliable).toBe(false);
  });
  it("fehlendes Stimmgewicht macht ALLSTIMMIG NICHT unzuverlässig (Köpfe zählen)", () => {
    const r = computeOutcome({
      majority: "ALLSTIMMIG",
      votes: [v("JA", 0, true), v("JA", 0, true)],
      ...full,
    });
    expect(r.suggestion).toBe("ANGENOMMEN");
    expect(r.reliable).toBe(true);
  });
});

describe("computeOutcome – missing weight", () => {
  it("fehlendes Gewicht bei gewichteter Mehrheit → unzuverlässig", () => {
    const r = computeOutcome({
      majority: "EINFACH",
      votes: [v("JA", 0, true), v("NEIN", 1)],
    });
    expect(r.reliable).toBe(false);
  });
});

describe("weightFor", () => {
  it("KOPF → immer Gewicht 1", () => {
    expect(weightFor("KOPF", { mea: null, voteUnits: null })).toEqual({ weight: 1, missing: false });
  });
  it("MEA → mea, missing wenn null", () => {
    expect(weightFor("MEA", { mea: 250, voteUnits: null })).toEqual({ weight: 250, missing: false });
    expect(weightFor("MEA", { mea: null, voteUnits: null })).toEqual({ weight: 0, missing: true });
  });
  it("OBJEKT → voteUnits, missing wenn null", () => {
    expect(weightFor("OBJEKT", { mea: null, voteUnits: 2 })).toEqual({ weight: 2, missing: false });
    expect(weightFor("OBJEKT", { mea: null, voteUnits: null })).toEqual({ weight: 0, missing: true });
  });
});
