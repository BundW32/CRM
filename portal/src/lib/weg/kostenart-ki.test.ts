import { afterEach, describe, expect, it, vi } from "vitest";
import { bereinigeZweck, kiKostenartAktiv, klassifiziereKostenarten } from "./kostenart-ki";

afterEach(() => {
  delete process.env.AI_KOSTENART_ENABLED;
  delete process.env.GEMINI_API_KEY;
  vi.unstubAllGlobals();
});

describe("bereinigeZweck", () => {
  it("entfernt IBAN, Rechnungsnummern, Beträge und Daten", () => {
    expect(bereinigeZweck("Abschlag Allgemeinstrom RE2023613 vom 02.01.2023 145,20 EUR")).toBe(
      "Abschlag Allgemeinstrom vom EUR",
    );
    expect(bereinigeZweck("Ueberweisung DE02 1203 0000 0000 2020 51 Hausgeld")).toBe(
      "Ueberweisung Hausgeld",
    );
    expect(bereinigeZweck("Wartung Aufzug Anlage 12")).toBe("Wartung Aufzug Anlage");
  });

  it("laesst die Bezeichnung der Leistung stehen", () => {
    expect(bereinigeZweck("Jahresbeitrag Gebäudeversicherung Police 4711")).toBe(
      "Jahresbeitrag Gebäudeversicherung Police",
    );
  });
});

describe("Freigabe", () => {
  it("ohne Umgebungsvariable und ohne Schluessel passiert nichts", async () => {
    const fetchAttrappe = vi.fn();
    vi.stubGlobal("fetch", fetchAttrappe);

    expect(kiKostenartAktiv()).toBe(false);
    expect(await klassifiziereKostenarten(["Wartung Aufzug"], [{ id: "ct1", name: "Aufzug" }])).toEqual(
      new Map(),
    );

    // Schlüssel allein genügt nicht — die Freigabe ist eine eigene Entscheidung.
    process.env.GEMINI_API_KEY = "test";
    expect(kiKostenartAktiv()).toBe(false);
    await klassifiziereKostenarten(["Wartung Aufzug"], [{ id: "ct1", name: "Aufzug" }]);
    expect(fetchAttrappe).not.toHaveBeenCalled();
  });

  it("freigegeben: nur bereinigte Zwecke und Kostenart-Namen gehen hinaus", async () => {
    process.env.AI_KOSTENART_ENABLED = "true";
    process.env.GEMINI_API_KEY = "test";
    const fetchAttrappe = vi.fn(async (_url: string, _init: { body: string }) => ({
      ok: true,
      json: async () => ({
        candidates: [
          { content: { parts: [{ text: JSON.stringify([{ index: 0, kostenart: "Aufzug" }]) }] } },
        ],
      }),
      // `.finally()` der Antwort-Promise wird im Modul benutzt
    }));
    vi.stubGlobal("fetch", fetchAttrappe);

    const treffer = await klassifiziereKostenarten(
      ["Wartung Aufzug Anlage 12 Rechnung RE2026001 1.234,56 EUR"],
      [{ id: "ct-aufzug", name: "Aufzug" }],
    );
    expect(treffer.get("Wartung Aufzug Anlage Rechnung EUR")).toBe("ct-aufzug");

    const gesendet = String(fetchAttrappe.mock.calls[0][1].body);
    expect(gesendet).toContain("Wartung Aufzug Anlage Rechnung EUR");
    expect(gesendet).not.toContain("RE2026001");
    expect(gesendet).not.toContain("1.234,56");
  });

  it("eine erfundene Kostenart erzeugt keinen Vorschlag", async () => {
    process.env.AI_KOSTENART_ENABLED = "true";
    process.env.GEMINI_API_KEY = "test";
    vi.stubGlobal("fetch", async () => ({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify([{ index: 0, kostenart: "Blumenschmuck" }]) }],
            },
          },
        ],
      }),
    }));
    expect(
      await klassifiziereKostenarten(["Wartung Aufzug"], [{ id: "ct-aufzug", name: "Aufzug" }]),
    ).toEqual(new Map());
  });

  it("ein Fehler des Dienstes bleibt folgenlos", async () => {
    process.env.AI_KOSTENART_ENABLED = "true";
    process.env.GEMINI_API_KEY = "test";
    vi.stubGlobal("fetch", async () => {
      throw new Error("Netzwerk");
    });
    expect(await klassifiziereKostenarten(["Wartung Aufzug"], [{ id: "ct1", name: "Aufzug" }])).toEqual(
      new Map(),
    );
  });
});
