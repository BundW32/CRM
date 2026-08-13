import { describe, expect, it } from "vitest";
import {
  RESERVE_ROW_ID,
  RESERVE_WITHDRAWAL_ROW_ID,
  computeLaborShares,
  computePeakAmounts,
  computeStatement,
  splitByOwnership,
  type StatementInput,
} from "./annual-statement";
import type { UnitForDistribution } from "./distribution";
import { monthlyInstallmentPlan } from "./economic-plan";

// Testfall aus dem Build-Auftrag: 6 Einheiten, gemischte Schlüssel
const units: UnitForDistribution[] = [
  { id: "we1", label: "we1", mea: 180, livingArea: 72.5, personCount: 2, unitType: "WOHNUNG" as const },
  { id: "we2", label: "we2", mea: 175, livingArea: 70.2, personCount: 1, unitType: "WOHNUNG" as const },
  { id: "we3", label: "we3", mea: 180, livingArea: 72.5, personCount: 3, unitType: "WOHNUNG" as const },
  { id: "we4", label: "we4", mea: 175, livingArea: 70.2, personCount: 2, unitType: "WOHNUNG" as const },
  { id: "we5", label: "we5", mea: 240, livingArea: 96.4, personCount: 4, unitType: "WOHNUNG" as const },
  { id: "te6", label: "te6", mea: 50, livingArea: null, personCount: null, unitType: "STELLPLATZ" as const },
];

const B = "BETRIEBSKOSTEN" as const;

