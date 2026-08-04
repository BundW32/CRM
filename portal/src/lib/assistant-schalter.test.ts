import { afterEach, describe, expect, it, vi } from "vitest";
import { assistentStatus, isAssistantEnabled } from "./assistant";

// Der Assistent erschien nicht, obwohl beide Variablen gesetzt waren. Der
// Grund liegt zwischen zwei Schreibweisen: In einer `.env`-Datei schreibt man
// AI_ASSISTANT_ENABLED="true", und die Anführungszeichen fallen beim Einlesen
// weg. In der Vercel-Oberfläche trägt man den Wert in ein Formularfeld ein —
// wer die Zeichen aus der Vorlage mitkopiert, speichert buchstäblich "true"
// samt Anführungszeichen. Der strikte Vergleich schlug fehl, und das Layout
// rendert die Sprechblase dann kommentarlos nicht.

describe("Freigabe des Assistenten", () => {
  afterEach(() => vi.unstubAllEnvs());

  function setze(schalter: string, key = "abc123") {
    vi.stubEnv("AI_ASSISTANT_ENABLED", schalter);
    vi.stubEnv("GEMINI_API_KEY", key);
  }

  it("erkennt den geraden Wert", () => {
    setze("true");
    expect(isAssistantEnabled()).toBe(true);
  });

  it("verzeiht mitkopierte Anführungszeichen und Leerzeichen", () => {
    for (const wert of ['"true"', "'true'", " true ", "TRUE", "True"]) {
      setze(wert);
      expect(isAssistantEnabled(), `Wert: ${wert}`).toBe(true);
    }
  });

  it("aktiviert nichts bei einem anderen Wert", () => {
    // Die Nachsicht gilt nur der Schreibweise, nicht dem Inhalt: „1" oder
    // „yes" sollen den Assistenten weiterhin NICHT einschalten, damit ein
    // versehentlich gesetzter Wert keine Kosten auslöst.
    for (const wert of ["1", "yes", "ja", "on", "false", ""]) {
      setze(wert);
      expect(isAssistantEnabled(), `Wert: ${wert}`).toBe(false);
    }
  });

  it("bleibt aus, solange kein Schlüssel da ist", () => {
    setze("true", "");
    expect(isAssistantEnabled()).toBe(false);
    setze("true", "   ");
    expect(isAssistantEnabled()).toBe(false);
  });
});

describe("Diagnose des Assistenten", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("nennt den unverstandenen Wert beim Namen", () => {
    vi.stubEnv("AI_ASSISTANT_ENABLED", "wahr");
    vi.stubEnv("GEMINI_API_KEY", "abc");
    const s = assistentStatus();
    expect(s.aktiv).toBe(false);
    expect(s.schalterUnverstanden).toBe("wahr");
    expect(s.schluesselGesetzt).toBe(true);
  });

  it("meldet den fehlenden Schlüssel getrennt vom Schalter", () => {
    vi.stubEnv("AI_ASSISTANT_ENABLED", "true");
    vi.stubEnv("GEMINI_API_KEY", "");
    const s = assistentStatus();
    expect(s.schalterGesetzt).toBe(true);
    expect(s.schluesselGesetzt).toBe(false);
    expect(s.schalterUnverstanden).toBeNull();
  });

  it("gibt den Schlüssel niemals heraus", () => {
    vi.stubEnv("AI_ASSISTANT_ENABLED", "true");
    vi.stubEnv("GEMINI_API_KEY", "streng-geheimer-schluessel");
    expect(JSON.stringify(assistentStatus())).not.toContain("streng-geheim");
  });
});
