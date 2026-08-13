// Selbstpflege am eigenen Konto — gegen eine ECHTE Datenbank.
//
// Die Frage, die hier beantwortet wird, ist eine Zugriffsfrage: Ein Eigentümer
// darf mit diesen Funktionen **nur seine eigenen** Daten ändern. Am Quelltext
// lässt sich das nicht ablesen — ein `where` mit der falschen ID sieht genauso
// aus wie eines mit der richtigen. Nur der Durchlauf zeigt, was die Abfrage
// tatsächlich anfasst. Deshalb `*.dbtest.ts` und keine Attrappen (siehe
// `portal/AGENTS.md`, „Prüfungen mit Datenbank").
//
// Zwei vollständige Organisationen, und jede Prüfung läuft über Kreuz — in
// BEIDE Richtungen. Nur A→B zu prüfen übersähe eine Funktion, die versehentlich
// auf eine feste ID zeigt: Sie hielte in einer Richtung und wäre in der anderen
// offen.
import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { db, resetDatabase, seedOrganization, type Fixture } from "@/test/harness";
import {
  brichEmailWechselAb,
  leseKontaktdaten,
  speichereEigeneKontaktdaten,
  starteEmailWechsel,
  uebernehmeEmailWechsel,
} from "./eigene-daten";
import { hashToken } from "./token-hash";

let a: Fixture;
let b: Fixture;

beforeAll(async () => {
  await resetDatabase();
  a = await seedOrganization("eigen-a");
  b = await seedOrganization("eigen-b");
});

afterAll(async () => {
  await resetDatabase();
  await db.$disconnect();
});

/** Der aktuelle Stand eines Nutzers, so wie die Anmeldung ihn sieht. */
async function stand(userId: string) {
  return db.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      email: true,
      phone: true,
      street: true,
      zip: true,
      city: true,
      preferredContact: true,
      pendingEmail: true,
      emailChangeToken: true,
      emailChangeExpiry: true,
    },
  });
}

const KONTAKT = leseKontaktdaten({
  phone: "0221 999",
  street: "Eigenweg 1",
  zip: "50667",
  city: "Köln",
  preferredContact: "TELEFON",
});

describe("Kontaktdaten: nur die eigenen", () => {
  beforeEach(async () => {
    for (const id of [a.eigentuemer.id, b.eigentuemer.id]) {
      await db.user.update({
        where: { id },
        data: { phone: null, street: null, zip: null, city: null, preferredContact: null },
      });
    }
  });

  it("schreibt an den eigenen Datensatz", async () => {
    await speichereEigeneKontaktdaten(a.eigentuemer.id, KONTAKT);
    const eigen = await stand(a.eigentuemer.id);
    expect(eigen.phone).toBe("0221 999");
    expect(eigen.city).toBe("Köln");
    expect(eigen.preferredContact).toBe("TELEFON");
  });

  it("lässt den Eigentümer der anderen Organisation unberührt (A → B)", async () => {
    await speichereEigeneKontaktdaten(a.eigentuemer.id, KONTAKT);
    const fremd = await stand(b.eigentuemer.id);
    expect(fremd.phone).toBeNull();
    expect(fremd.street).toBeNull();
    expect(fremd.preferredContact).toBeNull();
  });

  it("lässt den Eigentümer der anderen Organisation unberührt (B → A)", async () => {
    await speichereEigeneKontaktdaten(b.eigentuemer.id, KONTAKT);
    const fremd = await stand(a.eigentuemer.id);
    expect(fremd.phone).toBeNull();
    expect(fremd.street).toBeNull();
    expect(fremd.preferredContact).toBeNull();
  });

  it("rührt auch die übrigen Personen der EIGENEN Organisation nicht an", async () => {
    // Die naheliegendste Fehlform wäre ein Filter auf die Organisation statt
    // auf die Person — innerhalb der WEG sähe das lange richtig aus.
    await speichereEigeneKontaktdaten(a.eigentuemer.id, KONTAKT);
    for (const id of [a.mieter.id, a.verwalter.id]) {
      expect((await stand(id)).phone).toBeNull();
    }
  });
});

