// Prüft das eigentliche Verhalten, das token-hash.test.ts nicht abdecken kann:
// dass die Datenbankabfrage der Reset-Konsumenten (login/reset/[token]) einen
// gehashten Token findet — und dass der in der Datenbank stehende Hash-Wert
// SELBST niemals als gültiger Token durchgeht.
//
// Letzteres war ein echter Fehler in einer ersten Fassung dieser Änderung: Dort
// prüfte die Abfrage übergangsweise "Hash ODER Rohwert", damit ein noch nicht
// umgestellter zweiter Erzeuger (verwaltung/nutzer/actions.ts) weiter
// funktionierte. Das öffnete dieselbe Lücke wieder, die der Hash schließen
// sollte: Wer den gespeicherten Hash-Wert kennt – etwa aus genau dem
// Datenbank-Leck, vor dem hier geschützt wird –, hätte ihn einfach als
// "Rohwert" eingereicht und wäre über die ODER-Bedingung direkt auf sich selbst
// getroffen. Dieser Test hätte das damals sofort gezeigt (siehe die erste,
// jetzt verworfene Fassung im Git-Verlauf).
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { db, resetDatabase, seedOrganization, type Fixture } from "@/test/harness";
import { hashToken } from "./token-hash";

let a: Fixture;

beforeAll(async () => {
  await resetDatabase();
  a = await seedOrganization("token");
});

afterAll(async () => {
  await resetDatabase();
  await db.$disconnect();
});

// Dieselbe Abfrage wie in login/reset/[token]/actions.ts und .../page.tsx.
async function findByToken(token: string) {
  return db.user.findFirst({
    where: {
      passwordResetToken: hashToken(token),
      passwordResetExpiry: { gt: new Date() },
      active: true,
    },
  });
}

describe("Passwort-Reset-Token: nur der Hash steht in der Datenbank", () => {
  it("findet den Nutzer über den ursprünglichen Rohwert", async () => {
    const roh = "roh-" + Math.random();
    await db.user.update({
      where: { id: a.mieter.id },
      data: { passwordResetToken: hashToken(roh), passwordResetExpiry: new Date(Date.now() + 60_000) },
    });
    expect(await findByToken(roh)).not.toBeNull();
  });

  it("lässt den gespeicherten Hash-Wert selbst NICHT als Token durchgehen", async () => {
    // Genau das ist die Eigenschaft, die den Hash sinnvoll macht: Wer nur den
    // Datenbankinhalt kennt (Leck, Backup, Log), kann den Link nicht einlösen.
    const roh = "geheim-" + Math.random();
    const gespeicherterHash = hashToken(roh);
    await db.user.update({
      where: { id: a.eigentuemer.id },
      data: { passwordResetToken: gespeicherterHash, passwordResetExpiry: new Date(Date.now() + 60_000) },
    });

    expect(await findByToken(gespeicherterHash)).toBeNull();
  });

  it("lehnt einen falschen Token ab", async () => {
    expect(await findByToken("nie-vergeben-" + Math.random())).toBeNull();
  });

  it("ignoriert einen abgelaufenen Token", async () => {
    const roh = "abgelaufen-" + Math.random();
    await db.user.update({
      where: { id: a.verwalter.id },
      data: { passwordResetToken: hashToken(roh), passwordResetExpiry: new Date(Date.now() - 1000) },
    });
    expect(await findByToken(roh)).toBeNull();
  });
});
