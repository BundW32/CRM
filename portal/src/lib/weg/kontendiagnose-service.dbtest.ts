import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db, resetDatabase, seedOrganization, type Fixture } from "@/test/harness";
import { stimmeKontenDerAbrechnungAb } from "./kontendiagnose-service";
import { computeStatementView } from "./statement-service";

// Gegen eine ECHTE Datenbank, weil hier zwei Dinge zusammenkommen, die sich am
// Quelltext nicht ablesen lassen:
//
// 1. **Reichweite.** Die Diagnose sucht Buchungen nach Betrag und Datum — also
//    nach Merkmalen, die zwei Gemeinschaften ohne Weiteres teilen. Zwei WEGs mit
//    einer Zahlung über 1.240,00 € am 3. Januar sind kein Sonderfall. Fehlt an
//    einer Abfrage der `propertyId`-Filter, nennt die Diagnose eine fremde
//    Buchung beim Namen und verlinkt sie — mit Text und Betrag.
// 2. **Das Zeitfenster.** Ob „± 10 Tage um das Jahresende" wirklich zehn Tage
//    sind, entscheidet die Datumsgrenze in der Abfrage, nicht der Kommentar
//    darüber.
//
// Attrappen für `db` prüften hier nur die eigenen Verzweigungen.

const JAHR = 2026;

