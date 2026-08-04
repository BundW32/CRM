import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db, resetDatabase, seedOrganization, type Fixture } from "@/test/harness";
import { loadRoadmap } from "./roadmap";

// „Jahresabrechnung 2025 — seit 33 Tagen überfällig", gemeldet für eine
// Gemeinschaft, die 2025 noch gar nicht bestand. Der Fahrplan leitete diesen
// Punkt allein aus dem Kalender ab: kein fertiger Abschluss fürs Vorjahr,
// Richtwert 30.06. überschritten, also überfällig.
//
// Ein Fehlalarm ist teurer als eine fehlende Meldung: Wer den einmal
// durchschaut hat, liest den nächsten Eintrag auch nicht mehr.
//
// Gegen eine echte Datenbank, weil genau die Abgrenzung des Buchungszeitraums
// zählt — eine nachgebaute Abfrage prüfte die eigene Erwartung.

describe("Fahrplan: Abrechnung nur mahnen, wenn es etwas abzurechnen gibt", () => {
  let a: Fixture;
  let konto: { id: string };
  // Fest im Jahr, damit der Richtwert 30.06. sicher überschritten ist.
  const jetzt = new Date(2026, 9, 15);

  beforeEach(async () => {
    await resetDatabase();
    a = await seedOrganization("fahrplan");
    konto = await db.ledgerAccount.create({
      data: {
        organizationId: a.org.id,
        propertyId: a.objekt.id,
        kind: "GIRO",
        name: "Girokonto",
      },
    });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  async function buchung(datum: Date) {
    return db.booking.create({
      data: {
        organization: { connect: { id: a.org.id } },
        property: { connect: { id: a.objekt.id } },
        account: { connect: { id: konto.id } },
        createdBy: { connect: { id: a.verwalter.id } },
        bookingDate: datum,
        kind: "AUSGABE",
        amountCents: 12_000,
        text: "Hausmeister",
      },
    });
  }

  const abrechnungsPunkt = async () =>
    (await loadRoadmap(a.objekt.id, jetzt)).find((i) => i.key === "abrechnung");

  it("schweigt, wenn im Vorjahr nichts gebucht wurde", async () => {
    // Die frisch gegründete WEG: Es gibt sie, aber 2025 gab es sie nicht.
    expect(await abrechnungsPunkt()).toBeUndefined();
  });

  it("schweigt auch, wenn nur im laufenden Jahr gebucht wurde", async () => {
    await buchung(new Date(2026, 2, 1));
    expect(await abrechnungsPunkt()).toBeUndefined();
  });

  it("mahnt, sobald das Vorjahr Buchungen trägt", async () => {
    await buchung(new Date(2025, 6, 1));
    const punkt = await abrechnungsPunkt();
    expect(punkt).toBeDefined();
    expect(punkt!.status).toBe("overdue");
    expect(punkt!.title).toContain("2025");
  });

  it("zählt stornierte Buchungen nicht mit", async () => {
    // Ein Storno hebt die Buchung auf. Bliebe sie hier zählend, mahnte der
    // Fahrplan eine Abrechnung für ein Jahr an, dessen einzige Bewegung
    // zurückgenommen wurde.
    // Ein Storno ist eine Gegenbuchung, kein Zeitstempel: Das Paar bleibt im
    // Journal sichtbar und fällt aus jeder fachlichen Auswertung heraus
    // (`NOT_REVERSED`). Beide Hälften müssen hier verschwinden – zählte nur
    // eine, mahnte der Fahrplan weiter oder die Gegenbuchung allein löste die
    // Mahnung neu aus.
    const gebucht = await buchung(new Date(2025, 6, 1));
    await db.booking.create({
      data: {
        organization: { connect: { id: a.org.id } },
        property: { connect: { id: a.objekt.id } },
        account: { connect: { id: konto.id } },
        createdBy: { connect: { id: a.verwalter.id } },
        reversalOf: { connect: { id: gebucht.id } },
        bookingDate: new Date(2025, 6, 2),
        kind: "EINNAHME",
        amountCents: 12_000,
        text: "Storno Hausmeister",
      },
    });
    expect(await abrechnungsPunkt()).toBeUndefined();
  });

  it("schweigt, wenn die Abrechnung fürs Vorjahr schon fertig ist", async () => {
    await buchung(new Date(2025, 6, 1));
    await db.annualStatement.create({
      data: {
        organizationId: a.org.id,
        propertyId: a.objekt.id,
        year: 2025,
        status: "FERTIG",
        createdById: a.verwalter.id,
      },
    });
    expect(await abrechnungsPunkt()).toBeUndefined();
  });

  it("mahnt die Versammlung unabhängig von Buchungen", async () => {
    // Gegenprobe: § 24 Abs. 1 WEG verlangt sie mindestens einmal jährlich —
    // das hängt nicht daran, ob Geld geflossen ist. Diese Meldung darf die
    // Korrektur oben nicht mit abschalten.
    const punkte = await loadRoadmap(a.objekt.id, jetzt);
    expect(punkte.some((i) => i.key === "versammlung")).toBe(true);
  });
});
