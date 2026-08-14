import { describe, expect, it } from "vitest";
import {
  beschreibeAbweichung,
  stimmeKontenAb,
  type DiagnoseBuchung,
  type KontenabstimmungEingabe,
  type KontoEingabe,
} from "./kontenabstimmung";

// Wirtschaftsjahr 2026, Kalenderjahr. `fyEnd` ist exklusiv.
const FY_END = "2027-01-01";

const giro: KontoEingabe = {
  id: "giro",
  name: "Girokonto",
  kind: "GIRO",
  openingBalanceCents: 500_000,
  endCents: 1_000_000,
  reportedEndCents: 1_000_000,
};

const ruecklage: KontoEingabe = {
  id: "rl",
  name: "Rücklagenkonto",
  kind: "RUECKLAGE",
  openingBalanceCents: 4_000_000,
  endCents: 4_600_000,
  reportedEndCents: 4_600_000,
};

function buchung(over: Partial<DiagnoseBuchung> = {}): DiagnoseBuchung {
  return {
    id: "b1",
    accountId: "giro",
    datum: "2026-06-15",
    kind: "AUSGABE",
    transferOut: null,
    amountCents: 10_000,
    text: "Buchung",
    costTypeName: null,
    costTypeCategory: null,
    ...over,
  };
}

function abstimmen(over: Partial<KontenabstimmungEingabe> = {}) {
  return stimmeKontenAb({
    fyEnd: FY_END,
    konten: [giro, ruecklage],
    randBuchungen: [],
    ruecklagenBuchungen: [],
    ...over,
  });
}

const fuer = (ergebnis: ReturnType<typeof abstimmen>, id: string) =>
  ergebnis.find((k) => k.accountId === id)!;

describe("beschreibeAbweichung", () => {
  it("nennt Betrag UND Richtung", () => {
    // Ein „✗" sagt nur, dass etwas nicht stimmt. Ohne Richtung sucht man in
    // der Hälfte der Fälle nach der falschen Ursache.
    expect(beschreibeAbweichung(124_000)).toBe(
      "Der Kontoauszug weist 1.240,00 € mehr aus als die Buchungen ergeben.",
    );
    expect(beschreibeAbweichung(-124_000)).toBe(
      "Der Kontoauszug weist 1.240,00 € weniger aus als die Buchungen ergeben.",
    );
  });

  it("trennt „stimmt überein\" von „noch nichts eingetragen\"", () => {
    expect(beschreibeAbweichung(0)).toContain("stimmen auf den Cent überein");
    expect(beschreibeAbweichung(null)).toContain("noch nicht eingetragen");
  });
});

describe("stimmeKontenAb", () => {
  it("rechnet die Abweichung als Kontoauszug − Buchungen", () => {
    const r = abstimmen({
      konten: [{ ...giro, reportedEndCents: 1_124_000 }],
    });
    expect(fuer(r, "giro").diffCents).toBe(124_000);
    expect(fuer(r, "giro").stimmt).toBe(false);
  });

  it("gilt ohne eingetragenen Endbestand als nicht abgestimmt, nicht als stimmend", () => {
    // `null` ist nicht 0: Ein leeres Feld sagt nichts über die Buchhaltung aus,
    // und die Sperre in `finalizeStatement` behandelt es zu Recht wie einen
    // Fehler.
    const r = abstimmen({ konten: [{ ...giro, reportedEndCents: null }] });
    expect(fuer(r, "giro").diffCents).toBeNull();
    expect(fuer(r, "giro").stimmt).toBe(false);
  });

  it("nennt bei stimmenden Konten keine Ursache", () => {
    const r = abstimmen();
    expect(fuer(r, "giro").verdachte).toEqual([]);
    expect(fuer(r, "rl").verdachte).toEqual([]);
  });
});

// ── Ursache 1: Anfangsbestand nicht gesetzt ─────────────────────────────────

