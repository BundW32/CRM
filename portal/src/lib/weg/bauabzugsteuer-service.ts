// Datenzugriff für die Bauabzugsteuer (§ 48 EStG). Die Regeln selbst stehen
// ohne Datenbank in `bauabzugsteuer.ts` und sind dort geprüft.

import { db } from "@/lib/db";
import { NOT_REVERSED } from "./booking-scope";
import { kalenderjahr, naeheZurGrenze, pruefeEinbehalt, type Pruefung } from "./bauabzugsteuer";

/**
 * Was in diesem Kalenderjahr bereits an diesen Handwerker für **Bauleistungen**
 * gezahlt wurde.
 *
 * Drei Feinheiten, die alle drei falsch wären, ließe man sie weg:
 *
 * - **Nur Ausgaben.** Eine Gutschrift des Handwerkers erhöht die Gegenleistung
 *   nicht.
 * - **Ohne stornierte Buchungen** (`NOT_REVERSED`). Eine zurückgenommene
 *   Zahlung ist keine Gegenleistung — sonst löste ein korrigierter Zahlendreher
 *   eine Einbehaltungspflicht aus, die es nie gab.
 * - **Über alle Objekte der Organisation.** Die Grenze gilt je Leistendem, nicht
 *   je Haus. Zahlt dieselbe Gemeinschaft aus zwei Objekten je 3.000 € an
 *   denselben Betrieb, ist die Grenze überschritten. (Rechtlich ist
 *   Leistungsempfängerin die einzelne WEG; verwaltet eine Organisation mehrere
 *   Gemeinschaften, ist die objektübergreifende Summe die vorsichtigere
 *   Auskunft — sie warnt eher zu früh als zu spät, und die Entscheidung trifft
 *   ohnehin ein Mensch.)
 */
export async function bauleistungenImJahr(
  organizationId: string,
  craftsmanId: string,
  stichtag: Date,
): Promise<number> {
  const { von, bis } = kalenderjahr(stichtag);
  const summe = await db.booking.aggregate({
    _sum: { amountCents: true },
    where: {
      organizationId,
      craftsmanId,
      kind: "AUSGABE",
      costType: { constructionWork: true },
      bookingDate: { gte: von, lt: bis },
      ...NOT_REVERSED,
    },
  });
  return summe._sum.amountCents ?? 0;
}

/**
 * Die vollständige Prüfung für eine geplante Zahlung.
 *
 * Aufzurufen **vor** dem Buchen. Danach ist ein Einbehalt nicht mehr möglich
 * und es bleibt nur noch die Haftung nach § 48a Abs. 3 EStG.
 */
export async function pruefeZahlung(opt: {
  organizationId: string;
  craftsmanId: string | null;
  costTypeId: string | null;
  betragCents: number;
  stichtag: Date;
}): Promise<Pruefung> {
  // Ohne Handwerker oder ohne Kostenart lässt sich nichts sagen. Das ist der
  // Regelfall bei Zahlungen, die keine Bauleistung sind (Versicherung, Strom) —
  // deshalb keine Warnung, sondern schlicht keine Pflicht.
  if (!opt.craftsmanId || !opt.costTypeId) return { pflicht: false, grund: "KEINE_BAULEISTUNG" };

  const [kostenart, handwerker] = await Promise.all([
    db.costType.findUnique({ where: { id: opt.costTypeId }, select: { constructionWork: true } }),
    db.craftsman.findUnique({
      where: { id: opt.craftsmanId },
      select: { organizationId: true, exemptionNumber: true, exemptionValidUntil: true },
    }),
  ]);
  if (!kostenart?.constructionWork) return { pflicht: false, grund: "KEINE_BAULEISTUNG" };
  // Fremder Handwerker: nicht prüfen, sondern nichts behaupten. Eine Summe über
  // eine andere Organisation dürfte hier ohnehin nicht entstehen.
  if (!handwerker || handwerker.organizationId !== opt.organizationId) {
    return { pflicht: false, grund: "KEINE_BAULEISTUNG" };
  }

  const bisherCents = await bauleistungenImJahr(opt.organizationId, opt.craftsmanId, opt.stichtag);
  return pruefeEinbehalt({
    bauleistung: true,
    freistellung: {
      nummer: handwerker.exemptionNumber,
      gueltigBis: handwerker.exemptionValidUntil,
    },
    bisherCents,
    betragCents: opt.betragCents,
    stichtag: opt.stichtag,
  });
}

/** Jahressummen aller Handwerker mit Bauleistungen — für die Übersicht. */
export async function bauleistungenJeHandwerker(organizationId: string, stichtag: Date) {
  const { von, bis } = kalenderjahr(stichtag);
  const summen = await db.booking.groupBy({
    by: ["craftsmanId"],
    _sum: { amountCents: true },
    where: {
      organizationId,
      craftsmanId: { not: null },
      kind: "AUSGABE",
      costType: { constructionWork: true },
      bookingDate: { gte: von, lt: bis },
      ...NOT_REVERSED,
    },
  });
  if (summen.length === 0) return [];

  const handwerker = await db.craftsman.findMany({
    where: { id: { in: summen.map((s) => s.craftsmanId!) } },
    select: {
      id: true,
      name: true,
      company: true,
      exemptionNumber: true,
      exemptionValidUntil: true,
    },
  });
  const nachId = new Map(handwerker.map((h) => [h.id, h]));

  return summen
    .map((s) => {
      const h = nachId.get(s.craftsmanId!);
      const bisherCents = s._sum.amountCents ?? 0;
      return {
        craftsmanId: s.craftsmanId!,
        name: h?.company || h?.name || "Unbekannt",
        bisherCents,
        naehe: naeheZurGrenze(bisherCents),
        freistellung: { nummer: h?.exemptionNumber ?? null, gueltigBis: h?.exemptionValidUntil ?? null },
      };
    })
    .sort((a, b) => b.bisherCents - a.bisherCents);
}
