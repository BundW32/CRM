import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ablageFehlerText } from "./ablage-fehler";

// Der Befund, der diesen Test veranlasst hat: Ein Wirtschaftsplan wurde
// beschlossen, 90 Sollstellungen entstanden — und die neun Einzelwirtschafts-
// pläne landeten nicht in den Dokumenten. Die Oberfläche meldete „konnten nicht
// abgelegt werden", ohne Grund und ohne Weg nach vorn; der echte Fehler stand
// allein im Server-Log. Ein Vorgang, dessen Teilschritt still scheitert, fällt
// erst auf, wenn ein Eigentümer sein Dokument vermisst.
//
// Zwei Dinge hält dieser Test fest: dass der Grund lesbar herauskommt, und dass
// beide Wege, die Dokumente erzeugen, eine Wiederholung anbieten.

describe("ablageFehlerText", () => {
  it("nennt die Dateiablage als Ursache, wenn der Blob-Store fehlt", () => {
    const text = ablageFehlerText(
      new Error(
        "Dateien können nicht gespeichert werden: In Produktion muss Vercel Blob " +
          "konfiguriert sein (BLOB_READ_WRITE_TOKEN).",
      ),
    );
    expect(text).toMatch(/Dateiablage/);
    // Der Hinweis, dass es an der Einstellung liegt und nicht an den Daten —
    // sonst sucht der Verwalter den Fehler bei den Eigentümern.
    expect(text).toMatch(/Einstellung des Systems/);
  });

  it("bietet bei einem Zeitüberschreitung den erneuten Versuch an", () => {
    expect(ablageFehlerText(new Error("Transaction API error: timed out"))).toMatch(
      /erneuter Versuch/i,
    );
  });

  it("reicht unbekannte Fehler gekürzt durch, statt sie zu verschlucken", () => {
    const lang = new Error("x".repeat(500));
    const text = ablageFehlerText(lang);
    expect(text.length).toBeLessThanOrEqual(200);
    expect(text.endsWith("…")).toBe(true);
  });

  it("bleibt aussagefähig, wenn gar keine Meldung da ist", () => {
    expect(ablageFehlerText(new Error(""))).toMatch(/nicht ermitteln/);
  });

  it("gibt keine Stapelspur preis", () => {
    const err = new Error("Kaputt");
    err.stack = "Error: Kaputt\n    at /var/task/.next/server/chunks/1234.js:5:6";
    expect(ablageFehlerText(err)).toBe("Kaputt");
  });
});

// Die Wiederholung ist der zweite Teil des Fixes: Ohne sie bliebe nach einem
// Fehlschlag nur, den Plan erneut zu beschließen — und `resolvePlan` läuft nur
// für Entwürfe. Es gäbe also gar keinen Weg zurück.
describe("Ablage lässt sich in beiden Modulen wiederholen", () => {
  const wurzel = join(__dirname, "..", "..", "app", "(portal)", "verwaltung", "weg", "[propertyId]");
  const aktionsModule = [
    join(wurzel, "wirtschaftsplan", "actions.ts"),
    join(wurzel, "jahresabrechnung", "actions.ts"),
  ];

  it.each(aktionsModule)("%s bietet wiederholeAblage an", (pfad) => {
    expect(readFileSync(pfad, "utf8")).toMatch(/export async function wiederholeAblage/);
  });

  it.each(aktionsModule)("%s meldet den Grund an die Oberfläche", (pfad) => {
    const quelle = readFileSync(pfad, "utf8");
    // Nicht nur `ablage=fehler`, sondern der Grund dazu — genau das fehlte.
    expect(quelle).toMatch(/ablageFehlerText/);
    expect(quelle).toMatch(/grund=\$\{encodeURIComponent/);
  });
});