describe("Verdacht: fehlender Anfangsbestand", () => {
  const ohneAnfangsbestand = { ...giro, openingBalanceCents: 0, reportedEndCents: 1_124_000 };

  it("kommt nur bei Anfangsbestand 0 in Frage", () => {
    const mit = abstimmen({ konten: [{ ...giro, reportedEndCents: 1_124_000 }] });
    expect(fuer(mit, "giro").verdachte.map((v) => v.art)).not.toContain("anfangsbestand");

    const ohne = abstimmen({ konten: [ohneAnfangsbestand] });
    expect(fuer(ohne, "giro").verdachte.map((v) => v.art)).toContain("anfangsbestand");
  });

  it("wird deutlicher, wenn das Vorjahr um genau denselben Betrag abwich", () => {
    // Das ist das eigentliche Erkennungszeichen: Der Fehler wandert Jahr für
    // Jahr unverändert mit, statt sich mit den Buchungen zu ändern.
    const r = abstimmen({
      konten: [{ ...ohneAnfangsbestand, vorjahrDiffCents: 124_000 }],
    });
    const v = fuer(r, "giro").verdachte.find((x) => x.art === "anfangsbestand")!;
    expect(v.text).toContain("Vorjahres");
    expect(v.ziel).toEqual({
      art: "stammdaten",
      anker: "konten",
      label: "Anfangsbestand in den Stammdaten eintragen",
    });
  });

  it("bleibt zurückhaltend, wenn das Vorjahr anders abwich", () => {
    const r = abstimmen({
      konten: [{ ...ohneAnfangsbestand, vorjahrDiffCents: 5_000 }],
    });
    expect(
      fuer(r, "giro").verdachte.find((x) => x.art === "anfangsbestand")!.text,
    ).not.toContain("Vorjahres");
  });
});

// ── Ursache 2: Zuführung mit der falschen Buchungsart ───────────────────────

describe("Verdacht: Zuführung falsch gebucht", () => {
  it("findet die als Einnahme gebuchte Zuführung auf dem Rücklagenkonto", () => {
    // Der Kontostand stimmt in diesem Fall sogar — die Abrechnung weist
    // trotzdem keine Zuführung aus, weil nur UMBUCHUNGen dafür zählen. Genau
    // deshalb hängt dieser Verdacht nicht an einer Abweichung.
    const falsch = buchung({
      id: "zu1",
      accountId: "rl",
      kind: "EINNAHME",
      amountCents: 600_000,
      text: "Zuführung Erhaltungsrücklage",
      datum: "2026-03-01",
    });
    const r = abstimmen({ ruecklagenBuchungen: [falsch] });
    expect(fuer(r, "rl").stimmt).toBe(true);
    const v = fuer(r, "rl").verdachte.find((x) => x.art === "zufuehrung-falsche-art")!;
    expect(v.text).toContain("Zuführung Erhaltungsrücklage");
    expect(v.text).toContain("01.03.2026");
    expect(v.text).toContain("6.000,00");
    expect(v.ziel).toEqual({
      art: "buchhaltung",
      filter: { buchung: "zu1" },
      label: "Diese Buchung öffnen",
    });
  });

  it("erkennt den Bankimport-Text ohne Umlaute", () => {
    // „ZUFUEHRUNG ERHALTUNGSRUECKLAGE" ist der Normalfall, nicht die Ausnahme:
    // Viele Institute liefern den Verwendungszweck ohne Umlaute.
    const r = abstimmen({
      ruecklagenBuchungen: [
        buchung({ accountId: "rl", kind: "EINNAHME", text: "ZUFUEHRUNG ERHALTUNGSRUECKLAGE" }),
      ],
    });
    expect(fuer(r, "rl").verdachte.map((v) => v.art)).toContain("zufuehrung-falsche-art");
  });

  it("erkennt sie auch an der Kostenart, wenn der Text nichts verrät", () => {
    const r = abstimmen({
      ruecklagenBuchungen: [
        buchung({
          accountId: "rl",
          kind: "EINNAHME",
          text: "Übertrag",
          costTypeCategory: "RUECKLAGENZUFUEHRUNG",
        }),
      ],
    });
    expect(fuer(r, "rl").verdachte.map((v) => v.art)).toContain("zufuehrung-falsche-art");
  });

  it("findet die als Ausgabe gebuchte Zuführung auf dem Girokonto", () => {
    const r = abstimmen({
      ruecklagenBuchungen: [
        buchung({ accountId: "giro", kind: "AUSGABE", text: "Zuführung Rücklage" }),
      ],
    });
    const v = fuer(r, "giro").verdachte.find((x) => x.art === "zufuehrung-falsche-art")!;
    expect(v.text).toContain("keine Ausgabe der Gemeinschaft");
  });

  it("lässt die richtig gebuchte Umbuchung in Ruhe", () => {
    const r = abstimmen({
      ruecklagenBuchungen: [
        buchung({
          accountId: "rl",
          kind: "UMBUCHUNG",
          transferOut: false,
          text: "Zuführung Erhaltungsrücklage",
        }),
      ],
    });
    expect(fuer(r, "rl").verdachte).toEqual([]);
  });
});