describe("Kontendiagnose der Jahresabrechnung", () => {
  let a: Fixture;
  let b: Fixture;

  beforeEach(async () => {
    await resetDatabase();
    a = await seedOrganization("diag-a");
    b = await seedOrganization("diag-b");
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  /**
   * Ein Objekt mit Giro- und Rücklagenkonto und einer Entwurfsabrechnung.
   * Der gemeldete Endbestand liegt bewusst 1.240,00 € über dem gerechneten —
   * genau die Abweichung, für die es eine Erklärung zu finden gilt.
   */
  async function richteAbrechnungEin(
    f: Fixture,
    gemeldetGiroCents: number,
    gemeldetRuecklageCents = 4_000_000,
  ) {
    const organizationId = f.org.id;
    const propertyId = f.objekt.id;
    const giro = await db.ledgerAccount.create({
      data: { organizationId, propertyId, kind: "GIRO", name: "Girokonto" },
    });
    const ruecklage = await db.ledgerAccount.create({
      data: {
        organizationId,
        propertyId,
        kind: "RUECKLAGE",
        name: "Rücklagenkonto",
        openingBalanceCents: 4_000_000,
      },
    });
    const statement = await db.annualStatement.create({
      data: {
        organizationId,
        propertyId,
        year: JAHR,
        createdById: f.verwalter.id,
      },
    });
    await db.statementAccountCheck.create({
      data: { statementId: statement.id, accountId: giro.id, reportedEndCents: gemeldetGiroCents },
    });
    await db.statementAccountCheck.create({
      data: {
        statementId: statement.id,
        accountId: ruecklage.id,
        reportedEndCents: gemeldetRuecklageCents,
      },
    });
    return { giro, ruecklage, statement };
  }

  /** Eine Buchung, die den Fehlbetrag erklären würde — mit wählbarem Datum. */
  async function randbuchung(f: Fixture, accountId: string, datum: Date, text: string) {
    return db.booking.create({
      data: {
        organizationId: f.org.id,
        propertyId: f.objekt.id,
        accountId,
        createdById: f.verwalter.id,
        kind: "EINNAHME",
        bookingDate: datum,
        amountCents: 124_000,
        text,
      },
    });
  }

  async function diagnose(f: Fixture, statementId: string) {
    const property = { id: f.objekt.id, fiscalYearStartMonth: 1 };
    const view = await computeStatementView(property, JAHR, statementId);
    return stimmeKontenDerAbrechnungAb(property, { id: statementId, year: JAHR }, view);
  }

  it("erklärt die Abweichung mit der Buchung kurz nach dem Jahresende", async () => {
    const { giro, statement } = await richteAbrechnungEin(a, 124_000);
    await randbuchung(a, giro.id, new Date("2027-01-03T00:00:00Z"), "Hausgeld Dezember, spät");

    const ergebnis = await diagnose(a, statement.id);
    const konto = ergebnis.find((k) => k.accountId === giro.id)!;
    expect(konto.diffCents).toBe(124_000);
    expect(konto.verdachte.map((v) => v.art)).toContain("buchung-am-jahresrand");
    expect(
      konto.verdachte.find((v) => v.art === "buchung-am-jahresrand")!.text,
    ).toContain("Hausgeld Dezember, spät");
  });

  it("greift nicht weiter als zehn Tage über das Jahresende hinaus", async () => {
    // Ohne diese Grenze fände die Suche irgendwann jede Buchung des Folgejahres
    // mit passendem Betrag — und schickte den Verwalter auf eine falsche Fährte.
    const { giro, statement } = await richteAbrechnungEin(a, 124_000);
    await randbuchung(a, giro.id, new Date("2027-02-15T00:00:00Z"), "Ganz andere Zahlung");

    const ergebnis = await diagnose(a, statement.id);
    const konto = ergebnis.find((k) => k.accountId === giro.id)!;
    expect(konto.diffCents).toBe(124_000);
    expect(konto.verdachte.map((v) => v.art)).not.toContain("buchung-am-jahresrand");
  });

  it("nennt niemals eine Buchung der anderen Organisation — in beide Richtungen", async () => {
    const objektA = await richteAbrechnungEin(a, 124_000);
    const objektB = await richteAbrechnungEin(b, 124_000);
    // Identischer Betrag, identisches Datum, sprechender Text: Wäre der
    // Objektfilter defekt, stünde er in der Diagnose der jeweils anderen WEG.
    await randbuchung(a, objektA.giro.id, new Date("2027-01-03T00:00:00Z"), "GEHEIM A");
    await randbuchung(b, objektB.giro.id, new Date("2027-01-03T00:00:00Z"), "GEHEIM B");

    const vonA = JSON.stringify(await diagnose(a, objektA.statement.id));
    const vonB = JSON.stringify(await diagnose(b, objektB.statement.id));

    expect(vonA).toContain("GEHEIM A");
    expect(vonA).not.toContain("GEHEIM B");
    expect(vonB).toContain("GEHEIM B");
    expect(vonB).not.toContain("GEHEIM A");
  });

  it("sieht auch die Rücklagenbuchungen nur im eigenen Objekt", async () => {
    // Beide Konten stimmen — der Verdacht hängt nicht an einer Abweichung.
    // Eine als Einnahme gebuchte Zuführung lässt den Kontostand stimmen und
    // die Rücklage in der Abrechnung trotzdem falsch aussehen.
    const objektA = await richteAbrechnungEin(a, 0, 4_600_000);
    const objektB = await richteAbrechnungEin(b, 0, 4_600_000);
    for (const [f, objekt, marke] of [
      [a, objektA, "ZUFUEHRUNG A"],
      [b, objektB, "ZUFUEHRUNG B"],
    ] as const) {
      await db.booking.create({
        data: {
          organizationId: f.org.id,
          propertyId: f.objekt.id,
          accountId: objekt.ruecklage.id,
          createdById: f.verwalter.id,
          // Falsche Art: Als Zuführung zählt nur eine Umbuchung.
          kind: "EINNAHME",
          bookingDate: new Date("2026-03-01T00:00:00Z"),
          amountCents: 600_000,
          text: marke,
        },
      });
    }

    const ergebnisA = await diagnose(a, objektA.statement.id);
    expect(ergebnisA.find((k) => k.accountId === objektA.ruecklage.id)!.stimmt).toBe(true);
    const vonA = JSON.stringify(ergebnisA);
    expect(vonA).toContain("ZUFUEHRUNG A");
    expect(vonA).not.toContain("ZUFUEHRUNG B");

    const vonB = JSON.stringify(await diagnose(b, objektB.statement.id));
    expect(vonB).toContain("ZUFUEHRUNG B");
    expect(vonB).not.toContain("ZUFUEHRUNG A");
  });

  it("zieht die Vorjahresabweichung nur aus der eigenen Abrechnung", async () => {
    // Der Verdacht „fehlender Anfangsbestand" hängt daran, dass die Abweichung
    // im Vorjahr dieselbe war. Käme die Zahl aus einer fremden Abrechnung, wäre
    // die Aussage frei erfunden.
    const { giro, statement } = await richteAbrechnungEin(a, 124_000);
    const vorjahrB = await db.annualStatement.create({
      data: {
        organizationId: b.org.id,
        propertyId: b.objekt.id,
        year: JAHR - 1,
        status: "FERTIG",
        finalizedAt: new Date(),
        createdById: b.verwalter.id,
        snapshot: { accounts: [{ id: giro.id, endCents: 0 }] },
      },
    });
    await db.statementAccountCheck.create({
      data: { statementId: vorjahrB.id, accountId: giro.id, reportedEndCents: 124_000 },
    });

    const ergebnis = await diagnose(a, statement.id);
    const verdacht = ergebnis
      .find((k) => k.accountId === giro.id)!
      .verdachte.find((v) => v.art === "anfangsbestand")!;
    // Der Verdacht selbst ist richtig (Anfangsbestand 0), aber er darf sich
    // nicht auf ein Vorjahr berufen, das zu einer anderen WEG gehört.
    expect(verdacht.text).not.toContain("Vorjahres");
  });
});
