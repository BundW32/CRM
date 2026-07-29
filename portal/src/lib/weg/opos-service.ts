// Offene Posten eines Objekts — auf Grundlage der Zahlungszuordnungen.
//
// Die alte Rechnung war „Σ fällige Sollstellungen − Σ Einnahmen der Einheit".
// Was daran falsch ist, steht in `payment-allocation.ts`. Hier wird stattdessen
// je Forderung gerechnet: offen = Betrag − was auf sie angerechnet wurde.
//
// Nicht zugeordnete Zahlungen einer Einheit bleiben sichtbar als **Guthaben**.
// Sie einfach vom Rückstand abzuziehen, war der bequeme Weg — und genau der
// Grund, warum eine Vorauszahlung einen offenen Monat verdecken konnte.
import { db } from "@/lib/db";
import { NOT_REVERSED } from "./booking-scope";
import { basiszinssaetze, verzugJeForderung } from "./verzug-service";
import {
  baueOpos,
  leereOposZeile,
  type OffenerPosten,
  type OposZeile,
  type Tilgungszweck,
} from "./payment-allocation";

export type UnitOpos = OposZeile & {
  unitId: string;
  /** Zahlungen dieser Einheit, die noch keiner Forderung zugeordnet sind. */
  nichtZugeordnetCents: number;
};

/** Offene Posten je Einheit, mit Altersstruktur. */
export async function oposJeEinheit(
  propertyId: string,
  stichtag: Date = new Date(),
): Promise<Map<string, UnitOpos>> {
  const [posten, zahlungen] = await Promise.all([
    db.duePosting.findMany({
      where: { propertyId },
      select: {
        id: true,
        unitId: true,
        dueDate: true,
        amountCents: true,
        allocations: { select: { amountCents: true } },
      },
    }),
    // Zugeordnete Einnahmen je Einheit — Grundlage für das Guthaben.
    db.booking.findMany({
      where: { propertyId, kind: "EINNAHME", unitId: { not: null }, ...NOT_REVERSED },
      select: { unitId: true, amountCents: true, allocations: { select: { amountCents: true } } },
    }),
  ]);

  const jeEinheit = new Map<string, { dueDate: Date; offenCents: number }[]>();
  for (const p of posten) {
    const angerechnet = p.allocations.reduce((s, a) => s + a.amountCents, 0);
    const liste = jeEinheit.get(p.unitId) ?? [];
    liste.push({ dueDate: p.dueDate, offenCents: p.amountCents - angerechnet });
    jeEinheit.set(p.unitId, liste);
  }

  const guthaben = new Map<string, number>();
  for (const b of zahlungen) {
    const angerechnet = b.allocations.reduce((s, a) => s + a.amountCents, 0);
    const offen = b.amountCents - angerechnet;
    if (offen === 0) continue;
    guthaben.set(b.unitId as string, (guthaben.get(b.unitId as string) ?? 0) + offen);
  }

  const ergebnis = new Map<string, UnitOpos>();
  for (const unitId of new Set([...jeEinheit.keys(), ...guthaben.keys()])) {
    ergebnis.set(unitId, {
      unitId,
      ...(jeEinheit.has(unitId) ? baueOpos(jeEinheit.get(unitId)!, stichtag) : leereOposZeile()),
      nichtZugeordnetCents: guthaben.get(unitId) ?? 0,
    });
  }
  return ergebnis;
}

/**
 * Rückstand einer Einheit — die Zahl, die in der Mahnung nach außen geht.
 *
 * Bewusst **ohne** Verrechnung nicht zugeordneter Zahlungen: Eine Mahnung, die
 * eine noch nicht zugeordnete Überweisung stillschweigend gegenrechnet, nennt
 * einen Betrag, den niemand nachvollziehen kann. Der Verwalter ordnet erst zu,
 * dann mahnt er — die Oberfläche weist ein Guthaben deshalb getrennt aus.
 */
export async function rueckstandDerEinheit(
  unitId: string,
  stichtag: Date = new Date(),
): Promise<number> {
  const posten = await db.duePosting.findMany({
    where: { unitId, dueDate: { lte: stichtag } },
    select: { dueDate: true, amountCents: true, allocations: { select: { amountCents: true } } },
  });
  return posten.reduce(
    (summe, p) => summe + Math.max(0, p.amountCents - p.allocations.reduce((s, a) => s + a.amountCents, 0)),
    0,
  );
}