// ── Ursache 3: Zinsen nicht gebucht ─────────────────────────────────────────

describe("Verdacht: Zinsen nicht gebucht", () => {
  const zuWenigGebucht = { ...ruecklage, reportedEndCents: 4_601_250 };

  it("kommt bei einer Abweichung nach oben auf dem Rücklagenkonto", () => {
    const r = abstimmen({ konten: [zuWenigGebucht] });
    expect(fuer(r, "rl").verdachte.map((v) => v.art)).toContain("zinsen-fehlen");
  });

  it("entfällt, wenn eine Zinsgutschrift gebucht ist", () => {
    const r = abstimmen({
      konten: [zuWenigGebucht],
      ruecklagenBuchungen: [
        buchung({ accountId: "rl", kind: "EINNAHME", text: "Zinsgutschrift", amountCents: 1_250 }),
      ],
    });
    expect(fuer(r, "rl").verdachte.map((v) => v.art)).not.toContain("zinsen-fehlen");
  });

  it("entfällt bei einer Abweichung nach unten — Zinsen erklären die nicht", () => {
    const r = abstimmen({ konten: [{ ...ruecklage, reportedEndCents: 4_500_000 }] });
    expect(fuer(r, "rl").verdachte.map((v) => v.art)).not.toContain("zinsen-fehlen");
  });

  it("entfällt auf dem Girokonto", () => {
    const r = abstimmen({ konten: [{ ...giro, reportedEndCents: 1_001_250 }] });
    expect(fuer(r, "giro").verdachte.map((v) => v.art)).not.toContain("zinsen-fehlen");
  });
});

// ── Ursache 4: Ausgabe aufs falsche Konto ───────────────────────────────────

describe("Verdacht: Ausgabe der Rücklage aufs Girokonto gebucht", () => {
  // Die Dachrechnung ist vom Rücklagenkonto abgegangen, gebucht wurde sie aber
  // aufs Girokonto: Dort steht eine Ausgabe zu viel (Auszug höher), auf der
  // Rücklage fehlt sie (Auszug niedriger).
  const spiegel = [
    { ...giro, reportedEndCents: giro.endCents + 800_000 },
    { ...ruecklage, reportedEndCents: ruecklage.endCents - 800_000 },
  ];

  it("erkennt das Spiegelbild zweier Konten", () => {
    const r = abstimmen({ konten: spiegel });
    for (const id of ["giro", "rl"]) {
      const v = fuer(r, id).verdachte.find((x) => x.art === "ausgabe-falsches-konto")!;
      expect(v.text).toContain("denselben Betrag in die andere Richtung");
    }
  });

  it("nennt die passende Erhaltungsausgabe beim Namen", () => {
    const r = abstimmen({
      konten: spiegel,
      ruecklagenBuchungen: [
        buchung({
          id: "dach",
          accountId: "giro",
          kind: "AUSGABE",
          amountCents: 800_000,
          text: "Dachsanierung Schlussrechnung",
          costTypeCategory: "INSTANDHALTUNG",
        }),
      ],
    });
    const v = fuer(r, "rl").verdachte.find((x) => x.art === "ausgabe-falsches-konto")!;
    expect(v.text).toContain("Dachsanierung Schlussrechnung");
    expect(v.ziel).toEqual({
      art: "buchhaltung",
      filter: { buchung: "dach" },
      label: "Diese Buchung öffnen",
    });
  });

  it("bleibt still, wenn die Beträge sich nicht spiegeln", () => {
    const r = abstimmen({
      konten: [
        { ...giro, reportedEndCents: giro.endCents + 800_000 },
        { ...ruecklage, reportedEndCents: ruecklage.endCents - 700_000 },
      ],
    });
    expect(fuer(r, "giro").verdachte.map((v) => v.art)).not.toContain("ausgabe-falsches-konto");
  });
});

