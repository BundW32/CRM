import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Ein Kontoauszug zeigt, wer wann wie viel geschuldet und gezahlt hat. Wer den
// eines Nachbarn lesen kann, hat keinen Anzeigefehler, sondern einen
// Datenschutzvorfall — und die Einheiten-ID steht offen in der URL.
//
// Ein Browserlauf beweist das für einen Moment; dieser Test hält es fest.
// Vorbild ist `versammlungsbeschluss.test.ts`: Die Sperre steht serverseitig,
// und der Test prüft, dass sie noch dort steht.

const seite = readFileSync(
  join(__dirname, "..", "app", "(portal)", "finanzen", "kontoauszug", "[unitId]", "page.tsx"),
  "utf8",
);

describe("Kontoauszug: Zugriff", () => {
  it("prüft die Eigentümerschaft, nicht die URL", () => {
    expect(seite).toContain("ownedUnitIdsInProperty");
    expect(seite).toMatch(/eigene\.includes\(unit\.id\)/);
  });

  it("lässt den Verwalter nur in seinen eigenen Objekten", () => {
    // Rolle allein genügt nicht: Ein Verwalter darf nicht in die Objekte einer
    // anderen Organisation sehen.
    expect(seite).toContain("canVerwalterAccessProperty");
    expect(seite).toMatch(/user\.role === "VERWALTER" &&/);
  });

  it("bricht ab, statt eine leere Seite zu zeigen", () => {
    // `notFound()` und nicht etwa eine Meldung „keine Daten": Wer keinen
    // Zugriff hat, soll nicht einmal erfahren, dass es die Einheit gibt.
    expect(seite).toMatch(/if \(!erlaubt\) notFound\(\);/);
  });

  it("holt die Zahlungen über die Zuordnungen, nicht als Summe", () => {
    // Sonst könnte eine Vorauszahlung einen offenen Monat verdecken — genau der
    // Fehler, den KP9 beseitigt hat.
    expect(seite).toContain("db.paymentAllocation.findMany");
    expect(seite).not.toMatch(/db\.booking\.groupBy/);
  });
});
