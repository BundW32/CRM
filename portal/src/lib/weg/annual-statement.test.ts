import { describe, expect, it } from "vitest";
import {
  RESERVE_ROW_ID,
  computeLaborShares,
  computePeakAmounts,
  computeStatement,
  splitByOwnership,
  type StatementInput,
} from "./annual-statement";
import type { UnitForDistribution } from "./distribution";

// Testfall aus dem Build-Auftrag: 6 Einheiten, gemischte Schlüssel
const units: UnitForDistribution[] = [
  { id: "we1", mea: 180, livingArea: 72.5, personCount: 2 },
  { id: "we2", mea: 175, livingArea: 70.2, personCount: 1 },
  { id: "we3", mea: 180, livingArea: 72.5, personCount: 3 },
  { id: "we4", mea: 175, livingArea: 70.2, personCount: 2 },
  { id: "we5", mea: 240, livingArea: 96.4, personCount: 4 },
  { id: "te6", mea: 50, livingArea: null, personCount: null },
];

const costTypes = [
  { id: "hausmeister", name: "Hausmeister", distributionKey: "MEA" as const, laborShareType: "HAUSHALTSNAHE_DIENSTLEISTUNG" as const },
  { id: "heizung", name: "Heizung/Warmwasser", distributionKey: "VERBRAUCH" as const, laborShareType: "KEINE" as const },
  { id: "aufzug", name: "Aufzug", distributionKey: "FLAECHE" as const, laborShareType: "HANDWERKERLEISTUNG" as const },
  { id: "konto", name: "Kontoführung", distributionKey: "EINHEITEN" as const, laborShareType: "KEINE" as const },
];

function baseInput(overrides: Partial<StatementInput> = {}): StatementInput {
  return {
    costTypes,
    units,
    expenseByCostType: new Map([
      ["hausmeister", 480_000],
      ["heizung", 620_000],
      ["konto", 12_000],
    ]),
    otherExpenseCents: 0,
    manualAmounts: new Map([
      [
        "heizung",
        new Map([
          ["we1", 110_000],
          ["we2", 80_000],
          ["we3", 130_000],
          ["we4", 100_000],
          ["we5", 200_000],
        ]),
      ],
    ]),
    reserveTransferCents: 0,
    ...overrides,
  };
}

describe("computeStatement", () => {
  it("Summe aller Einzelabrechnungen == Gesamtkosten (centgenau)", () => {
    const r = computeStatement(baseInput());
    expect(r.errors).toEqual([]);
    const sum = [...r.perUnitTotal.values()].reduce((a, b) => a + b, 0);
    expect(sum).toBe(r.totalExpenseCents);
    expect(r.totalExpenseCents).toBe(480_000 + 620_000 + 12_000);
  });

  it("Aufzug (FLAECHE) scheitert am Stellplatz ohne Fläche → Prüffehler, kein Absturz", () => {
    const input = baseInput({
      expenseByCostType: new Map([["aufzug", 90_000]]),
      manualAmounts: new Map(),
    });
    const r = computeStatement(input);
    expect(r.errors).toHaveLength(1);
    expect(r.rows[0].perUnit).toBeNull();
    expect(r.errors[0]).toMatch(/Aufzug/);
  });

  it("manuelle Verteilung muss centgenau der Kostenart entsprechen", () => {
    const input = baseInput();
    input.manualAmounts.get("heizung")!.set("we5", 199_999); // 1 Cent zu wenig
    const r = computeStatement(input);
    expect(r.errors.some((e) => e.includes("Heizung"))).toBe(true);
  });

  it("Ausgaben ohne Kostenart erzeugen einen Prüffehler", () => {
    const r = computeStatement(baseInput({ otherExpenseCents: 5_000 }));
    expect(r.errors.some((e) => e.includes("ohne Kostenart"))).toBe(true);
  });

  it("Rücklagen-Ist wird als eigene MEA-Position verteilt", () => {
    const r = computeStatement(baseInput({ reserveTransferCents: 100_000 }));
    const reserveRow = r.rows.find((row) => row.costTypeId === RESERVE_ROW_ID);
    expect(reserveRow).toBeDefined();
    expect(reserveRow!.perUnit!.get("we5")).toBe(24_000); // 240/1000
    const sum = [...r.perUnitTotal.values()].reduce((a, b) => a + b, 0);
    expect(sum).toBe(r.totalExpenseCents + 100_000);
  });
});