// ── Ursache 5: Buchung knapp außerhalb des Wirtschaftsjahres ────────────────

describe("Verdacht: Buchung am Jahresrand", () => {
  it("findet die Einnahme kurz NACH dem Jahresende, die die Lücke erklärt", () => {
    // Der häufigste Einzeltreffer: Die Zahlung kam am 30.12., gebucht wurde sie
    // am 03.01. — im Kontoauszug steht sie, in der Abrechnung nicht.
    const r = abstimmen({
      konten: [{ ...giro, reportedEndCents: giro.endCents + 124_000 }],
      randBuchungen: [
        buchung({
          id: "spaet",
          accountId: "giro",
          kind: "EINNAHME",
          amountCents: 124_000,
          datum: "2027-01-03",
        }),
      ],
    });
    const v = fuer(r, "giro").verdachte.find((x) => x.art === "buchung-am-jahresrand")!;
    expect(v.text).toContain("3 Tage nach dem Ende");
    expect(v.ziel).toEqual({
      art: "buchhaltung",
      filter: { buchung: "spaet" },
      label: "Diese Buchung öffnen",
    });
  });

  it("findet die Buchung kurz VOR dem Jahresende, die zu viel drinsteht", () => {
    const r = abstimmen({
      konten: [{ ...giro, reportedEndCents: giro.endCents - 50_000 }],
      randBuchungen: [
        buchung({
          accountId: "giro",
          kind: "EINNAHME",
          amountCents: 50_000,
          datum: "2026-12-28",
        }),
      ],
    });
    expect(
      fuer(r, "giro").verdachte.find((x) => x.art === "buchung-am-jahresrand")!.text,
    ).toContain("kurz vor dem Ende");
  });

  it("meldet nur Buchungen, deren Betrag die Differenz genau erklärt", () => {
    // Eine Liste aller Buchungen am Jahresrand wäre wieder nur eine Liste.
    const r = abstimmen({
      konten: [{ ...giro, reportedEndCents: giro.endCents + 124_000 }],
      randBuchungen: [
        buchung({ accountId: "giro", kind: "EINNAHME", amountCents: 99_000, datum: "2027-01-03" }),
      ],
    });
    expect(fuer(r, "giro").verdachte.map((v) => v.art)).not.toContain("buchung-am-jahresrand");
  });

  it("rechnet die Richtung der Buchung mit — eine Ausgabe erklärt keine Lücke nach oben", () => {
    const r = abstimmen({
      konten: [{ ...giro, reportedEndCents: giro.endCents + 124_000 }],
      randBuchungen: [
        buchung({ accountId: "giro", kind: "AUSGABE", amountCents: 124_000, datum: "2027-01-03" }),
      ],
    });
    expect(fuer(r, "giro").verdachte.map((v) => v.art)).not.toContain("buchung-am-jahresrand");
  });

  it("ordnet die Buchung dem Konto zu, auf dem sie steht", () => {
    const r = abstimmen({
      konten: [{ ...giro, reportedEndCents: giro.endCents + 124_000 }, ruecklage],
      randBuchungen: [
        buchung({ accountId: "rl", kind: "EINNAHME", amountCents: 124_000, datum: "2027-01-03" }),
      ],
    });
    expect(fuer(r, "giro").verdachte.map((v) => v.art)).not.toContain("buchung-am-jahresrand");
  });
});
