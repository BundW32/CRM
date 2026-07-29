import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@/generated/prisma/client";

// Geprüft wird die **Rechte-Grenze**, nicht die Datenbankabfrage. Deshalb sind
// Datenzugriff und Zugriffshelfer ersetzt und die Finanzlage von Hand gestellt:
// So lässt sich die eine Frage isolieren, auf die es ankommt — sieht ein
// Eigentümer, wer im Rückstand ist?
//
// Der Grund für einen echten Verhaltenstest statt einer Quelltext-Prüfung: Die
// Grenze darf nicht davon abhängen, wie der Prompt formuliert ist. Ein
// Sprachmodell ist keine Zugriffskontrolle — was hier nicht herausgegeben wird,
// kann es auch nicht ausplaudern.

const EINHEITEN = [
  { id: "u1", label: "WE 01" },
  { id: "u2", label: "WE 02" },
];

vi.mock("./access", () => ({
  propertyIdsForVerwalter: async () => ["p1"],
  ownedProperties: async () => [
    { id: "p1", name: "WEG Musterstraße 12", managementType: "WEG", organizationId: "org1" },
  ],
  // Der fragende Eigentümer besitzt WE 01 — nicht WE 02.
  ownedUnitIdsInProperty: async () => ["u1"],
}));

vi.mock("./db", () => ({
  db: {
    property: { findMany: async () => [{ id: "p1", name: "WEG Musterstraße 12" }] },
    ledgerAccount: {
      findMany: async () => [
        { id: "k1", name: "Girokonto WEG", kind: "GIRO", openingBalanceCents: 100_000 },
        { id: "k2", name: "Rücklage", kind: "RUECKLAGE", openingBalanceCents: 500_000 },
      ],
    },
    booking: {
      findMany: async () => [
        { accountId: "k1", kind: "EINNAHME", transferOut: null, amountCents: 20_000 },
        { accountId: "k1", kind: "AUSGABE", transferOut: null, amountCents: 5_000 },
      ],
    },
    unit: { findMany: async () => EINHEITEN },
    economicPlan: { findFirst: async () => ({ status: "BESCHLOSSEN" }) },
    annualStatement: { findFirst: async () => null },
  },
}));

vi.mock("./weg/opos-service", () => ({
  oposJeEinheit: async () =>
    new Map([
      // Der Nachbar schuldet Geld. Genau diese Zahl darf der Eigentümer nicht
      // als „WE 02" zugeordnet bekommen.
      ["u2", { gesamtCents: 84_000, nichtZugeordnetCents: 0 }],
      ["u1", { gesamtCents: 0, nichtZugeordnetCents: 2_500 }],
    ]),
}));

const { finanzQuellen } = await import("./assistant-finanzen");

const nutzer = (role: User["role"]): User =>
  ({ id: "me", role, organizationId: "org1" }) as User;

describe("Finanzquellen: was welche Rolle erfährt", () => {
  let verwalter: Awaited<ReturnType<typeof finanzQuellen>>;
  let eigentuemer: Awaited<ReturnType<typeof finanzQuellen>>;

  beforeEach(async () => {
    verwalter = await finanzQuellen(nutzer("VERWALTER"));
    eigentuemer = await finanzQuellen(nutzer("EIGENTUEMER"));
  });

  const text = (q: { snippet: string }[]) => q.map((x) => x.snippet).join(" ");

  it("nennt dem Verwalter, WER im Rückstand ist", () => {
    // Das ist seine Arbeit — die Rückstandsliste zeigt es ihm ohnehin.
    expect(text(verwalter)).toContain("WE 02");
    expect(text(verwalter)).toContain("840,00");
  });

  it("nennt dem Eigentümer die SUMME, aber nicht den Nachbarn", () => {
    // Die Summe steht im Vermögensbericht (§ 28 Abs. 4 WEG), den die
    // Gemeinschaft ohnehin bekommt. Wer sie schuldet, steht dort nicht.
    const t = text(eigentuemer);
    expect(t).toContain("840,00"); // Summe der Rückstände
    expect(t).not.toContain("WE 02"); // aber nicht, wessen Rückstand
    expect(t).not.toContain("Betroffen");
  });

  it("nennt dem Eigentümer seinen eigenen Stand", () => {
    const eigen = eigentuemer.find((q) => q.type === "Ihr Hausgeld");
    expect(eigen).toBeDefined();
    expect(eigen!.snippet).toContain("WE 01");
    // Guthaben, das noch keiner Forderung zugeordnet ist, gehört dazu — sonst
    // wundert sich der Eigentümer, wo seine Zahlung geblieben ist.
    expect(eigen!.snippet).toContain("25,00");
    // Und auch hier taucht die fremde Einheit nicht auf.
    expect(eigen!.snippet).not.toContain("WE 02");
  });

  it("gibt dem Eigentümer die Kontostände der Gemeinschaft", () => {
    // 1.000,00 + 200,00 − 50,00 = 1.150,00 auf dem laufenden Konto.
    const konto = eigentuemer.find((q) => q.type === "Kontostand");
    expect(konto?.snippet).toContain("1.150,00");
    expect(konto?.snippet).toContain("5.000,00");
  });

  it("sagt, wo der Jahreslauf steht", () => {
    const lauf = verwalter.find((q) => q.type === "Jahreslauf");
    expect(lauf?.snippet).toContain("beschlossen");
    expect(lauf?.snippet).toContain("noch nicht begonnen");
  });

  it("gibt Mietern und Handwerkern gar nichts", async () => {
    // Die Finanzen der Gemeinschaft gehen sie nichts an — und zwar unabhängig
    // davon, ob sie zufällig in einem der Objekte wohnen.
    expect(await finanzQuellen(nutzer("MIETER"))).toEqual([]);
    expect(await finanzQuellen(nutzer("HANDWERKER"))).toEqual([]);
  });
});
