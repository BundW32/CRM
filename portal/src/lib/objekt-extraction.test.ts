import { afterEach, describe, expect, it, vi } from "vitest";
import { extractObjektFromPdf, isObjektImportEnabled } from "./objekt-extraction";

// Baut eine Gemini-Antwort im erwarteten Format (candidates[0].content.parts[0].text).
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
  vi.stubEnv("AI_OBJEKT_IMPORT_ENABLED", "true");
  vi.stubEnv("GEMINI_API_KEY", "test-key");
}

describe("isObjektImportEnabled", () => {
  it("ist nur aktiv mit Flag UND Key", () => {
    vi.stubEnv("AI_OBJEKT_IMPORT_ENABLED", "true");
    vi.stubEnv("GEMINI_API_KEY", "");
    expect(isObjektImportEnabled()).toBe(false);
    vi.stubEnv("GEMINI_API_KEY", "k");
    expect(isObjektImportEnabled()).toBe(true);
    vi.stubEnv("AI_OBJEKT_IMPORT_ENABLED", "false");
    expect(isObjektImportEnabled()).toBe(false);
  });
});

describe("extractObjektFromPdf", () => {
  it("gibt null zurück, wenn der Import deaktiviert ist (kein Netzaufruf)", async () => {
    vi.stubEnv("AI_OBJEKT_IMPORT_ENABLED", "false");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await extractObjektFromPdf(Buffer.from("x"), "application/pdf");
    expect(res).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lehnt Nicht-PDF ab", async () => {
    enable();
    vi.stubGlobal("fetch", vi.fn());
    expect(await extractObjektFromPdf(Buffer.from("x"), "image/png")).toBeNull();
  });

  it("parst Felder, rundet Ganzzahlen und wandelt Komma-Zahlen", async () => {
    enable();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        geminiResponse({
          name: "  Goethestraße 42  ",
          street: "Goethestraße 42",
          zip: "04109",
          city: "Leipzig",
          buildYear: 1998.0,
          livingArea: "420,5",
          floors: 3.4,
          buildingType: "Mehrfamilienhaus",
          heatingType: "Gas-Zentralheizung",
          units: [
            { label: "WE 01", floor: "EG" },
            { label: "  ", floor: "1. OG" }, // leeres Label -> gefiltert
            { label: "WE 02" },
          ],
        }),
      ),
    );
    const res = await extractObjektFromPdf(Buffer.from("%PDF-1.4"), "application/pdf");
    expect(res).not.toBeNull();
    expect(res!.name).toBe("Goethestraße 42"); // getrimmt
    expect(res!.zip).toBe("04109");
    expect(res!.buildYear).toBe(1998);
    expect(res!.livingArea).toBeCloseTo(420.5);
    expect(res!.floors).toBe(3); // gerundet
    expect(res!.units).toEqual([{ label: "WE 01", floor: "EG" }, { label: "WE 02" }]);
  });

  it("gibt null bei HTTP-Fehler zurück", async () => {
    enable();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false }) as Response));
    expect(await extractObjektFromPdf(Buffer.from("%PDF"), "application/pdf")).toBeNull();
  });
});
