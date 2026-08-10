// Die Posten-Trennung ist der fehlerträchtigste Teil der Stellplatz-Abrechnung:
// Hält `istStellplatzPosten` nicht, schreibt der Mengenabgleich dem falschen
// Abo-Posten Menge und Preis — der Stellplatz-Posten bekäme den Einheitenpreis.
import { afterEach, describe, expect, it, vi } from "vitest";
import { STELLPLATZ_PRODUKT_METADATUM, istStellplatzPosten, planFromPriceId } from "./stripe";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("istStellplatzPosten", () => {
  it("erkennt den Posten am Produkt-Metadatum (Inline-Preis ohne Env-Id)", () => {
    vi.stubEnv("STRIPE_PRICE_STELLPLATZ", "");
    const item = {
      price: {
        id: "price_inline_abc",
        product: { id: "prod_1", metadata: { ...STELLPLATZ_PRODUKT_METADATUM } },
      },
    };
    expect(istStellplatzPosten(item)).toBe(true);
  });

  it("erkennt den Posten an der konfigurierten Env-Preis-Id", () => {
    vi.stubEnv("STRIPE_PRICE_STELLPLATZ", "price_stellplatz_env");
    const item = {
      // Nicht expandiertes Produkt (nur die Id) — die Preis-Id muss genügen.
      price: { id: "price_stellplatz_env", product: "prod_x" },
    };
    expect(istStellplatzPosten(item)).toBe(true);
  });

  it("hält einen Tarif-Posten NICHT für die Stellplatz-Position", () => {
    vi.stubEnv("STRIPE_PRICE_STELLPLATZ", "price_stellplatz_env");
    const tarifItem = {
      price: { id: "price_basic", product: { id: "prod_basic", metadata: {} } },
    };
    expect(istStellplatzPosten(tarifItem)).toBe(false);
    // Auch ohne Metadaten-Objekt (ältere Produkte) kein falscher Treffer.
    expect(istStellplatzPosten({ price: { id: "price_basic", product: "prod_basic" } })).toBe(false);
  });

  it("Metadatum gewinnt auch bei verstellter/fehlender Env-Variable", () => {
    // Der Drift-Fall: Die Env-Id zeigt woandershin, der Posten wurde aber mit
    // dem Kennzeichen-Produkt angelegt — er muss erkennbar bleiben.
    vi.stubEnv("STRIPE_PRICE_STELLPLATZ", "price_ganz_anders");
    const item = {
      price: {
        id: "price_inline_alt",
        product: { id: "prod_1", metadata: { posten: "stellplatz" } },
      },
    };
    expect(istStellplatzPosten(item)).toBe(true);
  });
});

describe("planFromPriceId als Tarif-Posten-Erkennung", () => {
  it("ordnet die Env-Preis-Ids dem Tarif zu — Grundlage der bevorzugten Erkennung im Sync", () => {
    vi.stubEnv("STRIPE_PRICE_BASIC", "price_basic_env");
    vi.stubEnv("STRIPE_PRICE_PLUS", "price_plus_env");
    expect(planFromPriceId("price_basic_env")).toBe("basic");
    expect(planFromPriceId("price_plus_env")).toBe("plus");
    expect(planFromPriceId("price_unbekannt")).toBeNull();
    expect(planFromPriceId(null)).toBeNull();
  });
});
