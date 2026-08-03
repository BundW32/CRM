import { describe, expect, it } from "vitest";
import { co2StepFor, emissionsPerSqm, splitCo2Cost } from "./co2";

describe("emissionsPerSqm", () => {
  it("berechnet den spezifischen Jahresausstoß", () => {
    expect(emissionsPerSqm(4000, 200)).toBe(20);
  });
  it("ist 0 bei fehlender Fläche", () => {
    expect(emissionsPerSqm(4000, 0)).toBe(0);
  });
});

describe("co2StepFor", () => {
  it("trifft die Stufengrenzen (untere einschließlich, obere ausschließlich)", () => {
    expect(co2StepFor(11.9).landlordPct).toBe(0); // < 12
    expect(co2StepFor(12).landlordPct).toBe(10); // 12 bis < 17
    expect(co2StepFor(16.9).landlordPct).toBe(10);
    expect(co2StepFor(17).landlordPct).toBe(20);
    expect(co2StepFor(37).landlordPct).toBe(60);
  });
  it("weist die höchste Stufe ab 52 zu", () => {
    const s = co2StepFor(60);
    expect(s.landlordPct).toBe(95);
    expect(s.tenantPct).toBe(5);
  });
  it("Mieter- + Vermieteranteil ergeben stets 100 %", () => {
    for (const perSqm of [5, 12, 20, 30, 40, 55]) {
      const s = co2StepFor(perSqm);
      expect(s.tenantPct + s.landlordPct).toBe(100);
    }
  });
});

describe("splitCo2Cost", () => {
  it("teilt centgenau (Summe bleibt exakt)", () => {
    // 20 kg/m²/a → Stufe 17..22 → Vermieter 20 %
    const r = splitCo2Cost({ totalCo2Cents: 10000, emissionsKg: 4000, livingAreaSqm: 200 });
    expect(r.step.landlordPct).toBe(20);
    expect(r.landlordCents).toBe(2000);
    expect(r.tenantCents).toBe(8000);
    expect(r.landlordCents + r.tenantCents).toBe(10000);
  });

  it("rundet den Vermieteranteil, Mieteranteil ist der Rest", () => {
    // 37 kg/m²/a → Vermieter 60 %. 12345 * 0.6 = 7407 → Mieter 4938.
    const r = splitCo2Cost({ totalCo2Cents: 12345, emissionsKg: 3700, livingAreaSqm: 100 });
    expect(r.step.landlordPct).toBe(60);
    expect(r.landlordCents).toBe(7407);
    expect(r.tenantCents).toBe(4938);
    expect(r.landlordCents + r.tenantCents).toBe(12345);
  });

  it("legt bei sehr gutem Gebäude alles auf den Mieter (0 % Vermieter)", () => {
    const r = splitCo2Cost({ totalCo2Cents: 5000, emissionsKg: 1000, livingAreaSqm: 100 }); // 10 < 12
    expect(r.landlordCents).toBe(0);
    expect(r.tenantCents).toBe(5000);
  });
});
