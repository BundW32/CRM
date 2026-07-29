import { describe, expect, it } from "vitest";
import {
  JOURNAL_KOPF,
  KONTOBLATT_KOPF,
  baueKontoblatt,
  csvBetrag,
  journalZeilen,
  kontoblattZeilen,
  sortiereJournal,
  vorzeichenBetrag,
  type JournalBuchung,
} from "./journal";

const b = (over: Partial<JournalBuchung> = {}): JournalBuchung => ({
  id: "b1",
  bookingDate: new Date(2026, 2, 15),
  valueDate: null,
  kind: "AUSGABE",
  transferOut: null,
  amountCents: 100_00,
  text: "Hausmeister März",
  reference: null,
  counterparty: null,
  accountName: "Girokonto WEG",
  costTypeName: "Hausmeister",
  unitLabel: null,
  craftsmanName: null,
  hatBeleg: false,
  storniert: false,
  istStorno: false,
  ...over,
});

describe("Vorzeichen", () => {
  it("Einnahme plus, Ausgabe minus", () => {
    expect(vorzeichenBetrag(b({ kind: "EINNAHME" }))).toBe(100_00);
    expect(vorzeichenBetrag(b({ kind: "AUSGABE" }))).toBe(-100_00);
  });

  it("Umbuchung richtet sich nach transferOut", () => {
    // Dieselbe Summe steht auf beiden Konten — einmal ab, einmal zu.
    expect(vorzeichenBetrag(b({ kind: "UMBUCHUNG", transferOut: true }))).toBe(-100_00);
    expect(vorzeichenBetrag(b({ kind: "UMBUCHUNG", transferOut: false }))).toBe(100_00);
  });
});

describe("Kontoblatt", () => {
  it("führt den Saldo fort und schließt auf dem Endbestand", () => {
    const blatt = baueKontoblatt({
      kontoName: "Girokonto WEG",
      anfangsbestandCents: 1_000_00,
      buchungen: [
        b({ id: "a", kind: "EINNAHME", amountCents: 500_00, bookingDate: new Date(2026, 0, 5) }),
        b({ id: "b", kind: "AUSGABE", amountCents: 200_00, bookingDate: new Date(2026, 0, 9) }),
      ],
    });
    expect(blatt.zeilen.map((z) => z.saldoCents)).toEqual([1_500_00, 1_300_00]);
    expect(blatt.endbestandCents).toBe(1_300_00);
    expect(blatt.zugangCents).toBe(500_00);
    expect(blatt.abgangCents).toBe(200_00);
  });

  it("lässt ein Stornopaar stehen — und es hebt sich im Saldo selbst auf", () => {
    // Der entscheidende Punkt des ganzen Moduls: Nichts wird herausgerechnet.
    // Original und Gegenbuchung tragen umgekehrte Richtungen, der Endbestand
    // ist deshalb wieder der Anfangsbestand — und beide Zeilen bleiben lesbar.
    const blatt = baueKontoblatt({
      kontoName: "Girokonto WEG",
      anfangsbestandCents: 1_000_00,
      buchungen: [
        b({ id: "a", kind: "AUSGABE", amountCents: 300_00, storniert: true }),
        b({ id: "b", kind: "EINNAHME", amountCents: 300_00, istStorno: true }),
      ],
    });
    expect(blatt.zeilen).toHaveLength(2);
    expect(blatt.endbestandCents).toBe(1_000_00);
  });

  it("sortiert bei gleichem Datum stabil", () => {
    // Zwei Exporte desselben Zeitraums müssen dieselben Zwischensalden zeigen.
    const eingabe = [
      b({ id: "zz", kind: "EINNAHME", amountCents: 100 }),
      b({ id: "aa", kind: "AUSGABE", amountCents: 100 }),
    ];
    const einmal = baueKontoblatt({ kontoName: "K", anfangsbestandCents: 0, buchungen: eingabe });
    const andersherum = baueKontoblatt({
      kontoName: "K",
      anfangsbestandCents: 0,
      buchungen: [...eingabe].reverse(),
    });
    expect(einmal.zeilen.map((z) => z.buchung.id)).toEqual(["aa", "zz"]);
    expect(andersherum.zeilen.map((z) => z.saldoCents)).toEqual(einmal.zeilen.map((z) => z.saldoCents));
  });

  it("bleibt ohne Buchungen beim Anfangsbestand", () => {
    const blatt = baueKontoblatt({ kontoName: "K", anfangsbestandCents: 42_00, buchungen: [] });
    expect(blatt.endbestandCents).toBe(42_00);
  });
});

