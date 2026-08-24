// Die Platzgrenze der Willkommensaktion ist eine Zählabfrage — ob sie hält,
// zeigt nur die echte Datenbank. Ein Test mit Attrappe prüfte die Verzweigung
// im eigenen Code und nicht, ob der Zähler die richtigen Zeilen findet.
//
// Was schiefgehen kann und hier festgehalten wird: Die Aktion gilt ewig, weil
// der Zähler nichts findet (falsche Herkunftszeichenkette), oder sie schließt
// zu früh, weil er auch Registrierungen ohne Aktion mitzählt.
import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { AKTIONS_QUELLE } from "./aktion";
import { aktionGewaehrt, aktuellerAktionsStand } from "./aktion-server";
import { db, resetDatabase } from "@/test/harness";

const zustand = {
  appMode: process.env.APP_MODE,
  ende: process.env.AKTION_ENDE,
  plaetze: process.env.AKTION_PLAETZE,
};

beforeAll(async () => {
  await resetDatabase();
});

beforeEach(() => {
  // Die Aktion gibt es nur in der WEG-SaaS-Tür; die B&W-Tür hat keine
  // öffentliche Registrierung.
  process.env.APP_MODE = "weg";
  // Weit in der Zukunft, damit dieser Test nicht mit dem Kalender abläuft.
  process.env.AKTION_ENDE = "2099-12-31";
  process.env.AKTION_PLAETZE = "3";
});

afterAll(async () => {
  process.env.APP_MODE = zustand.appMode;
  process.env.AKTION_ENDE = zustand.ende;
  process.env.AKTION_PLAETZE = zustand.plaetze;
  await db.$disconnect();
});

async function legeOrgAn(kennung: string, herkunft: string | null) {
  await db.organization.create({
    data: { slug: `aktion-${kennung}`, name: `Org ${kennung}`, referralSource: herkunft },
  });
}

describe("Willkommensaktion gegen die Datenbank", () => {
  it("zählt nur Gemeinschaften aus der Aktion — und schließt beim letzten Platz", async () => {
    await resetDatabase();
    // Registrierungen ohne Aktion dürfen keine Plätze verbrauchen.
    await legeOrgAn("ohne-1", null);
    await legeOrgAn("ohne-2", "hausmatch");
    expect((await aktuellerAktionsStand())?.restplaetze).toBe(3);

    await legeOrgAn("mit-1", AKTIONS_QUELLE);
    await legeOrgAn("mit-2", AKTIONS_QUELLE);
    expect((await aktuellerAktionsStand())?.restplaetze).toBe(1);
    expect(await aktionGewaehrt("PORTAL24", null)).toBe(true);

    // Der letzte Platz geht weg: Danach ist die Aktion vorbei, und der Code
    // gewährt nichts mehr.
    await legeOrgAn("mit-3", AKTIONS_QUELLE);
    expect(await aktuellerAktionsStand()).toBeNull();
    expect(await aktionGewaehrt("PORTAL24", null)).toBe(false);
  });

  it("gewährt nur mit Code oder Werbelink, nie ohne", async () => {
    await resetDatabase();
    expect(await aktionGewaehrt("", null)).toBe(false);
    expect(await aktionGewaehrt("PORTAL23", null)).toBe(false);
    expect(await aktionGewaehrt(null, "hausmatch")).toBe(false);
    // Beide Wege zählen: von Hand eingetippt und aus dem Werbelink.
    expect(await aktionGewaehrt("portal24-", null)).toBe(true);
    expect(await aktionGewaehrt(null, AKTIONS_QUELLE)).toBe(true);
  });

  it("gewährt nach dem Ende des Zeitraums nichts mehr", async () => {
    await resetDatabase();
    process.env.AKTION_ENDE = "2020-01-01";
    expect(await aktuellerAktionsStand()).toBeNull();
    expect(await aktionGewaehrt("PORTAL24", null)).toBe(false);
  });

  it("gewährt in der B&W-Tür nichts — dort gibt es keine Registrierung", async () => {
    await resetDatabase();
    process.env.APP_MODE = "verwaltung";
    expect(await aktuellerAktionsStand()).toBeNull();
    expect(await aktionGewaehrt("PORTAL24", null)).toBe(false);
  });
});
