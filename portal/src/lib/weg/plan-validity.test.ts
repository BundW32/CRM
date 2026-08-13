import { describe, expect, it } from "vitest";
import { monthlyInstallmentPlan } from "./economic-plan";
import { faelligkeitFuer, faelligkeitsText, sollMonate, sollHorizont } from "./plan-validity";

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

describe("faelligkeitFuer", () => {
  it("Monatserster", () => {
    expect(faelligkeitFuer({ year: 2026, month: 3 }, "MONATSERSTER", null)).toEqual(utc(2026, 3, 1));
  });

  it("dritter Werktag überspringt Wochenenden", () => {
    // August 2026: 1. = Samstag, 2. = Sonntag → Werktage 3./4./5.
    expect(faelligkeitFuer({ year: 2026, month: 8 }, "DRITTER_WERKTAG", null)).toEqual(utc(2026, 8, 5));
    // Januar 2026: 1. = Donnerstag → Werktage 1./2./5. (3.+4. sind Wochenende)
    expect(faelligkeitFuer({ year: 2026, month: 1 }, "DRITTER_WERKTAG", null)).toEqual(utc(2026, 1, 5));
  });

  it("freier Tag, begrenzt auf den 28.", () => {
    expect(faelligkeitFuer({ year: 2026, month: 2 }, "FREIER_TAG", 15)).toEqual(utc(2026, 2, 15));
    // Ein „31." gäbe es im Februar nicht — die Grenze verhindert genau das.
    expect(faelligkeitFuer({ year: 2026, month: 2 }, "FREIER_TAG", 31)).toEqual(utc(2026, 2, 28));
  });

  it("der Text nennt denselben Termin wie die Berechnung", () => {
    expect(faelligkeitsText("MONATSERSTER", null)).toContain("Ersten");
    expect(faelligkeitsText("DRITTER_WERKTAG", null)).toContain("dritten Werktag");
    expect(faelligkeitsText("FREIER_TAG", 15)).toContain("15.");
  });
});

describe("sollMonate (Fortgeltung, § 28 Abs. 1 Satz 2 WEG)", () => {
  const kalenderjahr = 1;

  it("deckt zwölf Monate ab, solange ein Nachfolger die Geltung beendet", () => {
    const m = sollMonate(
      { validFrom: utc(2026, 1, 1), validUntil: utc(2027, 1, 1), year: 2026 },
      kalenderjahr,
      utc(2030, 1, 1),
    );
    expect(m).toHaveLength(12);
    expect(m[0]).toMatchObject({ year: 2026, month: 1, rateIndex: 0 });
    expect(m[11]).toMatchObject({ year: 2026, month: 12, rateIndex: 11 });
  });

  it("gilt ohne Nachfolger über das Wirtschaftsjahr hinaus fort", () => {
    // Der eigentliche Befund: Ohne Fortgeltung schuldete ab Januar 2027 niemand
    // mehr Hausgeld, nur weil die Versammlung noch nicht getagt hat.
    const m = sollMonate(
      { validFrom: utc(2026, 1, 1), validUntil: null, year: 2026 },
      kalenderjahr,
      utc(2027, 4, 1),
    );
    expect(m).toHaveLength(15);
    // Die Rate beginnt im neuen Jahr wieder bei Index 0 — sonst summierten sich
    // die Restcents des Vorjahres in ein falsches Jahresergebnis.
    expect(m[12]).toMatchObject({ year: 2027, month: 1, rateIndex: 0, fiscalYear: 2027 });
  });

  it("ein unterjährig geänderter Plan beginnt mitten im Jahr", () => {
    const m = sollMonate(
      { validFrom: utc(2026, 7, 1), validUntil: null, year: 2026 },
      kalenderjahr,
      utc(2027, 1, 1),
    );
    expect(m).toHaveLength(6);
    // Die Monatsrate bleibt die des Julis — nicht die erste Rate des Jahres.
    expect(m[0]).toMatchObject({ year: 2026, month: 7, rateIndex: 6 });
  });

  it("abweichendes Wirtschaftsjahr (Beginn Juli)", () => {
    const m = sollMonate(
      { validFrom: utc(2026, 7, 1), validUntil: utc(2027, 7, 1), year: 2026 },
      7,
      utc(2030, 1, 1),
    );
    expect(m).toHaveLength(12);
    expect(m[0]).toMatchObject({ year: 2026, month: 7, rateIndex: 0 });
    expect(m[11]).toMatchObject({ year: 2027, month: 6, rateIndex: 11 });
  });

  it("läuft nicht unbegrenzt, wenn jahrelang kein Plan beschlossen wird", () => {
    const m = sollMonate(
      { validFrom: utc(2026, 1, 1), validUntil: null, year: 2026 },
      kalenderjahr,
      utc(2099, 1, 1),
    );
    expect(m.length).toBeLessThanOrEqual(72); // sechs Wirtschaftsjahre
  });
});

// ── Fortgeltung × Rundung ───────────────────────────────────────────────────
//
// `rateIndex` beginnt je Wirtschaftsjahr wieder bei 0. Diese Prüfungen halten
// fest, was das für die beiden Rundungen bedeutet — und dass die Fortgeltung
// über die Jahresgrenze in beiden Fällen den richtigen Jahresbetrag stellt.

describe("Monatsraten über die Jahresgrenze", () => {
  const kalenderjahr = 1;
  // Zwei volle Wirtschaftsjahre eines fortgeltenden Plans (2026 + 2027).
  const monate = sollMonate(
    { validFrom: utc(2026, 1, 1), validUntil: null, year: 2026 },
    kalenderjahr,
    utc(2028, 1, 1),
  );

  it("centgenau: der Neustart bei 0 hält den Jahresbetrag — sonst summierte 2027 falsch", () => {
    // 3.000,05 € gehen nicht glatt durch zwölf — fünf Restcents bleiben übrig.
    const raten = monthlyInstallmentPlan(300_005, "CENT").rates;
    const proJahr = new Map<number, number>();
    for (const m of monate) {
      proJahr.set(m.fiscalYear, (proJahr.get(m.fiscalYear) ?? 0) + raten[m.rateIndex]);
    }
    expect([...proJahr.values()]).toEqual([300_005, 300_005]);
    // Die Restcents liegen auf den ersten Monaten — in jedem Jahr neu.
    expect(raten[0]).toBeGreaterThan(raten[11]);
  });

  it("gerundet: alle zwölf Raten sind gleich, der Index wird gleichgültig", () => {
    const raten = monthlyInstallmentPlan(300_036, "ZEHN_CENT").rates;
    expect(new Set(raten).size).toBe(1);
    // Damit stellt jeder Monat denselben Betrag, egal an welcher Position im
    // Wirtschaftsjahr er steht — der Dauerauftrag passt auch im Januar.
    expect(new Set(monate.map((m) => raten[m.rateIndex])).size).toBe(1);
    // Und was im Jahr gestellt wird, ist der gerundete Betrag, nicht der Plan.
    const jahr2027 = monate
      .filter((m) => m.fiscalYear === 2027)
      .reduce((s, m) => s + raten[m.rateIndex], 0);
    expect(jahr2027).toBe(300_120);
  });
});

describe("sollHorizont", () => {
  it("reicht über den laufenden Monat hinaus — die Lastschrift wird vorher eingereicht", () => {
    expect(sollHorizont(utc(2026, 7, 27))).toEqual(utc(2026, 10, 1));
  });
});
