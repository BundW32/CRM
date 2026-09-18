import { describe, expect, it } from "vitest";
import type { ParsedBooking } from "./bank-import";
import { findeManuelleZwillinge, type ManuelleBuchung } from "./import-abgleich";

const tag = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function zeile(over: Partial<ParsedBooking> & { dedupeHash: string }): ParsedBooking {
  return {
    bookingDate: tag("2026-03-10"),
    amountCents: 124_000,
    kind: "AUSGABE",
    text: "Dachdecker Meier Rechnung 2026-114",
    reference: "Rechnung 2026-114",
    ...over,
  };
}

function manuell(over: Partial<ManuelleBuchung> & { id: string }): ManuelleBuchung {
  return {
    bookingDate: tag("2026-03-10"),
    kind: "AUSGABE",
    amountCents: 124_000,
    text: "Rechnung 2026-114, Dachreparatur",
    hatBeleg: true,
    ...over,
  };
}

describe("findeManuelleZwillinge", () => {
  it("findet die von Hand gebuchte Zahlung zu einem Bankumsatz — Betrag, Richtung, Datum im Fenster", () => {
    const z = findeManuelleZwillinge(
      [zeile({ dedupeHash: "h1" })],
      [manuell({ id: "m1", bookingDate: tag("2026-03-12") })],
    );
    expect(z.get("h1")?.buchung.id).toBe("m1");
    expect(z.get("h1")?.tageAbstand).toBe(2);
  });

  it("ignoriert andere Beträge, andere Richtung und Buchungen außerhalb der Toleranz", () => {
    const z = findeManuelleZwillinge(
      [zeile({ dedupeHash: "h1" })],
      [
        manuell({ id: "betrag", amountCents: 124_001 }),
        manuell({ id: "richtung", kind: "EINNAHME" }),
        manuell({ id: "spaet", bookingDate: tag("2026-03-16") }), // 6 Tage
      ],
    );
    expect(z.size).toBe(0);
  });

  it("ordnet jede Handbuchung höchstens einer Zeile zu — die zeitlich nächste gewinnt", () => {
    // Zwei Abschlagszahlungen gleicher Höhe: 01.03. und 15.03. Zwei Handbuchungen
    // 02.03. und 14.03. — jede Zeile bekommt ihre eigene, nicht beide dieselbe.
    const z = findeManuelleZwillinge(
      [
        zeile({ dedupeHash: "a", bookingDate: tag("2026-03-01") }),
        zeile({ dedupeHash: "b", bookingDate: tag("2026-03-15") }),
      ],
      [
        manuell({ id: "m14", bookingDate: tag("2026-03-14") }),
        manuell({ id: "m02", bookingDate: tag("2026-03-02") }),
      ],
    );
    expect(z.get("a")?.buchung.id).toBe("m02");
    expect(z.get("b")?.buchung.id).toBe("m14");
  });

  it("lässt eine Zeile ohne Zwilling, wenn die einzige passende Handbuchung schon vergeben ist", () => {
    const z = findeManuelleZwillinge(
      [
        zeile({ dedupeHash: "a", bookingDate: tag("2026-03-10") }),
        zeile({ dedupeHash: "b", bookingDate: tag("2026-03-11") }),
      ],
      [manuell({ id: "m1", bookingDate: tag("2026-03-10") })],
    );
    expect(z.get("a")?.buchung.id).toBe("m1");
    expect(z.has("b")).toBe(false);
  });

  it("ohne Handbuchungen gibt es nichts abzugleichen", () => {
    expect(findeManuelleZwillinge([zeile({ dedupeHash: "h1" })], []).size).toBe(0);
  });
});