describe("computePeakAmounts (Abrechnungsspitze)", () => {
  it("Nachschuss positiv, Guthaben negativ", () => {
    const peak = computePeakAmounts(
      new Map([
        ["we1", 250_000],
        ["we2", 180_000],
      ]),
      new Map([
        ["we1", 240_000],
        ["we2", 200_000],
      ]),
    );
    expect(peak.get("we1")).toBe(10_000); // Nachschuss
    expect(peak.get("we2")).toBe(-20_000); // Guthaben
  });
});

describe("computeLaborShares (§35a)", () => {
  it("summiert je Einheit nach haushaltsnah/Handwerker", () => {
    const r = computeStatement(baseInput({ expenseByCostType: new Map([["hausmeister", 480_000], ["aufzug", 0]]), manualAmounts: new Map() }));
    const labor = computeLaborShares(r.rows);
    expect(labor.get("we5")?.haushaltsnah).toBe(115_200); // 240/1000 von 480.000
    expect(labor.get("we5")?.handwerker ?? 0).toBe(0);
  });
});

describe("splitByOwnership (Eigentümerwechsel tagesgenau)", () => {
  const fyStart = new Date(Date.UTC(2026, 0, 1));
  const fyEnd = new Date(Date.UTC(2027, 0, 1)); // 365 Tage

  it("Wechsel zum 01.07.: Verkäufer 181 Tage, Käufer 184 Tage, Summe exakt", () => {
    const { shares, uncoveredCents } = splitByOwnership(
      365_000, // 1.000 Cent je Tag → glatt prüfbar
      [
        { userId: "verk", userName: "Verkäufer", validFrom: new Date(Date.UTC(2020, 0, 1)), validTo: new Date(Date.UTC(2026, 6, 1)), sharePercent: 100 },
        { userId: "kauf", userName: "Käufer", validFrom: new Date(Date.UTC(2026, 6, 1)), validTo: null, sharePercent: 100 },
      ],
      fyStart,
      fyEnd,
    );
    expect(uncoveredCents).toBe(0);
    const verk = shares.find((s) => s.userId === "verk")!;
    const kauf = shares.find((s) => s.userId === "kauf")!;
    expect(verk.days).toBe(181);
    expect(kauf.days).toBe(184);
    expect(verk.cents).toBe(181_000);
    expect(kauf.cents).toBe(184_000);
    expect(verk.cents + kauf.cents).toBe(365_000);
  });

  it("Miteigentum 50/50 im ganzen Jahr", () => {
    const { shares, uncoveredCents } = splitByOwnership(
      100_001,
      [
        { userId: "a", userName: "A", validFrom: new Date(Date.UTC(2020, 0, 1)), validTo: null, sharePercent: 50 },
        { userId: "b", userName: "B", validFrom: new Date(Date.UTC(2020, 0, 1)), validTo: null, sharePercent: 50 },
      ],
      fyStart,
      fyEnd,
    );
    expect(uncoveredCents).toBe(0);
    const sum = shares.reduce((s, x) => s + x.cents, 0);
    expect(sum).toBe(100_001);
    expect(Math.abs(shares[0].cents - shares[1].cents)).toBeLessThanOrEqual(1);
  });

  it("Lücke in der Eigentümerschaft → uncoveredCents", () => {
    const { shares, uncoveredCents } = splitByOwnership(
      365_000,
      [
        // nur bis 01.07. erfasst, danach niemand
        { userId: "verk", userName: "V", validFrom: new Date(Date.UTC(2020, 0, 1)), validTo: new Date(Date.UTC(2026, 6, 1)), sharePercent: 100 },
      ],
      fyStart,
      fyEnd,
    );
    expect(shares[0].cents).toBe(181_000);
    expect(uncoveredCents).toBe(184_000);
    expect(shares[0].cents + uncoveredCents).toBe(365_000);
  });

  it("keine Eigentümer erfasst → alles uncovered", () => {
    const { shares, uncoveredCents } = splitByOwnership(500, [], fyStart, fyEnd);
    expect(shares).toEqual([]);
    expect(uncoveredCents).toBe(500);
  });
});