/**
 * Offene Forderungen einer Einheit, aufbereitet für den Zuordnungsvorschlag.
 *
 * `gemahnt` bestimmt nach § 366 Abs. 2 BGB die Reihenfolge. Als gemahnt gilt
 * eine Forderung, wenn zum Zeitpunkt ihrer Fälligkeit bereits eine **versendete**
 * Mahnung für die Einheit vorlag — ein unversendeter Entwurf setzt niemanden in
 * Verzug.
 *
 * **Kosten und Zinsen sind echt.** Verzugszinsen laufen nach § 288 Abs. 1 BGB
 * auf den offenen Rest jeder Forderung; Mahnkosten fallen je versendeter
 * Mahnung an und liegen nach § 367 Abs. 1 BGB in der Tilgung vorn. Ist für den
 * Zeitraum kein Basiszinssatz hinterlegt, bleiben die Zinsen 0 — dann weist die
 * Oberfläche aus, dass nicht gerechnet werden konnte, statt eine Null zu
 * zeigen, die wie „keine Zinsen" aussieht.
 *
 * Die Mahnkosten hängen an der Einheit, nicht an einer einzelnen Forderung.
 * Sie werden deshalb der **ältesten** offenen Forderung zugeschlagen: Dort
 * greift § 367 zuerst, und genau das ist die Reihenfolge, in der eine Zahlung
 * sie tilgen soll.
 */
export async function offenePostenDerEinheit(
  unitId: string,
  stichtag: Date = new Date(),
): Promise<OffenerPosten[]> {
  const [posten, mahnungen, einheit] = await Promise.all([
    db.duePosting.findMany({
      where: { unitId },
      orderBy: { dueDate: "asc" },
      select: {
        id: true,
        dueDate: true,
        amountCents: true,
        source: true,
        allocations: { select: { amountCents: true } },
      },
    }),
    db.hausgeldMahnung.findMany({
      where: { unitId, sentAt: { not: null } },
      orderBy: { sentAt: "asc" },
      select: { sentAt: true, feeCents: true },
    }),
    db.unit.findUnique({
      where: { id: unitId },
      select: { property: { select: { organizationId: true } } },
    }),
  ]);
  const ersteMahnung = mahnungen[0]?.sentAt ?? null;
  const mahnkostenCents = mahnungen.reduce((s, m) => s + m.feeCents, 0);

  const saetze = einheit ? await basiszinssaetze(einheit.property.organizationId) : [];
  const offen = posten.map((p) => ({
    id: p.id,
    dueDate: p.dueDate,
    offenCents: p.amountCents - p.allocations.reduce((s, a) => s + a.amountCents, 0),
  }));
  const zinsen = verzugJeForderung(offen, saetze, stichtag);
  // Älteste noch offene **und bereits fällige** Forderung — sie trägt die
  // Mahnkosten (siehe oben). Die Fälligkeit gehört in die Bedingung: Die Liste
  // wird unten auf fällige Posten gefiltert. Hinge die Kostenzeile an einer
  // künftigen Forderung — etwa wenn alle vergangenen bezahlt sind —, fiele sie
  // mit heraus, und die Mahnkosten wären lautlos verschwunden.
  const aeltesteOffene =
    offen.find((o) => o.offenCents > 0 && o.dueDate <= stichtag)?.id ?? null;

  return posten
    .map((p) => ({
      id: p.id,
      dueDate: p.dueDate,
      hauptCents: p.amountCents - p.allocations.reduce((s, a) => s + a.amountCents, 0),
      kostenCents: p.id === aeltesteOffene ? mahnkostenCents : 0,
      zinsenCents: zinsen.get(p.id)?.zinsenCents ?? 0,
      gemahnt: ersteMahnung !== null && p.dueDate <= ersteMahnung,
      // Alles, was nicht ausdrücklich Sonderumlage ist, zählt als laufende
      // Forderung — auch der übernommene Stand aus der Vorverwaltung.
      quelle: (p.source === "SONDERUMLAGE" ? "SONDERUMLAGE" : "WIRTSCHAFTSPLAN") as Tilgungszweck,
    }))
    .filter((p) => p.hauptCents > 0 && p.dueDate <= stichtag);
}

/** Noch nicht angerechneter Teil einer Zahlung. */
export async function offenerZahlungsbetrag(bookingId: string): Promise<number> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: { amountCents: true, allocations: { select: { amountCents: true } } },
  });
  if (!booking) return 0;
  return booking.amountCents - booking.allocations.reduce((s, a) => s + a.amountCents, 0);
}
