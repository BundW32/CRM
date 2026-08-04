import { describe, expect, it } from "vitest";
import { generateMahnung, type MahnungInput } from "./mahnung";
import { drawnTexts } from "./test-helpers/pdf-inspect";

// Geprüft wird das **fertige PDF**, nicht der Code, der es baut.
//
// Anlass: Beim Zusammenführen mit dem Dokument-Kit (DIN 5008) wurde diese Datei
// vollständig umgebaut — von pdf-lib-Zeichenbefehlen auf einen Baukasten. Die
// Aufschlüsselung nach § 367 Abs. 1 BGB hätte dabei still verschwinden können,
// ohne dass Typprüfung oder ein anderer Test etwas gemerkt hätten. Genau diese
// Zeilen sind aber der Grund, warum eine Mahnung überhaupt überprüfbar ist:
// Wer nur einen Endbetrag nennt, gibt dem Empfänger nichts an die Hand.

async function mahnung(over: Partial<MahnungInput> = {}): Promise<string> {
  const pdf = await generateMahnung({
    issuer: { legalName: "Musterverwaltung UG", lines: ["Musterweg 1", "45964 Gladbeck"] },
    propertyName: "WEG Musterstraße 12",
    unitLabel: "TE 06, Stellplatz",
    level: 2,
    recipient: { anrede: "FRAU", name: "Erika Eigentümerin" } as MahnungInput["recipient"],
    recipientAddress: "Musterstraße 12\n45964 Gladbeck",
    arrearsCents: 25999,
    paymentDeadline: new Date(2026, 7, 12),
    iban: "DE02120300000000202051",
    accountHolder: "WEG Musterstraße 12",
    createdAt: new Date(2026, 6, 29),
    city: "Gladbeck",
    ...over,
  });
  const stuecke = await drawnTexts(pdf);
  return stuecke.map((s) => s.text).join(" ").replace(/\s+/g, " ");
}

describe("Mahnung: Aufschlüsselung", () => {
  it("weist Zinsen und Kosten als eigene Posten aus", async () => {
    const text = await mahnung({ interestCents: 474, feeCents: 250 });
    expect(text).toContain("Hausgeld-Rückstand");
    expect(text).toContain("Verzugszinsen (§ 288 Abs. 1 BGB)");
    expect(text).toContain("Mahnkosten");
    // 259,99 + 4,74 + 2,50 — die Summe muss dastehen, nicht nur die Teile.
    expect(text).toContain("Gesamtforderung");
    expect(text).toContain("267,23");
  });

  it("bleibt ohne Zinsen und Kosten einzeilig", async () => {
    // Eine Aufstellung mit einer einzigen Zeile wäre Ballast.
    const text = await mahnung();
    expect(text).toContain("Offener Betrag");
    expect(text).not.toContain("Gesamtforderung");
    expect(text).not.toContain("Verzugszinsen (§ 288");
  });

  it("nennt keine Zinsen, wenn kein Basiszinssatz vorlag", async () => {
    // `interestCents: null` heißt „nicht berechenbar", nicht „null Euro". Eine
    // Zeile mit 0,00 € läse sich wie „keine Zinsen entstanden".
    const text = await mahnung({ interestCents: null, feeCents: 250 });
    expect(text).not.toContain("Verzugszinsen (§ 288");
    expect(text).toContain("Mahnkosten");
  });
});
