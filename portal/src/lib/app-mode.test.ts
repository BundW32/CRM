import { afterEach, describe, expect, it } from "vitest";
import { appMode, isWegSaas, registrationEnabled } from "./app-mode";

const original = process.env.APP_MODE;
afterEach(() => {
  if (original === undefined) delete process.env.APP_MODE;
  else process.env.APP_MODE = original;
});

describe("appMode", () => {
  it("ist standardmäßig 'verwaltung'", () => {
    delete process.env.APP_MODE;
    expect(appMode()).toBe("verwaltung");
    expect(isWegSaas()).toBe(false);
    expect(registrationEnabled()).toBe(false);
  });

  it("ist 'weg' nur bei exaktem APP_MODE='weg'", () => {
    process.env.APP_MODE = "weg";
    expect(appMode()).toBe("weg");
    expect(isWegSaas()).toBe(true);
    expect(registrationEnabled()).toBe(true);
  });

  it("fällt bei unbekanntem Wert auf 'verwaltung' zurück (Registrierung bleibt gesperrt)", () => {
    process.env.APP_MODE = "WEG"; // Groß-/Kleinschreibung zählt
    expect(appMode()).toBe("verwaltung");
    expect(registrationEnabled()).toBe(false);
    process.env.APP_MODE = "verwaltung";
    expect(registrationEnabled()).toBe(false);
  });
});
