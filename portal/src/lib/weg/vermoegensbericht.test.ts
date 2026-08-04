import { describe, expect, it } from "vitest";
import {
  baueVermoegensbericht,
  offenAmStichtag,
  type VerbindlichkeitEingabe,
} from "./vermoegensbericht";

const v = (over: Partial<VerbindlichkeitEingabe> = {}): VerbindlichkeitEingabe => ({
  title: "Dachdecker Kiefer, Rechnung 2026-114",
  creditor: "Kiefer Bedachungen GmbH",
  kind: "RECHNUNG",
  amountCents: 180_00,
  incurredOn: new Date(2026, 10, 3),
  settledAt: null,
  ...over,
});

const stichtag = new Date(2026, 11, 31);

describe("offen am Stichtag", () => {
  it("zählt eine offene, entstandene Verbindlichkeit", () => {
    expect(offenAmStichtag(v(), stichtag)).toBe(true);
  });

  it("zählt nicht, was nach dem Stichtag entstanden ist", () => {
    // Sonst stünde die Februar-Rechnung im Bericht zum 31.12. des Vorjahres.
    expect(offenAmStichtag(v({ incurredOn: new Date(2027, 1, 4) }), stichtag)).toBe(false);
  });

  it("zählt nicht, was vor dem Stichtag beglichen wurde", () => {
    expect(offenAmStichtag(v({ settledAt: new Date(2026, 11, 20) }), stichtag)).toBe(false);
  });

  it("zählt weiterhin, wenn erst NACH dem Stichtag bezahlt wurde", () => {
    // Der entscheidende Fall: Am 31.12. war die Rechnung offen. Dass sie im
    // Januar bezahlt wurde, darf den beschlossenen Bericht nicht rückwirkend
    // ändern — genau deshalb wird nichts gelöscht, sondern datiert.
    expect(offenAmStichtag(v({ settledAt: new Date(2027, 0, 15) }), stichtag)).toBe(true);
  });
});

describe("Vermögensbericht (§ 28 Abs. 4 WEG)", () => {
  it("stellt Aktiva und Passiva gegenüber", () => {
    const bericht = baueVermoegensbericht({
      ruecklageCents: 40_000_00,
      girokontenCents: 8_500_00,
      forderungenCents: 1_574_93,
      verbindlichkeiten: [v(), v({ title: "Modernisierungsdarlehen", kind: "DARLEHEN", amountCents: 60_000_00 })],
      stichtag,
    });

    expect(bericht.aktivaCents).toBe(50_074_93);
    expect(bericht.passivaCents).toBe(60_180_00);
    // Die Gemeinschaft steht negativ da. Genau diese Zahl fehlte bisher.
    expect(bericht.reinvermoegenCents).toBe(-10_105_07);
  });

  it("stellt die größte Verbindlichkeit nach oben", () => {
    const bericht = baueVermoegensbericht({
      ruecklageCents: 0,
      girokontenCents: 0,
      forderungenCents: 0,
      verbindlichkeiten: [v(), v({ title: "Darlehen", amountCents: 60_000_00 })],
      stichtag,
    });
    expect(bericht.passiva[0]?.bezeichnung).toBe("Darlehen");
  });

  it("nennt Art und Gläubiger als Erläuterung", () => {
    const bericht = baueVermoegensbericht({
      ruecklageCents: 0,
      girokontenCents: 0,
      forderungenCents: 0,
      verbindlichkeiten: [v()],
      stichtag,
    });
    expect(bericht.passiva[0]?.hinweis).toBe("offene Rechnung · Kiefer Bedachungen GmbH");
  });

  it("bleibt ohne Verbindlichkeiten bei den Aktiva", () => {
    const bericht = baueVermoegensbericht({
      ruecklageCents: 40_000_00,
      girokontenCents: 0,
      forderungenCents: 0,
      verbindlichkeiten: [],
      stichtag,
    });
    expect(bericht.passiva).toEqual([]);
    expect(bericht.reinvermoegenCents).toBe(40_000_00);
  });
});
