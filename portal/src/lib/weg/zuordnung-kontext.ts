// Lädt aus der Datenbank, was `zuordnung-vorschlag.ts` zum Raten braucht.
//
// Getrennt von der Regelkunde, aus zwei Gründen: Die Regeln bleiben so ohne
// Datenbank prüfbar, und derselbe Kontext speist zwei Stellen — die
// Import-Vorschau in der Buchhaltung und die Zuordnungs-Hilfe auf der
// Hausgeld-Seite. Zwei getrennte Ladewege wären zwei Wahrheiten.
import { db } from "@/lib/db";
import { NOT_REVERSED } from "./booking-scope";
import type { OffenerPostenMitPeriode, ZuordnungsKontext } from "./zuordnung-vorschlag";

/** Wie weit zurück Ausgaben für den Kostenart-Vorschlag befragt werden. */
const HISTORIE_MAX = 400;

export async function ladeZuordnungsKontext(
  propertyId: string,
  optionen: {
    stichtag?: Date;
    /**
     * Ausgaben-Historie mitladen. Die Hausgeld-Seite braucht sie nicht — dort
     * geht es nur um Einheiten, und eine Abfrage über 400 Ausgaben bei jedem
     * Seitenaufruf wäre umsonst.
     */
    mitHistorie?: boolean;
  } = {},
): Promise<ZuordnungsKontext> {
  const stichtag = optionen.stichtag ?? new Date();
  const mitHistorie = optionen.mitHistorie ?? true;
  const [units, mandate, eigentuemer, posten, historie] = await Promise.all([
    db.unit.findMany({
      where: { propertyId },
      select: { id: true, label: true },
      orderBy: { orderIndex: "asc" },
    }),
    db.sepaMandate.findMany({
      where: { propertyId, active: true },
      select: { unitId: true, iban: true },
    }),
    db.unitOwnership.findMany({
      where: {
        unit: { propertyId },
        validFrom: { lte: stichtag },
        OR: [{ validTo: null }, { validTo: { gt: stichtag } }],
      },
      select: { unitId: true, user: { select: { name: true } } },
    }),
    db.duePosting.findMany({
      where: { propertyId },
      select: {
        id: true,
        unitId: true,
        dueDate: true,
        amountCents: true,
        periodYear: true,
        periodMonth: true,
        source: true,
        allocations: { select: { amountCents: true } },
      },
    }),
    // Nur Ausgaben, die bereits eine Kostenart tragen — sie sind die Erfahrung,
    // aus der der Vorschlag stammt. Stornierte bleiben draußen: Eine Buchung,
    // die zurückgenommen wurde, ist kein Vorbild.
    mitHistorie
      ? db.booking.findMany({
          where: { propertyId, kind: "AUSGABE", costTypeId: { not: null }, ...NOT_REVERSED },
          select: {
            counterparty: true,
            reference: true,
            text: true,
            costTypeId: true,
            bookingDate: true,
            costType: { select: { name: true } },
          },
          orderBy: { bookingDate: "desc" },
          take: HISTORIE_MAX,
        })
      : [],
  ]);

  const ibanZuEinheit = new Map(
    mandate.map((m) => [m.iban.toUpperCase().replace(/[^A-Z0-9]/g, ""), m.unitId]),
  );

  // Mehrdeutige Nachnamen fliegen raus: Ein Hinweis, der auf zwei Einheiten
  // passt, ist kein Hinweis, sondern eine Fehlerquelle.
  const nachnameZaehler = new Map<string, Set<string>>();
  for (const o of eigentuemer) {
    const nachname = o.user.name.trim().split(/\s+/).at(-1)?.toLowerCase();
    if (!nachname || nachname.length < 4) continue;
    const menge = nachnameZaehler.get(nachname) ?? new Set<string>();
    menge.add(o.unitId);
    nachnameZaehler.set(nachname, menge);
  }
  const nachnameZuEinheit = new Map<string, string>();
  for (const [nachname, einheiten] of nachnameZaehler) {
    if (einheiten.size === 1) nachnameZuEinheit.set(nachname, [...einheiten][0]);
  }

  const offenePosten = new Map<string, OffenerPostenMitPeriode[]>();
  for (const p of posten) {
    const angerechnet = p.allocations.reduce((s, a) => s + a.amountCents, 0);
    const offenCents = p.amountCents - angerechnet;
    if (offenCents <= 0) continue;
    const liste = offenePosten.get(p.unitId) ?? [];
    liste.push({
      id: p.id,
      dueDate: p.dueDate,
      hauptCents: offenCents,
      offenCents,
      periodYear: p.periodYear,
      periodMonth: p.periodMonth,
      quelle: p.source === "SONDERUMLAGE" ? "SONDERUMLAGE" : "WIRTSCHAFTSPLAN",
    });
    offenePosten.set(p.unitId, liste);
  }

  return {
    units,
    ibanZuEinheit,
    nachnameZuEinheit,
    offenePosten,
    ausgabenHistorie: historie.map((h) => ({
      counterparty: h.counterparty,
      reference: h.reference,
      text: h.text,
      costTypeId: h.costTypeId as string,
      costTypeName: h.costType?.name ?? "",
      bookingDate: h.bookingDate,
    })),
  };
}
