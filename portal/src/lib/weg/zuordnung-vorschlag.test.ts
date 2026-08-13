import { describe, expect, it } from "vitest";
import {
  erkennePeriode,
  leererKontext,
  normalisiere,
  schlageEinheitVor,
  schlageKostenartVor,
  schlageVorschlagVor,
  type HistorienEintrag,
  type OffenerPostenMitPeriode,
  type Umsatz,
  type ZuordnungsKontext,
} from "./zuordnung-vorschlag";

const STICHTAG = new Date(Date.UTC(2026, 2, 5));

function einnahme(over: Partial<Umsatz> = {}): Umsatz {
  return {
    text: "Hausgeld",
    reference: "Hausgeld",
    counterparty: "Erika Mustermann",
    amountCents: 24550,
    kind: "EINNAHME",
    bookingDate: STICHTAG,
    ...over,
  };
}

function posten(over: Partial<OffenerPostenMitPeriode> = {}): OffenerPostenMitPeriode {
  return {
    id: "dp1",
    dueDate: new Date(Date.UTC(2026, 2, 1)),
    hauptCents: 24550,
    offenCents: 24550,
    quelle: "WIRTSCHAFTSPLAN",
    periodYear: 2026,
    periodMonth: 3,
    ...over,
  };
}

function kontext(over: Partial<ZuordnungsKontext> = {}): ZuordnungsKontext {
  return {
    ...leererKontext(),
    units: [
      { id: "u1", label: "WE 01, EG links" },
      { id: "u2", label: "WE 02, EG rechts" },
    ],
    ...over,
  };
}

describe("erkennePeriode", () => {
  it("numerisch und benannt", () => {
    expect(erkennePeriode("Hausgeld 03/2026")).toEqual({ month: 3, year: 2026 });
    expect(erkennePeriode("HG März 26")).toEqual({ month: 3, year: 2026 });
    expect(erkennePeriode("Wohngeld 3/26 WE 01")).toEqual({ month: 3, year: 2026 });
    expect(erkennePeriode("Hausgeld Januar")).toEqual({ month: 1, year: null });
  });

  it("ein vollständiges Datum ist keine Periodenangabe", () => {
    // Ohne diese Grenze benennt jeder Zwecktext mit Datum einen falschen Monat.
    expect(erkennePeriode("Ueberweisung vom 02.01.2023")).toBeNull();
    expect(erkennePeriode("Rechnung 4711 vom 15.11.2025 beglichen")).toBeNull();
  });

  it("unsinnige Monatszahlen zaehlen nicht", () => {
    expect(erkennePeriode("Vertrag 13/2026")).toBeNull();
  });
});

describe("schlageEinheitVor", () => {
  it("IBAN aus dem SEPA-Mandat ist sicher", () => {
    const v = schlageEinheitVor(
      einnahme({ reference: "Hausgeld von DE02 1203 0000 0000 2020 51" }),
      kontext({ ibanZuEinheit: new Map([["DE02120300000000202051", "u2"]]) }),
    );
    expect(v?.unitId).toBe("u2");
    expect(v?.guete).toBe("sicher");
    expect(v?.unitLabel).toBe("WE 02, EG rechts");
  });

  it("Kurzzeichen allein ist wahrscheinlich, mit Betragstreffer sicher", () => {
    const umsatz = einnahme({ reference: "Hausgeld WE 01 Maerz" });
    expect(schlageEinheitVor(umsatz, kontext())?.guete).toBe("wahrscheinlich");

    const mitBetrag = schlageEinheitVor(
      umsatz,
      kontext({ offenePosten: new Map([["u1", [posten()]]]) }),
    );
    expect(mitBetrag?.unitId).toBe("u1");
    expect(mitBetrag?.guete).toBe("sicher");
    expect(mitBetrag?.gruende).toContain("Betrag deckt die offenen Sollstellungen genau");
  });

  it("Nachname allein bleibt unsicher, mit Betragstreffer wahrscheinlich", () => {
    const nachnamen = new Map([["mustermann", "u1"]]);
    expect(schlageEinheitVor(einnahme(), kontext({ nachnameZuEinheit: nachnamen }))?.guete).toBe(
      "unsicher",
    );
    const v = schlageEinheitVor(
      einnahme(),
      kontext({ nachnameZuEinheit: nachnamen, offenePosten: new Map([["u1", [posten()]]]) }),
    );
    expect(v?.guete).toBe("wahrscheinlich");
  });

  it("Betragstreffer zaehlt nur, wenn er auf genau eine Einheit passt", () => {
    // Gleiches Hausgeld für alle: Der Betrag sagt dann gar nichts.
    const alle = new Map([
      ["u1", [posten({ id: "a" })]],
      ["u2", [posten({ id: "b" })]],
    ]);
    expect(schlageEinheitVor(einnahme({ counterparty: "Unbekannt" }), kontext({ offenePosten: alle }))).toBeNull();
  });

  it("Periode aus dem Verwendungszweck stuetzt den Vorschlag", () => {
    const v = schlageEinheitVor(
      einnahme({ reference: "Hausgeld 03/2026", counterparty: "Mustermann" }),
      kontext({
        nachnameZuEinheit: new Map([["mustermann", "u1"]]),
        offenePosten: new Map([["u1", [posten({ offenCents: 10000, hauptCents: 10000 })]]]),
      }),
    );
    // Nachname (40) + Periode (20) = 60 → wahrscheinlich, ohne Betragstreffer.
    expect(v?.unitId).toBe("u1");
    expect(v?.guete).toBe("wahrscheinlich");
    expect(v?.gruende).toContain("offene Forderung für 03/2026");
  });

  it("Gleichstand zweier Einheiten ist kein Vorschlag", () => {
    const v = schlageEinheitVor(
      einnahme({ reference: "Sammelzahlung WE 01 und WE 02" }),
      kontext(),
    );
    expect(v).toBeNull();
  });

  it("ohne jeden Hinweis kein Vorschlag", () => {
    expect(schlageEinheitVor(einnahme({ counterparty: "Fremd", reference: "x" }), kontext())).toBeNull();
  });

  it("Ausgaben bekommen keine Einheit", () => {
    expect(schlageEinheitVor(einnahme({ kind: "AUSGABE" }), kontext())).toBeNull();
  });
});

