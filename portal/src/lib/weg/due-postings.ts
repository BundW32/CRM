// Sollstellungen aus dem Wirtschaftsplan erzeugen und fortschreiben.
//
// Der alte Weg war `deleteMany` + `createMany`: Beim Beschluss flogen alle
// Sollstellungen des Plans weg und entstanden neu. Das ist mit Zahlungen im
// Bestand nicht tragbar — jede Zuordnung einer Zahlung zu einer Forderung
// hinge danach in der Luft, und die Historie einer Mahnung wäre gelöscht.
//
// Stattdessen wird **abgeglichen**: fehlende Sollstellungen anlegen, geänderte
// Beträge anpassen, nicht mehr getragene entfernen. Und zwar nur in der
// Zukunft — siehe `synchronisiereSollstellungen`.
import type { DueDayRule } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { computeUnitAdvances, monthlyInstallments, type PlanItemInput } from "./economic-plan";
import type { UnitForDistribution } from "./distribution";
import { faelligkeitFuer, sollHorizont, sollMonate, type PlanGeltung } from "./plan-validity";

export type AbgleichErgebnis = {
  angelegt: number;
  geaendert: number;
  entfernt: number;
  /** Letzter Monat, für den Sollstellungen bestehen — für die Rückmeldung. */
  bisMonat: { year: number; month: number } | null;
};

/**
 * Gleicht die Sollstellungen eines beschlossenen Plans mit seinem
 * Geltungszeitraum ab.
 *
 * **Vergangenes bleibt unangetastet.** Geändert und entfernt wird nur, was noch
 * nicht fällig war. Zwei Gründe: Eine bereits fällige Forderung kann bezahlt,
 * gemahnt oder eingeklagt sein — sie nachträglich zu verändern, verfälschte die
 * Historie. Und rechtlich wirkt ein Beschluss nach vorn: Er kann nicht
 * rückwirkend ändern, was ein Eigentümer im März schuldete.
 *
 * Angelegt wird dagegen auch rückwirkend — genau darum geht es bei der
 * Fortgeltung: Tagt die Versammlung im April, entstehen die Forderungen für
 * Januar bis März nachträglich, weil sie nach § 28 Abs. 1 Satz 2 WEG die ganze
 * Zeit bestanden.
 */
