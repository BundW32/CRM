import { describe, expect, it } from "vitest";
import { baueKontoauszug, saldoHeute } from "./kontoauszug";

const STICHTAG = new Date(2030, 0, 1); // weit in der Zukunft: alles ist fällig

const soll = (jahr: number, monat: number, cents: number) => ({
  dueDate: new Date(jahr, monat - 1, 1),
  amountCents: cents,
  periodYear: jahr,
  periodMonth: monat,
  source: "WIRTSCHAFTSPLAN",
});

describe("Kontoauszug", () => {
  it("führt Bewegungen und keine Salden", () => {
    const zeilen = baueKontoauszug(
      [soll(2026, 1, 25000), soll(2026, 2, 25000)],
      [{ bookingDate: new Date(2026, 0, 3), betragCents: 25000, text: "Überweisung" }],
      STICHTAG,
    );
    expect(zeilen.map((z) => [z.text, z.betragCents, z.saldoCents])).toEqual([
      ["Hausgeld Januar 2026", 25000, 25000],
      ["Überweisung", -25000, 0],
      ["Hausgeld Februar 2026", 25000, 25000],
    ]);
  });

  it("stellt am selben Tag die Belastung vor die Gutschrift", () => {
    // Sonst sähe der Saldo zwischendurch nach einem Guthaben aus, das es nie
    // gab — und der Eigentümer fragt zu Recht nach.
    const zeilen = baueKontoauszug(
      [soll(2026, 1, 25000)],
      [{ bookingDate: new Date(2026, 0, 1), betragCents: 25000, text: "Überweisung" }],
      STICHTAG,
    );
    expect(zeilen.map((z) => z.art)).toEqual(["SOLL", "ZAHLUNG"]);
    expect(zeilen.map((z) => z.saldoCents)).toEqual([25000, 0]);
  });

  it("verdeckt mit einer Vorauszahlung keinen offenen Monat", () => {
    // Der Fehler aus KP9, hier in der Anzeige: Wer nur „Soll minus Gezahlt"
    // rechnet, kommt auf 0 und sieht nicht, dass der Januar offen ist.
    const zeilen = baueKontoauszug(
      [soll(2026, 1, 25000), soll(2026, 2, 25000)],
      [{ bookingDate: new Date(2026, 1, 1), betragCents: 25000, text: "Überweisung Februar" }],
      STICHTAG,
    );
    // Die Summe ist ausgeglichen …
    expect(saldoHeute(zeilen)).toBe(25000);
    // … aber der Auszug zeigt, dass zwischendurch 50.000 offen standen.
    expect(Math.max(...zeilen.map((z) => z.saldoCents))).toBe(50000);
  });

  it("benennt eine Sonderumlage als solche", () => {
    const zeilen = baueKontoauszug(
      [{ ...soll(2026, 5, 300000), source: "SONDERUMLAGE" }],
      [],
      STICHTAG,
    );
    expect(zeilen[0].text).toBe("Sonderumlage");
  });

  it("bleibt bei leeren Daten leer statt zu raten", () => {
    expect(baueKontoauszug([], [])).toEqual([]);
    expect(saldoHeute([])).toBe(0);
  });

  it("zählt künftige Monate NICHT zum Stand von heute", () => {
    // Der Fehler aus dem ersten Prüflauf: Ein Eigentümer mit 1.575 € Rückstand
    // las „3.599,80 € offen", weil zwölf noch nicht fällige Monate mitgezählt
    // wurden. Wer jemandem das Doppelte seiner Schuld nennt, verliert sein
    // Vertrauen an dieser Stelle endgültig.
    const heute = new Date(2026, 2, 15); // Mitte März
    const zeilen = baueKontoauszug(
      [soll(2026, 1, 25000), soll(2026, 2, 25000), soll(2026, 3, 25000), soll(2026, 4, 25000), soll(2026, 5, 25000)],
      [],
      heute,
    );
    // Fällig sind Januar bis März …
    expect(saldoHeute(zeilen)).toBe(75000);
    // … April und Mai stehen mit in der Tabelle, aber als künftig markiert.
    expect(zeilen.filter((z) => z.kuenftig).map((z) => z.text)).toEqual([
      "Hausgeld April 2026",
      "Hausgeld Mai 2026",
    ]);
    // Der Endsaldo der Tabelle ist ein anderer als der Stand von heute.
    expect(zeilen[zeilen.length - 1].saldoCents).toBe(125000);
  });

  it("nimmt den Endsaldo aus der letzten Zeile", () => {
    // Zwei Wege zu derselben Zahl laufen auseinander; dann widerspricht die
    // Fußzeile der Tabelle darüber.
    const zeilen = baueKontoauszug([soll(2026, 1, 25000), soll(2026, 2, 25000)], [], STICHTAG);
    expect(saldoHeute(zeilen)).toBe(zeilen[zeilen.length - 1].saldoCents);
  });
});
