import { describe, expect, it } from "vitest";
import {
  BAGATELLGRENZE_CENTS,
  freistellungGueltig,
  kalenderjahr,
  naeheZurGrenze,
  pruefeEinbehalt,
} from "./bauabzugsteuer";

const OHNE = { nummer: null, gueltigBis: null };
const STICHTAG = new Date(2026, 6, 15);

function pruefe(over: Partial<Parameters<typeof pruefeEinbehalt>[0]> = {}) {
  return pruefeEinbehalt({
    bauleistung: true,
    freistellung: OHNE,
    bisherCents: 0,
    betragCents: 100_000,
    stichtag: STICHTAG,
    ...over,
  });
}

describe("Bauabzugsteuer § 48 EStG", () => {
  it("schweigt, wo es keine Bauleistung ist", () => {
    // Der wichtigste der Tests. Gartenpflege, Reinigung und Winterdienst sind
    // keine Bauleistungen. Eine Warnung dort macht die Warnung überall wertlos.
    const r = pruefe({ bauleistung: false, betragCents: 900_000 });
    expect(r.pflicht).toBe(false);
  });

  it("schweigt unterhalb der Bagatellgrenze", () => {
    const r = pruefe({ bisherCents: 200_000, betragCents: 200_000 });
    expect(r).toEqual({ pflicht: false, grund: "UNTER_GRENZE" });
  });

  it("behandelt genau 5.000 € noch als unterhalb", () => {
    // § 48 Abs. 2 EStG: Der Einbehalt entfällt, wenn die Gegenleistung im
    // laufenden Kalenderjahr 5.000 € **nicht übersteigt**. Genau der Betrag
    // übersteigt sie nicht.
    const r = pruefe({ bisherCents: 0, betragCents: BAGATELLGRENZE_CENTS });
    expect(r.pflicht).toBe(false);
    const knappDarueber = pruefe({ bisherCents: 0, betragCents: BAGATELLGRENZE_CENTS + 1 });
    expect(knappDarueber.pflicht).toBe(true);
  });

  it("zählt frühere Zahlungen desselben Jahres mit", () => {
    // Die Falle, um die es überhaupt geht: Fünf Rechnungen à 1.200 € sind
    // einzeln harmlos und zusammen über der Grenze.
    const r = pruefe({ bisherCents: 480_000, betragCents: 120_000 });
    expect(r.pflicht).toBe(true);
    if (!r.pflicht) return;
    expect(r.gesamtCents).toBe(600_000);
    expect(r.bisherCents).toBe(480_000);
  });

  it("rechnet 15 % auf die anstehende Zahlung, nicht auf die Jahressumme", () => {
    // Einbehalten wird von der Gegenleistung, die gerade erbracht wird. Wer die
    // Jahressumme nähme, käme auf einen Betrag, den es nirgends abzuziehen gibt.
    const r = pruefe({ bisherCents: 480_000, betragCents: 120_000 });
    if (!r.pflicht) throw new Error("erwartet: Pflicht");
    expect(r.einbehaltCents).toBe(18_000);
  });

  it("lässt eine gültige Freistellungsbescheinigung den Einbehalt entfallen", () => {
    const r = pruefe({
      bisherCents: 900_000,
      freistellung: { nummer: "12/345/67890", gueltigBis: new Date(2026, 11, 31) },
    });
    expect(r).toEqual({ pflicht: false, grund: "FREISTELLUNG" });
  });

  it("unterscheidet abgelaufen von nie vorgelegt", () => {
    // Die Abhilfe ist eine andere: einmal beim Handwerker nachfordern, einmal
    // überhaupt erst fragen. Deshalb zwei Gründe statt einem.
    const abgelaufen = pruefe({
      bisherCents: 900_000,
      freistellung: { nummer: "12/345/67890", gueltigBis: new Date(2026, 0, 31) },
    });
    expect(abgelaufen.pflicht && abgelaufen.grund).toBe("FREISTELLUNG_ABGELAUFEN");

    const nie = pruefe({ bisherCents: 900_000 });
    expect(nie.pflicht && nie.grund).toBe("GRENZE_UEBERSCHRITTEN");
  });

  it("zählt den Gültigkeitstag selbst noch mit", () => {
    // Eine Bescheinigung läuft mit Ablauf des Tages ab, nicht um 0:00 Uhr.
    const gueltigBis = new Date(2026, 6, 15);
    expect(freistellungGueltig({ nummer: "X", gueltigBis }, new Date(2026, 6, 15, 18, 0))).toBe(true);
    expect(freistellungGueltig({ nummer: "X", gueltigBis }, new Date(2026, 6, 16, 0, 1))).toBe(false);
  });

  it("erkennt ein Datum ohne Nummer nicht als Bescheinigung an", () => {
    // Sonst genügte ein eingetragenes Datum, um die Prüfung stillzulegen.
    expect(freistellungGueltig({ nummer: null, gueltigBis: new Date(2030, 0, 1) }, STICHTAG)).toBe(false);
  });

  it("rechnet im Kalenderjahr, nicht im Wirtschaftsjahr", () => {
    // § 48 Abs. 2 EStG stellt auf das laufende Kalenderjahr ab. Eine WEG darf
    // ein abweichendes Wirtschaftsjahr haben; wer das nähme, summierte falsch.
    const { von, bis } = kalenderjahr(new Date(2026, 6, 15));
    expect(von.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(bis.toISOString().slice(0, 10)).toBe("2027-01-01");
  });

  it("warnt schon vor dem Überschreiten", () => {
    // Wer bei 4.800 € steht, soll die Bescheinigung vor dem nächsten Auftrag
    // anfordern — nicht mitten in der Zahlung.
    expect(naeheZurGrenze(100_000)).toBe("FREI");
    expect(naeheZurGrenze(400_000)).toBe("NAH");
    expect(naeheZurGrenze(480_000)).toBe("NAH");
    expect(naeheZurGrenze(600_000)).toBe("UEBER");
  });
});