export async function synchronisiereSollstellungen(args: {
  organizationId: string;
  property: {
    id: string;
    fiscalYearStartMonth: number;
    dueDayRule: DueDayRule;
    dueDayOfMonth: number | null;
  };
  planId: string;
  geltung: PlanGeltung;
  items: PlanItemInput[];
  units: UnitForDistribution[];
  now?: Date;
}): Promise<AbgleichErgebnis> {
  const { organizationId, property, planId, geltung, items, units } = args;
  const now = args.now ?? new Date();

  const advances = computeUnitAdvances(items, units);
  const ratenJeEinheit = new Map(
    units.map((u) => [u.id, monthlyInstallments(advances.perUnit.get(u.id) ?? 0)]),
  );

  const monate = sollMonate(geltung, property.fiscalYearStartMonth, sollHorizont(now));

  // Soll-Zustand: je Einheit und Monat ein Betrag.
  const soll = new Map<string, { unitId: string; m: (typeof monate)[number]; cents: number }>();
  for (const u of units) {
    const raten = ratenJeEinheit.get(u.id) ?? [];
    for (const m of monate) {
      soll.set(`${u.id}|${m.year}|${m.month}`, { unitId: u.id, m, cents: raten[m.rateIndex] ?? 0 });
    }
  }

  const vorhanden = await db.duePosting.findMany({
    where: { planId },
    select: { id: true, unitId: true, periodYear: true, periodMonth: true, amountCents: true, dueDate: true },
  });

  const anlegen: {
    organizationId: string;
    propertyId: string;
    unitId: string;
    planId: string;
    dueDate: Date;
    periodYear: number;
    periodMonth: number;
    amountCents: number;
    source: string;
  }[] = [];
  const aendern: { id: string; amountCents: number; dueDate: Date }[] = [];
  const entfernen: string[] = [];

  const gesehen = new Set<string>();
  for (const p of vorhanden) {
    const key = `${p.unitId}|${p.periodYear}|${p.periodMonth}`;
    gesehen.add(key);
    const ziel = soll.get(key);
    const bereitsFaellig = p.dueDate <= now;
    if (!ziel) {
      // Diesen Monat trägt der Plan nicht mehr — der Nachfolger tut es. Hier
      // wird auch Fälliges entfernt, und zwar bewusst: Sonst stünden für
      // denselben Monat zwei Forderungen nebeneinander und der Eigentümer
      // schuldete sein Hausgeld doppelt. Gefahrlos ist das, weil der Beginn
      // eines Nachfolgeplans nicht in einen Monat fallen darf, der bereits
      // abgeschlossen ist (siehe `resolvePlan`) — es wird also nichts
      // gelöscht, was der Nachfolger nicht im selben Zug neu anlegt.
      entfernen.push(p.id);
      continue;
    }
    if (bereitsFaellig) continue; // Vergangenes bleibt, wie es war.
    if (ziel.cents === 0) {
      // Eine künftige Forderung über 0 € ist keine Forderung — weg damit
      // (z. B. Stellplatz, der bei jedem Schlüssel des Plans 0 trägt).
      // Dieselbe Regel wie bei der Sonderumlage; Fälliges bleibt unberührt.
      entfernen.push(p.id);
      continue;
    }
    const faellig = faelligkeitFuer(ziel.m, property.dueDayRule, property.dueDayOfMonth);
    if (p.amountCents !== ziel.cents || p.dueDate.getTime() !== faellig.getTime()) {
      aendern.push({ id: p.id, amountCents: ziel.cents, dueDate: faellig });
    }
  }
  for (const [key, ziel] of soll) {
    if (gesehen.has(key)) continue;
    // Keine 0-€-Sollstellungen anlegen: Sie stünden nur als Lärm in
    // Hausgeld-Liste, offenen Posten und Historie (SEPA und Mahnwesen
    // überspringen sie ohnehin).
    if (ziel.cents === 0) continue;
    anlegen.push({
      organizationId,
      propertyId: property.id,
      unitId: ziel.unitId,
      planId,
      dueDate: faelligkeitFuer(ziel.m, property.dueDayRule, property.dueDayOfMonth),
      periodYear: ziel.m.year,
      periodMonth: ziel.m.month,
      amountCents: ziel.cents,
      source: "WIRTSCHAFTSPLAN",
    });
  }

  await db.$transaction([
    ...(entfernen.length > 0 ? [db.duePosting.deleteMany({ where: { id: { in: entfernen } } })] : []),
    ...aendern.map((a) =>
      db.duePosting.update({ where: { id: a.id }, data: { amountCents: a.amountCents, dueDate: a.dueDate } }),
    ),
    ...(anlegen.length > 0 ? [db.duePosting.createMany({ data: anlegen, skipDuplicates: true })] : []),
  ]);

  const letzter = monate.at(-1);
  return {
    angelegt: anlegen.length,
    geaendert: aendern.length,
    entfernt: entfernen.length,
    bisMonat: letzter ? { year: letzter.year, month: letzter.month } : null,
  };
}

/**
 * Lädt den fortgeltenden Plan eines Objekts: den zuletzt beschlossenen, für den
 * kein Nachfolger die Geltung beendet hat.
 */
export async function fortgeltenderPlan(propertyId: string) {
  return db.economicPlan.findFirst({
    where: { propertyId, status: "BESCHLOSSEN", validUntil: null, validFrom: { not: null } },
    orderBy: { validFrom: "desc" },
    include: { items: { include: { costType: true } } },
  });
}

/**
 * Fehlt für den fortgeltenden Plan ein Monat, für den bereits Sollstellungen
 * bestehen müssten?
 *
 * Liefert den ersten fehlenden Monat oder null. Grundlage für den Hinweis im
 * Fahrplan: Ohne ihn merkt niemand, dass ab Januar keine Forderungen mehr
 * entstehen — es fehlt ja nichts Sichtbares, es passiert nur nichts mehr.
 */
export async function ersterFehlenderSollmonat(
  propertyId: string,
  now: Date = new Date(),
): Promise<{ year: number; month: number } | null> {
  const plan = await fortgeltenderPlan(propertyId);
  if (!plan?.validFrom) return null;
  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: { fiscalYearStartMonth: true },
  });
  if (!property) return null;

  // Nur bis zum laufenden Monat prüfen: Der Vorlauf des Horizonts ist Komfort,
  // sein Fehlen kein Missstand.
  const bis = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const monate = sollMonate(
    { validFrom: plan.validFrom, validUntil: plan.validUntil, year: plan.year },
    property.fiscalYearStartMonth,
    bis,
  );
  if (monate.length === 0) return null;

  const vorhanden = await db.duePosting.groupBy({
    by: ["periodYear", "periodMonth"],
    where: { planId: plan.id },
  });
  const bekannt = new Set(vorhanden.map((v) => `${v.periodYear}|${v.periodMonth}`));
  for (const m of monate) {
    if (!bekannt.has(`${m.year}|${m.month}`)) return { year: m.year, month: m.month };
  }
  return null;
}
