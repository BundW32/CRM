// Datenzugriff für die Anmeldung der Bauabzugsteuer (§ 48a Abs. 1 EStG).
// Die Fristenregel selbst steht ohne Datenbank in `anmeldefrist.ts`.

import { db } from "@/lib/db";
import { anmeldefrist, anmeldemonat, fristlage, type Fristlage } from "./anmeldefrist";
import { NOT_REVERSED } from "./booking-scope";

export type AnmeldeMonat = {
  /** „2026-03" — dient zugleich als Schlüssel der Formularaktion. */
  monat: string;
  /** „März 2026" */
  bezeichnung: string;
  frist: Date;
  lage: Fristlage;
  summeCents: number;
  buchungen: {
    id: string;
    bookingDate: Date;
    text: string;
    amountCents: number;
    bauabzugCents: number;
    propertyName: string;
    craftsmanName: string | null;
  }[];
};

const MONATSNAMEN = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

function bezeichne(monat: string): string {
  const [jahr, m] = monat.split("-").map(Number);
  return `${MONATSNAMEN[m - 1]} ${jahr}`;
}

/**
 * Alle noch **nicht angemeldeten** Einbehalte, nach Zahlungsmonat gruppiert.
 *
 * Gruppiert wird nach dem Monat der Zahlung, nicht nach Objekt: Die Anmeldung
 * ist eine je Monat, nicht eine je Haus. Stornierte Buchungen bleiben außen vor
 * — eine zurückgenommene Zahlung ist keine Gegenleistung und löst nichts aus.
 */
export async function offeneAnmeldungen(
  organizationId: string,
  heute: Date = new Date(),
): Promise<AnmeldeMonat[]> {
  const buchungen = await db.booking.findMany({
    where: {
      organizationId,
      bauabzugCents: { not: null },
      bauabzugAngemeldetAt: null,
      ...NOT_REVERSED,
    },
    orderBy: { bookingDate: "asc" },
    select: {
      id: true,
      bookingDate: true,
      text: true,
      amountCents: true,
      bauabzugCents: true,
      property: { select: { name: true } },
      craftsman: { select: { name: true, company: true } },
    },
  });

  const nachMonat = new Map<string, AnmeldeMonat>();
  for (const b of buchungen) {
    const monat = anmeldemonat(b.bookingDate);
    let eintrag = nachMonat.get(monat);
    if (!eintrag) {
      const frist = anmeldefrist(b.bookingDate);
      eintrag = {
        monat,
        bezeichnung: bezeichne(monat),
        frist,
        lage: fristlage(frist, heute),
        summeCents: 0,
        buchungen: [],
      };
      nachMonat.set(monat, eintrag);
    }
    eintrag.summeCents += b.bauabzugCents ?? 0;
    eintrag.buchungen.push({
      id: b.id,
      bookingDate: b.bookingDate,
      text: b.text,
      amountCents: b.amountCents,
      bauabzugCents: b.bauabzugCents ?? 0,
      propertyName: b.property.name,
      craftsmanName: b.craftsman?.company || b.craftsman?.name || null,
    });
  }

  // Älteste Frist zuerst — die drängt.
  return [...nachMonat.values()].sort((a, b) => a.frist.getTime() - b.frist.getTime());
}

/**
 * Wie viele Anmeldungen sind überfällig oder werden es demnächst?
 *
 * Für das Abzeichen in der Navigation. Bewusst nur die dringenden: Eine Zahl,
 * die auch die entspannten Fälle mitzählt, steht dauerhaft da und wird ignoriert.
 */
export async function dringendeAnmeldungen(
  organizationId: string,
  heute: Date = new Date(),
): Promise<number> {
  const monate = await offeneAnmeldungen(organizationId, heute);
  return monate.filter((m) => m.lage !== "OFFEN").length;
}
