import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bruttoCents,
  extractRechnung,
  isBelegErkennungEnabled,
  isoTag,
  vorschlagBezeichnung,
} from "./beleg-erkennung";

function geminiResponse(obj: unknown) {
  return {
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }],
    }),
  } as Response;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function enable() {
  vi.stubEnv("AI_BELEG_ERKENNUNG_ENABLED", "true");
  vi.stubEnv("GEMINI_API_KEY", "test-key");
}

describe("isBelegErkennungEnabled", () => {
  it("ist nur aktiv mit eigenem Schalter UND Key", () => {
    vi.stubEnv("AI_BELEG_ERKENNUNG_ENABLED", "true");
    vi.stubEnv("GEMINI_API_KEY", "");
    expect(isBelegErkennungEnabled()).toBe(false);
    vi.stubEnv("GEMINI_API_KEY", "k");
    expect(isBelegErkennungEnabled()).toBe(true);
    // Die Freigabe des Objekt-Imports schaltet die Belegerkennung NICHT mit ein.
    vi.stubEnv("AI_BELEG_ERKENNUNG_ENABLED", "false");
    vi.stubEnv("AI_OBJEKT_IMPORT_ENABLED", "true");
    expect(isBelegErkennungEnabled()).toBe(false);
  });
});

describe("isoTag", () => {
  it("nimmt ISO und deutsches Datum, verwirft Unsinn", () => {
    expect(isoTag("2026-03-14")).toBe("2026-03-14");
    expect(isoTag("14.03.2026")).toBe("2026-03-14");
    expect(isoTag("2026-03-14T00:00:00Z")).toBe("2026-03-14");
    expect(isoTag("31.02.2026")).toBeUndefined();
    expect(isoTag("März 2026")).toBeUndefined();
    expect(isoTag("1899-01-01")).toBeUndefined();
    expect(isoTag(undefined)).toBeUndefined();
  });
});

describe("bruttoCents", () => {
  it("liest Zahl, deutsche und englische Schreibweise; nur positiv", () => {
    expect(bruttoCents(1250)).toBe(125000);
    expect(bruttoCents(1250.5)).toBe(125050);
    expect(bruttoCents("1.250,00 €")).toBe(125000);
    expect(bruttoCents("1,250.00")).toBe(125000);
    expect(bruttoCents("0")).toBeUndefined();
    expect(bruttoCents(-5)).toBeUndefined();
    expect(bruttoCents("abc")).toBeUndefined();
  });
});

describe("extractRechnung", () => {
  it("ruft ohne Freigabe nichts auf", async () => {
    vi.stubEnv("AI_BELEG_ERKENNUNG_ENABLED", "false");
    vi.stubEnv("GEMINI_API_KEY", "k");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await extractRechnung(Buffer.from("x"), "application/pdf")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lehnt unbekannte Dateitypen ab", async () => {
    enable();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await extractRechnung(Buffer.from("x"), "text/plain")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sendet die Datei als inline_data und normalisiert die Antwort", async () => {
    enable();
    const fetchMock = vi.fn(async () =>
      geminiResponse({
        creditor: "  Dachdeckerei   Müller GmbH ",
        invoiceNumber: "2026-114",
        invoiceDate: "14.03.2026",
        dueDate: "2026-03-28",
        grossAmount: "1.250,00",
        description: "Dachreparatur nach Sturmschaden",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const res = await extractRechnung(Buffer.from("%PDF-1.4"), "application/pdf");
    expect(res).toEqual({
      creditor: "Dachdeckerei Müller GmbH",
      invoiceNumber: "2026-114",
      invoiceDate: "2026-03-14",
      dueDate: "2026-03-28",
      grossCents: 125000,
      description: "Dachreparatur nach Sturmschaden",
    });
    const aufruf = fetchMock.mock.calls[0] as unknown as [string, { body: string }];
    const body = JSON.parse(aufruf[1].body);
    expect(body.contents[0].parts[0].inline_data.mime_type).toBe("application/pdf");
  });

  it("gibt null zurück, wenn nichts erkannt wurde oder die API fehlschlägt", async () => {
    enable();
    vi.stubGlobal("fetch", vi.fn(async () => geminiResponse({})));
    expect(await extractRechnung(Buffer.from("x"), "image/jpeg")).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false }) as Response));
    expect(await extractRechnung(Buffer.from("x"), "image/jpeg")).toBeNull();
  });
});

describe("vorschlagBezeichnung", () => {
  it("baut die Bezeichnung wie der Platzhalter des Formulars", () => {
    expect(vorschlagBezeichnung({ invoiceNumber: "2026-114", description: "Dachreparatur" })).toBe(
      "Rechnung 2026-114, Dachreparatur",
    );
    expect(vorschlagBezeichnung({ description: "Dachreparatur" })).toBe("Dachreparatur");
    expect(vorschlagBezeichnung({ creditor: "Müller GmbH" })).toBe("Rechnung Müller GmbH");
    expect(vorschlagBezeichnung({ invoiceNumber: "AG0026", belegart: "Angebot" })).toBe("Angebot AG0026");
    expect(vorschlagBezeichnung({})).toBe("");
  });
});