describe("E-Mail-Wechsel: Doppel-Opt-in", () => {
  beforeEach(async () => {
    for (const id of [a.eigentuemer.id, b.eigentuemer.id]) {
      await db.user.update({
        where: { id },
        data: { pendingEmail: null, emailChangeToken: null, emailChangeExpiry: null },
      });
    }
  });

  it("ändert die Anmeldeadresse NICHT schon beim Anfordern", async () => {
    // Der Kern des Doppel-Opt-ins: Ein Tippfehler in der neuen Adresse darf den
    // Zugang nicht sperren. Bis zum Klick gilt die bisherige Adresse weiter.
    const vorher = await stand(a.eigentuemer.id);
    const ergebnis = await starteEmailWechsel(a.eigentuemer.id, "neu-1@test.invalid");
    expect(ergebnis.status).toBe("ok");

    const nachher = await stand(a.eigentuemer.id);
    expect(nachher.email).toBe(vorher.email);
    expect(nachher.pendingEmail).toBe("neu-1@test.invalid");
  });

  it("legt den Token nur als Hash ab", async () => {
    const ergebnis = await starteEmailWechsel(a.eigentuemer.id, "neu-2@test.invalid");
    if (ergebnis.status !== "ok") throw new Error("Anforderung fehlgeschlagen");
    const gespeichert = (await stand(a.eigentuemer.id)).emailChangeToken;
    expect(gespeichert).toBe(hashToken(ergebnis.token));
    expect(gespeichert).not.toBe(ergebnis.token);
  });

  it("übernimmt die Adresse erst mit dem Token — und nur beim Anfordernden", async () => {
    const ergebnis = await starteEmailWechsel(a.eigentuemer.id, "neu-3@test.invalid");
    if (ergebnis.status !== "ok") throw new Error("Anforderung fehlgeschlagen");
    const fremdVorher = await stand(b.eigentuemer.id);

    const uebernahme = await uebernehmeEmailWechsel(ergebnis.token);
    expect(uebernahme.status).toBe("ok");

    expect((await stand(a.eigentuemer.id)).email).toBe("neu-3@test.invalid");
    // Der Token eines Nutzers darf an keinem anderen Datensatz etwas bewegen.
    expect((await stand(b.eigentuemer.id)).email).toBe(fremdVorher.email);
  });

  it("räumt Vormerkung und Token bei der Übernahme ab (genau einmal einlösbar)", async () => {
    const ergebnis = await starteEmailWechsel(a.eigentuemer.id, "neu-4@test.invalid");
    if (ergebnis.status !== "ok") throw new Error("Anforderung fehlgeschlagen");
    await uebernehmeEmailWechsel(ergebnis.token);

    const nach = await stand(a.eigentuemer.id);
    expect(nach.pendingEmail).toBeNull();
    expect(nach.emailChangeToken).toBeNull();
    expect(nach.emailChangeExpiry).toBeNull();

    // Zweiter Klick auf denselben Link: nichts mehr zu finden.
    expect((await uebernehmeEmailWechsel(ergebnis.token)).status).toBe("ungueltig");
  });

  it("lässt den gespeicherten Hash-Wert selbst NICHT als Token durchgehen", async () => {
    // Dieselbe Eigenschaft, die den Hash beim Passwort-Reset sinnvoll macht:
    // Wer nur den Datenbankinhalt kennt (Leck, Backup, Log), kann den Link
    // nicht einlösen.
    const ergebnis = await starteEmailWechsel(a.eigentuemer.id, "neu-5@test.invalid");
    if (ergebnis.status !== "ok") throw new Error("Anforderung fehlgeschlagen");
    const gespeicherterHash = (await stand(a.eigentuemer.id)).emailChangeToken!;

    expect((await uebernehmeEmailWechsel(gespeicherterHash)).status).toBe("ungueltig");
    expect((await stand(a.eigentuemer.id)).email).not.toBe("neu-5@test.invalid");
  });

  it("lässt einen abgelaufenen Token verfallen", async () => {
    const ergebnis = await starteEmailWechsel(a.eigentuemer.id, "neu-6@test.invalid");
    if (ergebnis.status !== "ok") throw new Error("Anforderung fehlgeschlagen");
    const vorher = await stand(a.eigentuemer.id);

    // 24 Stunden später — die Grenze steht in `EMAIL_WECHSEL_GUELTIG_STUNDEN`.
    const spaeter = new Date(Date.now() + 25 * 3600_000);
    expect((await uebernehmeEmailWechsel(ergebnis.token, spaeter)).status).toBe("abgelaufen");
    expect((await stand(a.eigentuemer.id)).email).toBe(vorher.email);
  });

  it("verweigert eine Adresse, die einem anderen Zugang gehört", async () => {
    // `email` ist @unique und der Anmeldename: Zwei Konten mit derselben
    // Adresse gibt es nicht — und ein „stiller" Fehlschlag hier hieße, dass
    // jemand die Anmeldung eines anderen übernähme.
    const fremdeAdresse = (await stand(b.eigentuemer.id)).email!;
    expect((await starteEmailWechsel(a.eigentuemer.id, fremdeAdresse)).status).toBe("vergeben");
    expect((await stand(a.eigentuemer.id)).pendingEmail).toBeNull();
  });

  it("erkennt die Belegung auch, wenn sie erst nach der Anfrage entsteht", async () => {
    const frei = `spaeter-belegt-${Date.now()}@test.invalid`;
    const ergebnis = await starteEmailWechsel(a.eigentuemer.id, frei);
    if (ergebnis.status !== "ok") throw new Error("Anforderung fehlgeschlagen");

    // Zwischen Anfrage und Klick schnappt sich jemand anderes die Adresse.
    await db.user.update({ where: { id: b.eigentuemer.id }, data: { email: frei } });

    expect((await uebernehmeEmailWechsel(ergebnis.token)).status).toBe("vergeben");
    expect((await stand(a.eigentuemer.id)).email).not.toBe(frei);
    // Die Vormerkung bleibt stehen — sie ist nicht falsch, nur nicht einlösbar.
    expect((await stand(a.eigentuemer.id)).pendingEmail).toBe(frei);
  });

  it("meldet die eigene Adresse als unverändert, statt eine Mail zu schicken", async () => {
    const eigene = (await stand(a.eigentuemer.id)).email!;
    expect((await starteEmailWechsel(a.eigentuemer.id, eigene.toUpperCase())).status).toBe(
      "unveraendert",
    );
  });

  it("nimmt eine offene Anfrage zurück, ohne die Adresse anzutasten", async () => {
    const vorher = await stand(a.eigentuemer.id);
    const ergebnis = await starteEmailWechsel(a.eigentuemer.id, "neu-7@test.invalid");
    if (ergebnis.status !== "ok") throw new Error("Anforderung fehlgeschlagen");

    await brichEmailWechselAb(a.eigentuemer.id);
    const nach = await stand(a.eigentuemer.id);
    expect(nach.email).toBe(vorher.email);
    expect(nach.pendingEmail).toBeNull();
    // Der versandte Link ist damit tot.
    expect((await uebernehmeEmailWechsel(ergebnis.token)).status).toBe("ungueltig");
  });

  it("nimmt nur die eigene Anfrage zurück (B bleibt stehen)", async () => {
    const meins = await starteEmailWechsel(a.eigentuemer.id, "neu-8@test.invalid");
    const fremd = await starteEmailWechsel(b.eigentuemer.id, "neu-9@test.invalid");
    expect(meins.status).toBe("ok");
    expect(fremd.status).toBe("ok");

    await brichEmailWechselAb(a.eigentuemer.id);
    expect((await stand(b.eigentuemer.id)).pendingEmail).toBe("neu-9@test.invalid");
  });
});