const costTypes = [
  { id: "hausmeister", name: "Hausmeister", category: B, distributionKey: "MEA" as const, laborShareType: "HAUSHALTSNAHE_DIENSTLEISTUNG" as const },
  { id: "heizung", name: "Heizung/Warmwasser", category: B, distributionKey: "VERBRAUCH" as const, laborShareType: "KEINE" as const },
  { id: "aufzug", name: "Aufzug", category: B, distributionKey: "FLAECHE" as const, laborShareType: "HANDWERKERLEISTUNG" as const },
  { id: "konto", name: "Kontoführung", category: B, distributionKey: "EINHEITEN" as const, laborShareType: "KEINE" as const },
  { id: "dach", name: "Dachsanierung", category: "INSTANDHALTUNG" as const, distributionKey: "MEA" as const, laborShareType: "HANDWERKERLEISTUNG" as const },
  { id: "zufuehrung", name: "Zuführung Erhaltungsrücklage", category: "RUECKLAGENZUFUEHRUNG" as const, distributionKey: "MEA" as const, laborShareType: "KEINE" as const },
  { id: "pv", name: "PV-Einspeisung", category: "ERTRAG" as const, distributionKey: "MEA" as const, laborShareType: "KEINE" as const },
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

  it("Aufzug (FLAECHE): der Stellplatz ohne Fläche trägt 0, statt die Abrechnung zu blockieren", () => {
    const input = baseInput({
      expenseByCostType: new Map([["aufzug", 90_000]]),
      manualAmounts: new Map(),
    });
    const r = computeStatement(input);
    expect(r.errors).toEqual([]);
    const row = r.rows.find((x) => x.costTypeId === "aufzug");
    expect(row?.perUnit?.get("te6")).toBe(0);
    expect([...(row?.perUnit ?? new Map()).values()].reduce((a, b) => a + b, 0)).toBe(90_000);
  });

  it("FLAECHE scheitert weiter an einer WOHNUNG ohne Fläche — mit Namen", () => {
    const input = baseInput({
      units: [...units, { id: "we7", label: "WE 07", mea: 100, livingArea: null, personCount: 1, unitType: "WOHNUNG" as const }],
      expenseByCostType: new Map([["aufzug", 90_000]]),
      manualAmounts: new Map(),
    });
    const r = computeStatement(input);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatch(/Aufzug/);
    expect(r.errors[0]).toMatch(/WE 07/);
  });

  it("Kontoführung (EINHEITEN): Stellplätze zählen nicht als Einheit", () => {
    const input = baseInput({
      expenseByCostType: new Map([["konto", 12_000]]),
      manualAmounts: new Map(),
    });
    const r = computeStatement(input);
    expect(r.errors).toEqual([]);
    const row = r.rows.find((x) => x.costTypeId === "konto");
    // 5 Wohneinheiten à 2.400 — der Stellplatz te6 trägt nichts.
    expect(row?.perUnit?.get("te6")).toBe(0);
    expect(row?.perUnit?.get("we1")).toBe(2_400);
  });

  it("JE_STELLPLATZ verteilt in der Abrechnung ausschließlich auf Stellplätze", () => {
    const input = baseInput({
      costTypes: [
        ...costTypes,
        { id: "tor", name: "Garagentor", category: B, distributionKey: "JE_STELLPLATZ" as const, laborShareType: "KEINE" as const },
      ],
      expenseByCostType: new Map([["tor", 45_600]]),
      manualAmounts: new Map(),
    });
    const r = computeStatement(input);
    expect(r.errors).toEqual([]);
    const row = r.rows.find((x) => x.costTypeId === "tor");
    expect(row?.perUnit?.get("te6")).toBe(45_600);
    expect(row?.perUnit?.get("we1")).toBe(0);
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

  // Die Prüfung „Summe der Einzelabrechnungen == Gesamtkosten" ist bei einer
  // leeren Abrechnung 0 == 0. Sie besteht also — und die Seite meldete daraufhin
  // „Verteilung vollständig und centgenau" für ein Jahr ohne eine einzige
  // Buchung. Genau diesen Fall trennt `hatPositionen` ab.
  it("meldet eine leere Abrechnung als solche, statt sie zu bestätigen", () => {
    const r = computeStatement(
      baseInput({ expenseByCostType: new Map(), manualAmounts: new Map() }),
    );
    // Rechnerisch ist nichts zu beanstanden – und genau das ist die Falle.
    expect(r.errors).toEqual([]);
    expect(r.totalExpenseCents).toBe(0);
    expect(r.hatPositionen).toBe(false);
  });

  it("zählt eine Kostenart ohne Betrag nicht als Position", () => {
    // Kostenarten stehen im Katalog, auch wenn im Jahr nichts darauf gebucht
    // wurde. Eine Zeile mit 0 € ist deshalb keine Position.
    const r = computeStatement(
      baseInput({ expenseByCostType: new Map([["hausmeister", 0]]), manualAmounts: new Map() }),
    );
    expect(r.hatPositionen).toBe(false);
  });

  it("erkennt eine reine Rücklagenzuführung als Position", () => {
    // Ein Jahr, in dem nur in die Rücklage umgebucht wurde, ist nicht leer –
    // es wurde Geld bewegt und es wird etwas verteilt.
    const r = computeStatement(
      baseInput({
        expenseByCostType: new Map(),
        manualAmounts: new Map(),
        reserveTransferCents: 100_000,
      }),
    );
    expect(r.hatPositionen).toBe(true);
  });

  it("bestätigt eine gefüllte Abrechnung weiterhin", () => {
    expect(computeStatement(baseInput()).hatPositionen).toBe(true);
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

  it("die Überdeckung der gerundeten Monatsrate kommt als Guthaben zurück", () => {
    // Der stille Fehler, den diese Prüfung ausschließt: gegen den *geplanten*
    // Jahresvorschuss zu rechnen statt gegen das gestellte Soll. Bei
    // aufgerundeten Raten sind das zwei verschiedene Zahlen — die Überdeckung
    // verschwände dann spurlos, und der Eigentümer bekäme sein Guthaben nie.
    //
    // `duePerUnit` kommt in `computeStatementView` aus den DuePosting-Zeilen
    // des Jahres, also aus dem, was tatsächlich gestellt wurde. Genau das wird
    // hier nachgestellt: Plan 3.000,36 €, gestellt 12 × 250,10 € = 3.001,20 €.
    const raten = monthlyInstallmentPlan(300_036, "ZEHN_CENT");
    const kostenanteil = 300_036; // Kosten treffen den Plan punktgenau
    const peak = computePeakAmounts(
      new Map([["we1", kostenanteil]]),
      new Map([["we1", raten.billedCents]]),
    );
    expect(peak.get("we1")).toBe(-raten.overpayCents);
    expect(peak.get("we1")).toBe(-84);
  });
});

describe("computeLaborShares (§35a)", () => {
  const nurHausmeister = (labor?: Map<string, { baseCents: number; unerfasstCents: number }>) =>
    computeStatement(
      baseInput({
        expenseByCostType: new Map([["hausmeister", 480_000], ["aufzug", 0]]),
        manualAmounts: new Map(),
        laborByCostType: labor,
      }),
    );

  it("weist den Lohnanteil aus, nicht den Bruttobetrag", () => {
    // 480.000 Cent Hausmeisterkosten, davon 300.000 Lohn. we5 trägt 240/1000.
    const r = nurHausmeister(new Map([["hausmeister", { baseCents: 300_000, unerfasstCents: 0 }]]));
    const labor = computeLaborShares(r.rows);
    expect(labor.get("we5")?.haushaltsnah).toBe(72_000); // 240/1000 von 300.000
    expect(labor.get("we5")?.handwerker ?? 0).toBe(0);
    expect(labor.get("we5")?.unerfasst ?? 0).toBe(0);
  });

  it("verteilt den Lohnanteil centgenau — Σ Einheiten == Lohnanteil", () => {
    const r = nurHausmeister(new Map([["hausmeister", { baseCents: 100_001, unerfasstCents: 0 }]]));
    const labor = computeLaborShares(r.rows);
    const summe = [...labor.values()].reduce((a, l) => a + l.haushaltsnah, 0);
    expect(summe).toBe(100_001);
  });

  it("weist ohne erfassten Lohnanteil NICHTS aus, sondern die Lücke", () => {
    // Der eigentliche Befund: vorher stand hier der volle Bruttobetrag.
    const r = nurHausmeister();
    const labor = computeLaborShares(r.rows);
    expect(labor.get("we5")?.haushaltsnah ?? 0).toBe(0);
    expect(labor.get("we5")?.unerfasst).toBe(115_200); // 240/1000 von 480.000
  });

  it("führt erfassten Anteil und Lücke derselben Position nebeneinander", () => {
    const r = nurHausmeister(
      new Map([["hausmeister", { baseCents: 200_000, unerfasstCents: 80_000 }]]),
    );
    const labor = computeLaborShares(r.rows);
    expect(labor.get("we5")?.haushaltsnah).toBe(48_000); // 240/1000 von 200.000
    expect(labor.get("we5")?.unerfasst).toBe(19_200); // 240/1000 von 80.000
  });

  it("ignoriert Positionen, die vollständig aus der Rücklage bezahlt wurden", () => {
    // Nicht umgelegt heißt: niemand trägt sie, also kann sie auch niemand absetzen.
    const r = computeStatement(
      baseInput({
        expenseByCostType: new Map(),
        reserveSpendByCostType: new Map([["dach", 500_000]]),
        manualAmounts: new Map(),
        laborByCostType: new Map([["dach", { baseCents: 0, unerfasstCents: 0 }]]),
      }),
    );
    const labor = computeLaborShares(r.rows);
    expect([...labor.values()].reduce((a, l) => a + l.handwerker + l.unerfasst, 0)).toBe(0);
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

// ── Erhaltungsrücklage (Befunde A2/A3) ──────────────────────────────────────

describe("Ausgaben aus der Erhaltungsrücklage", () => {
  it("erhöhen die Abrechnungsspitze nicht — sonst zahlen Eigentümer doppelt", () => {
    const ohne = computeStatement(baseInput());
    const mit = computeStatement(
      baseInput({ reserveSpendByCostType: new Map([["dach", 8_000_000]]) }),
    );
    // Kostenanteil je Einheit bleibt unverändert
    for (const [unitId, cents] of ohne.perUnitTotal) {
      expect(mit.perUnitTotal.get(unitId)).toBe(cents);
    }
    expect(mit.errors).toEqual([]);
  });

  it("erscheinen trotzdem als Ausgabe und bekommen eine Gegenposition", () => {
    const r = computeStatement(
      baseInput({ reserveSpendByCostType: new Map([["dach", 8_000_000]]) }),
    );
    const dach = r.rows.find((x) => x.costTypeId === "dach");
    expect(dach?.totalCents).toBe(8_000_000);
    expect(dach?.reserveFundedCents).toBe(8_000_000);
    expect(r.reserveWithdrawalCents).toBe(8_000_000);
    expect(r.rows.some((x) => x.costTypeId === RESERVE_WITHDRAWAL_ROW_ID)).toBe(true);
    // Ausgabe zählt zur Gesamtsumme, wird aber nicht verteilt
    expect(dach?.perUnit && [...dach.perUnit.values()].reduce((a, b) => a + b, 0)).toBe(0);
  });

  it("teilweise aus der Rücklage bezahlt: nur der Rest wird umgelegt", () => {
    const r = computeStatement(
      baseInput({
        expenseByCostType: new Map([["hausmeister", 300_000]]),
        manualAmounts: new Map(),
        reserveSpendByCostType: new Map([["hausmeister", 180_000]]),
      }),
    );
    const row = r.rows.find((x) => x.costTypeId === "hausmeister");
    expect(row?.totalCents).toBe(480_000);
    expect(row?.reserveFundedCents).toBe(180_000);
    const verteilt = [...(row?.perUnit ?? new Map()).values()].reduce((a, b) => a + b, 0);
    expect(verteilt).toBe(300_000);
  });
});

describe("Zuführung zur Erhaltungsrücklage", () => {
  it("folgt dem Schlüssel des Wirtschaftsplans, nicht fest MEA", () => {
    const nachFlaeche = computeStatement(
      baseInput({ reserveTransferCents: 600_000, reserveTransferKey: "FLAECHE" }),
    );
    const nachMea = computeStatement(
      baseInput({ reserveTransferCents: 600_000, reserveTransferKey: "MEA" }),
    );
    const zeileF = nachFlaeche.rows.find((x) => x.costTypeId === RESERVE_ROW_ID);
    const zeileM = nachMea.rows.find((x) => x.costTypeId === RESERVE_ROW_ID);
    expect(zeileF?.distributionKey).toBe("FLAECHE");
    // Der Stellplatz ohne Wohnfläche trägt nach Fläche nichts, nach MEA schon
    expect(zeileF?.perUnit?.get("te6")).toBe(0);
    expect(zeileM?.perUnit?.get("te6")).toBeGreaterThan(0);
    // centgenau bleibt beides
    for (const z of [zeileF, zeileM]) {
      expect([...(z?.perUnit ?? new Map()).values()].reduce((a, b) => a + b, 0)).toBe(600_000);
    }
  });

  it("wird nicht doppelt gezählt, wenn sie auch als Kostenart gebucht wurde", () => {
    const r = computeStatement(
      baseInput({
        expenseByCostType: new Map([["zufuehrung", 600_000]]),
        manualAmounts: new Map(),
        reserveTransferCents: 600_000,
      }),
    );
    // Nur die Ist-Umbuchung zählt, die Aufwandsposition wird übersprungen
    expect(r.rows.filter((x) => x.name.includes("Erhaltungsrücklage")).length).toBe(1);
    const summe = [...r.perUnitTotal.values()].reduce((a, b) => a + b, 0);
    expect(summe).toBe(600_000);
  });

  it("meldet eine Abweichung vom Plan als Hinweis, nicht als Fehler", () => {
    const vergessen = computeStatement(
      baseInput({ reserveTransferCents: 0, plannedReserveCents: 600_000 }),
    );
    expect(vergessen.warnings).toHaveLength(1);
    expect(vergessen.warnings[0]).toContain("Erhaltungsrücklage");
    expect(vergessen.errors).toEqual([]); // blockiert das Fertigstellen nicht

    const passend = computeStatement(
      baseInput({ reserveTransferCents: 600_000, plannedReserveCents: 600_000 }),
    );
    expect(passend.warnings).toEqual([]);
  });
});

// ── Einnahmen in der Abrechnung (Befund B7a) ────────────────────────────────

describe("Ist-Einnahmen mit Ertrags-Kostenart", () => {
  it("mindern den Kostenanteil je Einheit", () => {
    const ohne = computeStatement(baseInput());
    const mit = computeStatement(baseInput({ incomeByCostType: new Map([["pv", 240_000]]) }));
    const summeOhne = [...ohne.perUnitTotal.values()].reduce((a, b) => a + b, 0);
    const summeMit = [...mit.perUnitTotal.values()].reduce((a, b) => a + b, 0);
    expect(summeOhne - summeMit).toBe(240_000);
    expect(mit.errors).toEqual([]);
  });

  it("erscheinen als eigene Position mit negativem Betrag", () => {
    const r = computeStatement(baseInput({ incomeByCostType: new Map([["pv", 240_000]]) }));
    const zeile = r.rows.find((x) => x.costTypeId === "pv");
    expect(zeile?.totalCents).toBe(-240_000);
    expect(zeile?.name).toContain("Einnahme");
    expect([...(zeile?.perUnit ?? new Map()).values()].reduce((a, b) => a + b, 0)).toBe(-240_000);
  });

  it("erzeugen keine negative Null", () => {
    const r = computeStatement(baseInput({ incomeByCostType: new Map([["pv", 0]]) }));
    for (const zeile of r.rows) {
      for (const cents of zeile.perUnit?.values() ?? []) {
        expect(Object.is(cents, -0)).toBe(false);
      }
    }
  });
});
