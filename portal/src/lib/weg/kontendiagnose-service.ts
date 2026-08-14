// Die Abfragen zur Kontendiagnose (`kontenabstimmung.ts`).
//
// Bewusst NICHT in `computeStatementView`: Der dortige View wird beim
// Fertigstellen als Snapshot eingefroren. Eine Diagnose gehört nicht hinein —
// sie beschreibt einen Zustand während der Bearbeitung, nicht das Ergebnis, und
// sie würde den Snapshot um Daten aufblähen, die niemand mehr braucht, sobald
// die Abrechnung steht. Deshalb ein eigener Aufruf, nur für Entwürfe.
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { NOT_REVERSED } from "./booking-scope";
import { fiscalYearRange } from "./economic-plan";
import {
  RANDTAGE,
  stimmeKontenAb,
  type DiagnoseBuchung,
  type KontoAbstimmung,
  type KontoEingabe,
} from "./kontenabstimmung";
import type { StatementView } from "./statement-service";

const TAG_MS = 86_400_000;

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Auswahl, die genau `DiagnoseBuchung` füllt — an einer Stelle, nicht dreimal. */
const BUCHUNG_SELECT = {
  id: true,
  accountId: true,
  bookingDate: true,
  kind: true,
  transferOut: true,
  amountCents: true,
  text: true,
  costType: { select: { name: true, category: true } },
} satisfies Prisma.BookingSelect;

type BuchungZeile = Prisma.BookingGetPayload<{ select: typeof BUCHUNG_SELECT }>;

function zuDiagnose(b: BuchungZeile): DiagnoseBuchung {
  return {
    id: b.id,
    accountId: b.accountId,
    datum: iso(b.bookingDate),
    kind: b.kind,
    transferOut: b.transferOut,
    amountCents: b.amountCents,
    text: b.text,
    costTypeName: b.costType?.name ?? null,
    costTypeCategory: b.costType?.category ?? null,
  };
}

/**
 * Stimmt die Konten der Abrechnung gegen die eingetragenen Kontoauszugs-Stände
 * ab und sucht nach Erklärungen für jede Abweichung.
 *
 * Ausgangspunkt ist immer das übergebene Objekt: Jede Abfrage trägt
 * `propertyId` — der Aufrufer hat es über `requireWegProperty` bekommen. Die
 * Diagnose darf nicht weiter reichen als die Abrechnung, die sie erklärt.
 */
export async function stimmeKontenDerAbrechnungAb(
  property: { id: string; fiscalYearStartMonth: number },
  statement: { id: string; year: number },
  view: StatementView,
): Promise<KontoAbstimmung[]> {
  if (view.accounts.length === 0) return [];
  const jahr = fiscalYearRange(statement.year, property.fiscalYearStartMonth);
  const fensterVon = new Date(jahr.end.getTime() - RANDTAGE * TAG_MS);
  // `lt`, deshalb ein Tag mehr: sonst fiele der zehnte Tag nach Jahresende raus.
  const fensterBis = new Date(jahr.end.getTime() + (RANDTAGE + 1) * TAG_MS);

  const [checks, konten, randBuchungen, ruecklagenBuchungen, vorjahr] = await Promise.all([
    db.statementAccountCheck.findMany({ where: { statementId: statement.id } }),
    db.ledgerAccount.findMany({
      where: { propertyId: property.id, active: true },
      select: { id: true, openingBalanceCents: true },
    }),
    // Buchungen um die Jahresgrenze. Stornopaare bleiben draußen: Sie heben
    // sich im Saldo auf und können deshalb keine Abweichung erklären.
    db.booking.findMany({
      where: {
        propertyId: property.id,
        bookingDate: { gte: fensterVon, lt: fensterBis },
        ...NOT_REVERSED,
      },
      select: BUCHUNG_SELECT,
      orderBy: { bookingDate: "asc" },
    }),
    // Alles, was für die Rücklage erheblich ist: Buchungen auf Rücklagenkonten
    // (dort steckt die falsch gebuchte Zuführung und die fehlende Zinsgutschrift)
    // sowie Zuführungs- und Erhaltungsposten auf allen Konten.
    db.booking.findMany({
      where: {
        propertyId: property.id,
        bookingDate: { gte: jahr.start, lt: jahr.end },
        ...NOT_REVERSED,
        OR: [
          { account: { kind: "RUECKLAGE" } },
          { costType: { category: { in: ["RUECKLAGENZUFUEHRUNG", "INSTANDHALTUNG"] } } },
        ],
      },
      select: BUCHUNG_SELECT,
      orderBy: { bookingDate: "asc" },
    }),
    // Die Abrechnung des Vorjahres — sie trennt den fehlenden Anfangsbestand
    // (Abweichung Jahr für Jahr gleich) von der vergessenen Buchung dieses
    // Jahres. Nur fertige Abrechnungen: Ein Entwurf sagt nichts.
    db.annualStatement.findFirst({
      where: { propertyId: property.id, year: statement.year - 1, status: "FERTIG" },
      select: { id: true, snapshot: true },
    }),
  ]);

  const reported = new Map(checks.map((c) => [c.accountId, c.reportedEndCents]));
  const opening = new Map(konten.map((k) => [k.id, k.openingBalanceCents]));
  const vorjahrDiff = await ladeVorjahrAbweichungen(vorjahr);

  const eingaben: KontoEingabe[] = view.accounts.map((a) => ({
    id: a.id,
    name: a.name,
    kind: a.kind,
    openingBalanceCents: opening.get(a.id) ?? 0,
    endCents: a.endCents,
    reportedEndCents: reported.get(a.id) ?? null,
    vorjahrDiffCents: vorjahrDiff.get(a.id) ?? null,
  }));

  return stimmeKontenAb({
    fyEnd: iso(jahr.end),
    konten: eingaben,
    randBuchungen: randBuchungen.map(zuDiagnose),
    ruecklagenBuchungen: ruecklagenBuchungen.map(zuDiagnose),
  });
}

/**
 * Abweichung je Konto aus der Vorjahresabrechnung.
 *
 * Gerechnet wird gegen den **Snapshot** — der eingefrorene Endbestand von
 * damals. Neu zu rechnen wäre falsch: Was seither nachgebucht wurde, gehört
 * nicht in die Frage, ob die Abweichung schon damals bestand.
 */
async function ladeVorjahrAbweichungen(
  vorjahr: { id: string; snapshot: unknown } | null,
): Promise<Map<string, number>> {
  const ergebnis = new Map<string, number>();
  const konten = (vorjahr?.snapshot as StatementView | null)?.accounts;
  if (!vorjahr || !konten) return ergebnis;

  const checks = await db.statementAccountCheck.findMany({
    where: { statementId: vorjahr.id },
  });
  const reported = new Map(checks.map((c) => [c.accountId, c.reportedEndCents]));
  for (const a of konten) {
    const wert = reported.get(a.id);
    if (wert !== undefined) ergebnis.set(a.id, wert - a.endCents);
  }
  return ergebnis;
}