describe("Zahlenformat", () => {
  it("liefert Dezimalkomma ohne Euro und ohne Tausenderpunkt", () => {
    // Mit „1.234,56 €" wäre die Zelle in Excel Text, und eine Textspalte lässt
    // sich nicht summieren — genau dafür wird der Export aber geöffnet.
    expect(csvBetrag(123_456)).toBe("1234,56");
    expect(csvBetrag(-50)).toBe("-0,50");
    expect(csvBetrag(0)).toBe("0,00");
  });
});

describe("Journal-CSV", () => {
  it("hat für jede Zeile so viele Spalten wie die Kopfzeile", () => {
    // Verrutschte Spalten fallen sonst erst auf, wenn jemand die Datei öffnet.
    const zeilen = journalZeilen([b(), b({ id: "b2", kind: "EINNAHME" })]);
    for (const z of zeilen) expect(z).toHaveLength(JOURNAL_KOPF.length);
  });

  it("trennt Einnahme und Ausgabe in zwei Spalten", () => {
    const [aus] = journalZeilen([b({ kind: "AUSGABE", amountCents: 100_00 })]);
    const einnahmeSpalte = JOURNAL_KOPF.indexOf("Einnahme");
    const ausgabeSpalte = JOURNAL_KOPF.indexOf("Ausgabe");
    expect(aus[einnahmeSpalte]).toBe("");
    // Als positive Zahl in der Ausgabenspalte — nicht als „-100,00" dort.
    expect(aus[ausgabeSpalte]).toBe("100,00");
  });

  it("benennt die Richtung einer Umbuchung", () => {
    const spalte = JOURNAL_KOPF.indexOf("Art");
    expect(journalZeilen([b({ kind: "UMBUCHUNG", transferOut: true })])[0][spalte]).toBe(
      "Umbuchung ab",
    );
    expect(journalZeilen([b({ kind: "UMBUCHUNG", transferOut: false })])[0][spalte]).toBe(
      "Umbuchung zu",
    );
  });

  it("kennzeichnet beide Seiten eines Stornos", () => {
    const spalte = JOURNAL_KOPF.indexOf("Hinweis");
    const zeilen = journalZeilen([
      b({ id: "a", storniert: true }),
      b({ id: "b", istStorno: true }),
    ]);
    expect(zeilen[0][spalte]).toBe("storniert");
    expect(zeilen[1][spalte]).toBe("Storno");
  });

  it("nummeriert fortlaufend in zeitlicher Reihenfolge", () => {
    const zeilen = journalZeilen([
      b({ id: "spaet", bookingDate: new Date(2026, 5, 1) }),
      b({ id: "frueh", bookingDate: new Date(2026, 0, 1) }),
    ]);
    expect(zeilen.map((z) => z[0])).toEqual([1, 2]);
    expect(zeilen[0][1]).toBe("01.01.2026");
  });
});

describe("Kontoblatt-CSV", () => {
  const blatt = baueKontoblatt({
    kontoName: "Girokonto WEG",
    anfangsbestandCents: 1_000_00,
    buchungen: [b({ kind: "AUSGABE", amountCents: 250_00 })],
  });

  it("hat durchgehend die Spaltenzahl der Kopfzeile", () => {
    // Auch die Rand- und Summenzeilen — dort verrutscht es am leichtesten,
    // weil sie von Hand aufgefüllt werden.
    for (const z of kontoblattZeilen(blatt)) expect(z).toHaveLength(KONTOBLATT_KOPF.length);
  });

  it("setzt Anfangs- und Endbestand in die Saldo-Spalte", () => {
    const zeilen = kontoblattZeilen(blatt);
    const saldo = KONTOBLATT_KOPF.indexOf("Saldo");
    expect(zeilen[0][3]).toBe("Anfangsbestand");
    expect(zeilen[0][saldo]).toBe("1000,00");
    expect(zeilen[zeilen.length - 1][3]).toBe("Endbestand");
    expect(zeilen[zeilen.length - 1][saldo]).toBe("750,00");
  });

  it("summiert Zu- und Abgänge in ihren eigenen Spalten", () => {
    const zeilen = kontoblattZeilen(blatt);
    const summe = zeilen[zeilen.length - 2];
    expect(summe[3]).toBe("Summe Zeitraum");
    expect(summe[KONTOBLATT_KOPF.indexOf("Zugang")]).toBe("0,00");
    expect(summe[KONTOBLATT_KOPF.indexOf("Abgang")]).toBe("250,00");
  });
});

describe("sortiereJournal", () => {
  it("verändert die Eingabe nicht", () => {
    const eingabe = [b({ id: "z" }), b({ id: "a" })];
    sortiereJournal(eingabe);
    expect(eingabe.map((x) => x.id)).toEqual(["z", "a"]);
  });
});