describe("schlageKostenartVor", () => {
  const historie = (over: Partial<HistorienEintrag> = {}): HistorienEintrag => ({
    counterparty: "Stadtwerke Gladbeck",
    reference: "Abschlag Allgemeinstrom",
    text: "Abschlag Allgemeinstrom",
    costTypeId: "ct-strom",
    costTypeName: "Allgemeinstrom",
    bookingDate: new Date(Date.UTC(2025, 10, 1)),
    ...over,
  });

  const ausgabe = (over: Partial<Umsatz> = {}): Umsatz => ({
    text: "Abschlag Allgemeinstrom Maerz",
    reference: "Abschlag Allgemeinstrom Maerz",
    counterparty: "Stadtwerke Gladbeck",
    amountCents: 8900,
    kind: "AUSGABE",
    bookingDate: STICHTAG,
    ...over,
  });

  it("dreimal derselbe Partner mit derselben Kostenart ist sicher", () => {
    const v = schlageKostenartVor(ausgabe(), [
      historie({ bookingDate: new Date(Date.UTC(2025, 8, 1)) }),
      historie({ bookingDate: new Date(Date.UTC(2025, 9, 1)) }),
      historie(),
    ]);
    expect(v?.costTypeId).toBe("ct-strom");
    expect(v?.guete).toBe("sicher");
  });

  it("einmal derselbe Partner ist wahrscheinlich", () => {
    expect(schlageKostenartVor(ausgabe(), [historie()])?.guete).toBe("wahrscheinlich");
  });

  it("wechselnde Kostenarten beim selben Partner bleiben unsicher", () => {
    const v = schlageKostenartVor(ausgabe(), [
      historie({ costTypeId: "ct-heiz", costTypeName: "Heizung", bookingDate: new Date(Date.UTC(2026, 0, 5)) }),
      historie(),
    ]);
    expect(v?.guete).toBe("unsicher");
    expect(v?.costTypeId).toBe("ct-heiz"); // die zuletzt verwendete
  });

  it("ohne Partner zaehlt der aehnliche Verwendungszweck", () => {
    const v = schlageKostenartVor(ausgabe({ counterparty: null }), [historie({ counterparty: null })]);
    expect(v?.costTypeId).toBe("ct-strom");
    expect(v?.guete).not.toBe("sicher");
  });

  it("fremde Ausgabe ohne Anhaltspunkt bekommt nichts", () => {
    const v = schlageKostenartVor(
      ausgabe({ counterparty: "Baumschule Nord", text: "Pflanzung Hecke", reference: "Pflanzung Hecke" }),
      [historie()],
    );
    expect(v).toBeNull();
  });

  it("Einnahmen bekommen keine Kostenart", () => {
    expect(schlageKostenartVor(ausgabe({ kind: "EINNAHME" }), [historie()])).toBeNull();
  });
});

describe("schlageVorschlagVor", () => {
  it("verteilt nach Richtung — und laesst Umbuchungen in Ruhe", () => {
    const k = kontext({ ibanZuEinheit: new Map([["DE02120300000000202051", "u1"]]) });
    expect(
      schlageVorschlagVor(einnahme({ reference: "DE02120300000000202051" }), k)?.unitId,
    ).toBe("u1");
    expect(schlageVorschlagVor(einnahme({ kind: "UMBUCHUNG" }), k)).toBeNull();
  });
});

describe("normalisiere", () => {
  it("Satzzeichen und Mehrfach-Leerzeichen fallen weg", () => {
    expect(normalisiere("  Hausgeld/WE-01,  Maerz ")).toBe("hausgeld we 01 maerz");
  });
});
