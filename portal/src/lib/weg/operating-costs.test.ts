import { describe, expect, it } from "vitest";
import { computeOperatingCosts } from "./operating-costs";

const rows = [
  { name: "Hausmeister", unitShareCents: 30000, recoverable: true, totalCents: 30000 * 10, keyLabel: "MEA" },
  { name: "Wasser/Abwasser", unitShareCents: 12000, recoverable: true, totalCents: 12000 * 10, keyLabel: "MEA" },
  { name: "Heizung/Warmwasser", unitShareCents: 50000, recoverable: true, totalCents: 50000 * 10, keyLabel: "MEA" },
  { name: "Verwaltungskosten", unitShareCents: 8000, recoverable: false, totalCents: 8000 * 10, keyLabel: "MEA" },
  { name: "Laufende Instandhaltung", unitShareCents: 15000, recoverable: false, totalCents: 15000 * 10, keyLabel: "MEA" },
];

describe("computeOperatingCosts", () => {
  it("trennt umlagefähig von nicht umlagefähig", () => {
    const r = computeOperatingCosts({ rows, prepaymentCents: 0 });
    expect(r.recoverableRows.map((x) => x.name)).toEqual(["Hausmeister", "Wasser/Abwasser", "Heizung/Warmwasser"]);
    expect(r.nonRecoverableRows.map((x) => x.name)).toEqual(["Verwaltungskosten", "Laufende Instandhaltung"]);
    expect(r.recoverableSumCents).toBe(92000); // 30000+12000+50000
  });

  it("zieht den Vermieter-CO2-Anteil vom Mieter ab", () => {
    const r = computeOperatingCosts({ rows, co2LandlordDeductionCents: 4000, prepaymentCents: 0 });
    expect(r.co2LandlordDeductionCents).toBe(4000);
    expect(r.tenantCostsCents).toBe(88000); // 92000 - 4000
  });

  it("berechnet Nachzahlung (+) und Guthaben (−) gegen die Vorauszahlung", () => {
    const nach = computeOperatingCosts({ rows, prepaymentCents: 80000 });
    expect(nach.balanceCents).toBe(12000); // 92000 - 80000 → Nachzahlung
    const gut = computeOperatingCosts({ rows, prepaymentCents: 100000 });
    expect(gut.balanceCents).toBe(-8000); // Guthaben
  });

  it("begrenzt den CO2-Abzug auf die umlagefähige Summe (kein negativer Mieteranteil)", () => {
    const r = computeOperatingCosts({ rows, co2LandlordDeductionCents: 999999, prepaymentCents: 0 });
    expect(r.co2LandlordDeductionCents).toBe(92000);
    expect(r.tenantCostsCents).toBe(0);
  });

  it("ignoriert negative CO2-Abzüge", () => {
    const r = computeOperatingCosts({ rows, co2LandlordDeductionCents: -50, prepaymentCents: 0 });
    expect(r.co2LandlordDeductionCents).toBe(0);
    expect(r.tenantCostsCents).toBe(92000);
  });
});
