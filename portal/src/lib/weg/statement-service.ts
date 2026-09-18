// Server-Service der Jahresabrechnung: lädt Buchhaltung/Sollstellungen/
// Eigentümerschaften aus der DB und rechnet sie über die pure Logik
// (annual-statement.ts) in ein JSON-fähiges View-Model. Dasselbe Model wird
// live gerendert (ENTWURF) und bei FERTIG als Snapshot eingefroren.
import type { LaborShareType, LedgerAccountKind } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { NOT_REVERSED } from "@/lib/weg/booking-scope";
import {
  baueRuecklagenEntwicklung,
  computeLaborDetail,
  computeLaborShares,
  computePeakAmounts,
  computeStatement,
  splitByOwnership,
  type LaborDetailRow,
  type RuecklagenEntwicklung,
  type StatementBefund,
} from "./annual-statement";
import type { StatementKey } from "./distribution";
import { fiscalYearRange } from "./economic-plan";
import { vorzeichenBetrag } from "./journal";
import { baueUmlagebasis, type Umlagebasis } from "./umlagebasis";
import { baueVermoegensbericht, type Vermoegensbericht } from "./vermoegensbericht";

export type StatementView = {
  year: number;
  fyStart: string; // ISO-Datum (inklusive)
  fyEnd: string; // ISO-Datum (exklusiv)
  rows: {
    costTypeId: string;
    /** Nur bei Schlüssel DIREKT: die Einheit, die diese Kosten allein trägt. */
    directUnitId?: string;
    /**
     * Umlagefähig nach BetrKV (Mieter) — Kennzeichen der Kostenart. Seit
     * 18.09.2026 im Snapshot; ältere Snapshots tragen es nicht, dann zeigt die
     * Einzelabrechnung einen Block statt zwei.
     */
    recoverableBetrKV?: boolean;
    name: string;
    distributionKey: StatementKey;
    laborShareType: LaborShareType;
    totalCents: number;
    reserveFundedCents?: number;
    laborBaseCents?: number;
    laborUnerfasstCents?: number;
    /** HeizkostenV-Kostenart — die Verteilung braucht einen Grundkostenanteil. */
    heatingCost?: boolean;
    /** Angewandter Verbrauchsanteil in Prozent (§§ 7, 8 HeizkostenV). */
    heatingConsumptionPercent?: number | null;
    perUnit: Record<string, number> | null;
    error?: string;
  }[];
  errors: string[];
  warnings: string[];
  /**
   * Dieselben Feststellungen wie `errors`/`warnings`, zerlegt und mit dem Weg
   * zur betroffenen Buchung. Grundlage der Prüfliste (`pruefliste.ts`).
   *
   * Optional, weil Snapshots aus der Zeit davor sie nicht tragen — dort
   * bleiben `errors`/`warnings` die einzige Quelle. Neu gerechnete Views
   * setzen das Feld immer.
   */
  befunde?: StatementBefund[];
  /** Gab es im Wirtschaftsjahr überhaupt etwas zu verteilen? */
  hatPositionen: boolean;
  perUnitTotal: Record<string, number>;
  duePerUnit: Record<string, number>;
  peak: Record<string, number>; // Abrechnungsspitze: + Nachschuss / − Guthaben
  labor: Record<string, { haushaltsnah: number; handwerker: number; unerfasst: number }>;
  /**
   * § 35a je Kostenart und Einheit (seit 18.09.2026). Ältere Snapshots tragen
   * das Feld nicht; die PDF-Bauer rechnen es dann aus den Zeilen nach.
   */
  laborDetail?: Record<string, LaborDetailRow[]>;
  ownerSplit: Record<
    string,
    { shares: { userName: string; days: number; cents: number }[]; uncoveredCents: number }
  >;
  accounts: {
    id: string;
    name: string;
    kind: LedgerAccountKind;
    startCents: number;
    inCents: number;
    outCents: number;
    transferNetCents: number;
    /**
     * Umbuchungen **auf** dieses Konto — auf einem Rücklagenkonto: die
     * Zuführung. Optional aus demselben Grund wie `ruecklagenEntwicklung`:
     * ältere Snapshots führen nur den Nettowert.
     */
    transferInCents?: number;
    /** Umbuchungen **von** diesem Konto weg. */
    transferOutCents?: number;
    endCents: number;
  }[];
  incomeCents: number;
  totalExpenseCents: number;
  reserveTransferCents: number;
  reserveWithdrawalCents: number; // aus der Rücklage bezahlt, nicht umgelegt
  receivablesCents: number; // Forderungen (Hausgeldrückstände) zum Stichtag
  /**
   * Vermögensbericht nach § 28 Abs. 4 WEG — **fertig gerechnet**, nicht als
   * Rohdaten.
   *
   * Absichtlich hier und nicht erst in der Seite: Bei FERTIG wird diese View
   * als Snapshot eingefroren. Lüde die Seite die Verbindlichkeiten stattdessen
   * live aus der Datenbank, änderte sich ein bereits **beschlossener** Bericht,
   * sobald jemand später eine Rechnung nachträgt oder als beglichen markiert.
   * Nur Zahlen und Zeichenketten, damit der Snapshot JSON-fähig bleibt.
   */
  vermoegensbericht: Vermoegensbericht;
  /**
   * Entwicklung der Erhaltungsrücklage: Anfangsbestand + Zuführung + Zinsen −
   * Entnahmen = Endbestand.
   *
   * `null`, wenn kein Rücklagenkonto geführt wird; `undefined` in Snapshots aus
   * der Zeit vor dieser Erweiterung. Aus demselben Grund hier und nicht erst in
   * der Seite wie `vermoegensbericht`: Die Kette gehört zu dem, was beschlossen
   * wurde, und darf sich nach dem Einfrieren nicht mehr ändern.
   */
  ruecklagenEntwicklung?: RuecklagenEntwicklung | null;
  /**
   * Bezugsgrößen der Verteilung (MEA, Fläche, Einheiten, Personen je Einheit
   * und in Summe), wie sie beim Rechnen galten. Eingefroren im Snapshot,
   * damit die Einzelabrechnung auch dann die richtigen Nenner nennt, wenn
   * die Stammdaten später geändert wurden. Optional, weil ältere Snapshots
   * sie nicht tragen — dort fällt der Aufrufer auf die Stammdaten von heute
   * zurück.
   */
  umlagebasis?: Umlagebasis;
};

type BookingGroup = {
  accountId: string;
  kind: string;
  transferOut: boolean | null;
  _sum: { amountCents: number | null };
};

// Vorzeichenrichtige Summe der Buchungsgruppen eines Kontos.
//
// Die Vorzeichenregel selbst steht in `journal.ts` und nur dort: Sie stand
// vorher hier und im Kontoblatt gleichlautend, und zwei Kopien derselben Regel
// laufen auseinander, sobald eine vierte Buchungsart dazukommt. Dass Kontoblatt
// und Jahresabrechnung denselben Endbestand nennen, hängt genau daran.
function signedSum(groups: BookingGroup[], accountId: string): number {
  let sum = 0;
  for (const g of groups) {
    if (g.accountId !== accountId) continue;
    sum += vorzeichenBetrag({
      kind: g.kind,
      transferOut: g.transferOut,
      amountCents: g._sum.amountCents ?? 0,
    });
  }
  return sum;
}

export async function computeStatementView(
  property: { id: string; fiscalYearStartMonth: number },
  year: number,
  statementId: string,
): Promise<StatementView> {
  const { start, end } = fiscalYearRange(year, property.fiscalYearStartMonth);
  const inYear = { gte: start, lt: end };

  const [costTypes, units, expenseGroups, otherAgg, incomeAgg, ertragGroups, accounts, beforeGroups, yearGroups, manualRows, dueGroups, ownerships, paidGroups, laborBookings, plan] =
    await Promise.all([
      db.costType.findMany({
        where: { propertyId: property.id },
        orderBy: [{ orderIndex: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          category: true,
          distributionKey: true,
          laborShareType: true,
          heatingCost: true,
          heatingConsumptionPercent: true,
          recoverableBetrKV: true,
        },
      }),
      db.unit.findMany({
        where: { propertyId: property.id },
        orderBy: [{ orderIndex: "asc" }, { label: "asc" }],
        select: { id: true, label: true, mea: true, livingArea: true, personCount: true, unitType: true },
      }),
      db.booking.groupBy({
        by: ["costTypeId", "accountId", "directUnitId"],
        where: {
          propertyId: property.id,
          kind: "AUSGABE",
          costTypeId: { not: null },
          bookingDate: inYear,
          ...NOT_REVERSED,
        },
        _sum: { amountCents: true },
      }),
      db.booking.aggregate({
        where: {
          propertyId: property.id,
          kind: "AUSGABE",
          costTypeId: null,
          bookingDate: inYear,
          ...NOT_REVERSED,
        },
        // Anzahl mit: „1.240,00 € ohne Kostenart" lässt offen, ob eine Buchung
        // oder dreißig zu bearbeiten sind — und damit, wie lang der Weg ist.
        _sum: { amountCents: true },
        _count: true,
      }),
      db.booking.aggregate({
        where: { propertyId: property.id, kind: "EINNAHME", bookingDate: inYear, ...NOT_REVERSED },
        _sum: { amountCents: true },
      }),
      // Einnahmen, die einer Ertrags-Kostenart zugeordnet sind (Zinsen, Miete
      // aus Gemeinschaftseigentum, PV). Hausgeld-Eingänge tragen keine
      // Kostenart und bleiben deshalb außen vor.
      db.booking.groupBy({
        by: ["costTypeId"],
        where: {
          propertyId: property.id,
          kind: "EINNAHME",
          costType: { category: "ERTRAG" },
          bookingDate: inYear,
          ...NOT_REVERSED,
        },
        _sum: { amountCents: true },
      }),
      db.ledgerAccount.findMany({
        where: { propertyId: property.id, active: true },
        orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
      }),
      db.booking.groupBy({
        by: ["accountId", "kind", "transferOut"],
        where: { propertyId: property.id, bookingDate: { lt: start } },
        _sum: { amountCents: true },
      }),
      db.booking.groupBy({
        by: ["accountId", "kind", "transferOut"],
        where: { propertyId: property.id, bookingDate: inYear },
        _sum: { amountCents: true },
      }),
      db.statementUnitAmount.findMany({ where: { statementId } }),
      db.duePosting.groupBy({
        by: ["unitId"],
        where: { propertyId: property.id, dueDate: inYear },
        _sum: { amountCents: true },
      }),
      db.unitOwnership.findMany({
        where: { unit: { propertyId: property.id } },
        include: { user: { select: { name: true } } },
      }),
      db.booking.groupBy({
        by: ["unitId"],
        where: {
          propertyId: property.id,
          kind: "EINNAHME",
          unitId: { not: null },
          bookingDate: { lt: end },
          ...NOT_REVERSED,
        },
        _sum: { amountCents: true },
      }),
      // §35a: die einzelnen Ausgabebuchungen der begünstigten Kostenarten.
      // Gruppieren geht hier nicht — der Lohnanteil steht an der Buchung, und
      // wo er fehlt, greift der Erfahrungswert der Kostenart auf *diesen* Betrag.
      db.booking.findMany({
        where: {
          propertyId: property.id,
          kind: "AUSGABE",
          bookingDate: inYear,
          // Kostenarten mit § 35a-Kennzeichen vollständig (dort zählt auch
          // die Lücke) — und dazu jede Buchung, an der ein Lohnanteil steht,
          // obwohl ihre Kostenart auf „kein § 35a" steht: Die erzeugt den
          // Befund „Kennzeichen fehlt" (annual-statement.ts).
          OR: [{ costType: { laborShareType: { not: "KEINE" } } }, { laborShareCents: { not: null } }],
          ...NOT_REVERSED,
        },
        select: {
          costTypeId: true,
          accountId: true,
          directUnitId: true,
          amountCents: true,
          laborShareCents: true,
          costType: { select: { laborSharePercent: true } },
        },
      }),
      // Beschlossener Wirtschaftsplan des Jahres: liefert Schlüssel und Sollwert
      // der Rücklagenzuführung. Ohne Plan bleibt es beim Rückfall auf MEA.
      db.economicPlan.findFirst({
        where: { propertyId: property.id, year, status: "BESCHLOSSEN" },
        select: {
          items: {
            where: { costType: { category: "RUECKLAGENZUFUEHRUNG" } },
            select: { amountCents: true, costType: { select: { distributionKey: true } } },
          },
        },
      }),
    ]);

  // Rücklagenzuführung (Ist): Umbuchungen, die auf Rücklagenkonten eingehen
  const reserveIds = new Set(accounts.filter((a) => a.kind === "RUECKLAGE").map((a) => a.id));
  let reserveTransferCents = 0;
  for (const g of yearGroups) {
    if (g.kind === "UMBUCHUNG" && g.transferOut === false && reserveIds.has(g.accountId)) {
      reserveTransferCents += g._sum.amountCents ?? 0;
    }
  }

  // Ausgaben trennen: aus dem laufenden Konto (umlagefähig) und aus der
  // Erhaltungsrücklage (bereits über frühere Zuführungen bezahlt).
  const expenseByCostType = new Map<string, number>();
  const reserveSpendByCostType = new Map<string, number>();
  // Direkt zugeordnete Ausgaben vom laufenden Konto laufen getrennt: Sie
  // werden nicht verteilt, sondern der Einheit zugerechnet. Aus der Rücklage
  // bezahlt zählen sie wie jede Rücklagenausgabe — nicht umgelegt.
  const directByCostType = new Map<string, Map<string, { cents: number; laborBaseCents: number; laborUnerfasstCents: number }>>();
  const direktEintrag = (costTypeId: string, unitId: string) => {
    const inner = directByCostType.get(costTypeId) ?? new Map();
    const e = inner.get(unitId) ?? { cents: 0, laborBaseCents: 0, laborUnerfasstCents: 0 };
    inner.set(unitId, e);
    directByCostType.set(costTypeId, inner);
    return e;
  };
  for (const g of expenseGroups) {
    const id = g.costTypeId as string;
    const cents = g._sum.amountCents ?? 0;
    if (reserveIds.has(g.accountId)) {
      reserveSpendByCostType.set(id, (reserveSpendByCostType.get(id) ?? 0) + cents);
    } else if (g.directUnitId) {
      direktEintrag(id, g.directUnitId).cents += cents;
    } else {
      expenseByCostType.set(id, (expenseByCostType.get(id) ?? 0) + cents);
    }
  }

  // §35a je Kostenart: erfasster Lohnanteil und die Lücke. Aus der Rücklage
  // bezahlte Ausgaben bleiben außen vor — sie werden im Jahr nicht umgelegt,
  // also trägt sie kein Eigentümer und niemand kann sie absetzen.
  const laborByCostType = new Map<string, { baseCents: number; unerfasstCents: number }>();
  for (const b of laborBookings) {
    if (reserveIds.has(b.accountId)) continue;
    const id = b.costTypeId as string;
    // Direktbuchungen tragen ihren Lohnanteil selbst — er gehört ganz der
    // einen Einheit und darf nicht mit dem verteilten Anteil vermischt werden.
    const direkt = b.directUnitId ? direktEintrag(id, b.directUnitId) : null;
    const eintrag = laborByCostType.get(id) ?? { baseCents: 0, unerfasstCents: 0 };
    const prozent = b.costType?.laborSharePercent;
    let base = 0;
    let unerfasst = 0;
    if (b.laborShareCents != null) {
      // Die Rechnung geht vor. Mehr als der Rechnungsbetrag kann nicht
      // Lohnanteil sein — ein Tippfehler soll nicht zu einem Ausweis führen,
      // der über der Ausgabe liegt.
      base = Math.min(b.laborShareCents, b.amountCents);
    } else if (prozent != null) {
      base = Math.round((b.amountCents * prozent) / 100);
    } else {
      unerfasst = b.amountCents;
    }
    if (direkt) {
      direkt.laborBaseCents += base;
      direkt.laborUnerfasstCents += unerfasst;
      continue;
    }
    eintrag.baseCents += base;
    eintrag.unerfasstCents += unerfasst;
    laborByCostType.set(id, eintrag);
  }

  // Schlüssel und Sollwert der Zuführung aus dem beschlossenen Plan.
  const reserveItem = plan?.items[0];
  const reserveTransferKey = reserveItem?.costType.distributionKey;
  const plannedReserveCents = reserveItem?.amountCents;

  const manualAmounts = new Map<string, Map<string, number>>();
  for (const row of manualRows) {
    const inner = manualAmounts.get(row.costTypeId) ?? new Map<string, number>();
    inner.set(row.unitId, row.amountCents);
    manualAmounts.set(row.costTypeId, inner);
  }

  const result = computeStatement({
    costTypes,
    units,
    expenseByCostType,
    incomeByCostType: new Map(
      ertragGroups.map((g) => [g.costTypeId as string, g._sum.amountCents ?? 0]),
    ),
    reserveSpendByCostType,
    otherExpenseCents: otherAgg._sum.amountCents ?? 0,
    otherExpenseCount: otherAgg._count,
    // `end` ist der erste Tag NACH dem Wirtschaftsjahr (exklusiv). Liegt er in
    // der Zukunft, läuft das Jahr noch — dann sagt die Prüfliste das, statt
    // eine Zwischensumme wie eine Jahresforderung aussehen zu lassen.
    // Ausgewiesen wird der letzte Tag des Jahres, nicht der erste danach.
    jahrLaeuftBis: end > new Date() ? new Date(end.getTime() - 86_400_000) : null,
    manualAmounts,
    reserveTransferCents,
    reserveTransferKey,
    plannedReserveCents,
    laborByCostType,
    directByCostType,
  });

  // Das gestellte Soll, nicht der geplante Jahresvorschuss: `dueGroups`
  // summiert die DuePosting-Zeilen des Wirtschaftsjahres. Bei aufgerundeter
  // Monatsrate liegt es über dem Planwert — und genau diese Überdeckung soll
  // als Guthaben in die Abrechnungsspitze laufen (§ 28 Abs. 2 WEG).
  const duePerUnit = new Map(dueGroups.map((g) => [g.unitId, g._sum.amountCents ?? 0]));
  const peak = computePeakAmounts(result.perUnitTotal, duePerUnit);
  const labor = computeLaborShares(result.rows);

  // Tagesgenaue Eigentümer-Aufteilung des Kostenanteils je Einheit
  const ownershipsByUnit = new Map<string, typeof ownerships>();
  for (const o of ownerships) {
    const list = ownershipsByUnit.get(o.unitId) ?? [];
    list.push(o);
    ownershipsByUnit.set(o.unitId, list);
  }
  const ownerSplit: StatementView["ownerSplit"] = {};
  for (const [unitId, cents] of result.perUnitTotal) {
    const periods = (ownershipsByUnit.get(unitId) ?? []).map((o) => ({
      userId: o.userId,
      userName: o.user.name,
      validFrom: o.validFrom,
      validTo: o.validTo,
      sharePercent: o.sharePercent,
    }));
    const split = splitByOwnership(cents, periods, start, end);
    ownerSplit[unitId] = {
      shares: split.shares.map((s) => ({ userName: s.userName, days: s.days, cents: s.cents })),
      uncoveredCents: split.uncoveredCents,
    };
  }

  // Kontenblock der Gesamtabrechnung
  const accountViews = accounts.map((a) => {
    const startCents = a.openingBalanceCents + signedSum(beforeGroups, a.id);
    let inCents = 0;
    let outCents = 0;
    // Zu- und Abgang getrennt: Der Nettowert allein genügt der Kontentabelle,
    // aber nicht der Entwicklungsrechnung der Rücklage. Dort müssen Zuführung
    // und Rückbuchung einzeln stehen — sonst zeigt eine Zeile „Zuführung"
    // bereits die Differenz aus beidem und erklärt nichts mehr.
    let transferInCents = 0;
    let transferOutCents = 0;
    for (const g of yearGroups) {
      if (g.accountId !== a.id) continue;
      const amount = g._sum.amountCents ?? 0;
      if (g.kind === "EINNAHME") inCents += amount;
      else if (g.kind === "AUSGABE") outCents += amount;
      else if (g.transferOut) transferOutCents += amount;
      else transferInCents += amount;
    }
    const transferNetCents = transferInCents - transferOutCents;
    return {
      id: a.id,
      name: a.name,
      kind: a.kind,
      startCents,
      inCents,
      outCents,
      transferNetCents,
      transferInCents,
      transferOutCents,
      endCents: startCents + inCents - outCents + transferNetCents,
    };
  });

  // Forderungen zum Stichtag: Σ fällige Sollstellungen (< Ende) − zugeordnete
  // Zahlungen je Einheit, nur positive Salden (Rückstände)
  const dueAllGroups = await db.duePosting.groupBy({
    by: ["unitId"],
    where: { propertyId: property.id, dueDate: { lt: end } },
    _sum: { amountCents: true },
  });
  const paidByUnit = new Map(paidGroups.map((g) => [g.unitId as string, g._sum.amountCents ?? 0]));
  let receivablesCents = 0;
  for (const g of dueAllGroups) {
    const open = (g._sum.amountCents ?? 0) - (paidByUnit.get(g.unitId) ?? 0);
    if (open > 0) receivablesCents += open;
  }

  // Verbindlichkeiten zum Stichtag = letzter Tag des Wirtschaftsjahres.
  // `end` ist exklusiv, der Stichtag also der Tag davor.
  const stichtag = new Date(end.getTime() - 86_400_000);
  const verbindlichkeiten = await db.verbindlichkeit.findMany({
    where: { propertyId: property.id, incurredOn: { lte: stichtag } },
    select: {
      title: true,
      creditor: true,
      kind: true,
      amountCents: true,
      incurredOn: true,
      settledAt: true,
    },
  });
  // Dieselbe Auswahl wie im Vermögensbericht — beide Stellen müssen für die
  // Erhaltungsrücklage dieselbe Zahl nennen.
  const ruecklagenkonten = accountViews.filter((a) => a.kind === "RUECKLAGE");
  const ruecklagenEntwicklung =
    ruecklagenkonten.length === 0
      ? null
      : baueRuecklagenEntwicklung(
          ruecklagenkonten.map((a) => ({
            name: a.name,
            startCents: a.startCents,
            // Einnahmen auf einem Rücklagenkonto sind in aller Regel Zinsen.
            zinsenCents: a.inCents,
            ausgabeCents: a.outCents,
            zufuehrungCents: a.transferInCents,
            rueckbuchungCents: a.transferOutCents,
            endCents: a.endCents,
          })),
        );

  const vermoegensbericht = baueVermoegensbericht({
    ruecklageCents: ruecklagenkonten.reduce((sum, a) => sum + a.endCents, 0),
    girokontenCents: accountViews
      .filter((a) => a.kind === "GIRO")
      .reduce((sum, a) => sum + a.endCents, 0),
    forderungenCents: receivablesCents,
    verbindlichkeiten,
    stichtag,
  });

  return {
    year,
    fyStart: start.toISOString().slice(0, 10),
    fyEnd: end.toISOString().slice(0, 10),
    rows: result.rows.map((r) => ({
      costTypeId: r.costTypeId,
      directUnitId: r.directUnitId,
      recoverableBetrKV: costTypes.find((c) => c.id === r.costTypeId)?.recoverableBetrKV,
      name: r.name,
      distributionKey: r.distributionKey,
      laborShareType: r.laborShareType,
      totalCents: r.totalCents,
      reserveFundedCents: r.reserveFundedCents,
      laborBaseCents: r.laborBaseCents,
      laborUnerfasstCents: r.laborUnerfasstCents,
      heatingCost: costTypes.find((c) => c.id === r.costTypeId)?.heatingCost,
      heatingConsumptionPercent: costTypes.find((c) => c.id === r.costTypeId)?.heatingConsumptionPercent,
      perUnit: r.perUnit ? Object.fromEntries(r.perUnit) : null,
      error: r.error,
    })),
    errors: result.errors,
    warnings: result.warnings,
    befunde: result.befunde,
    hatPositionen: result.hatPositionen,
    perUnitTotal: Object.fromEntries(result.perUnitTotal),
    duePerUnit: Object.fromEntries(duePerUnit),
    peak: Object.fromEntries(peak),
    labor: Object.fromEntries(labor.entries()),
    laborDetail: Object.fromEntries(computeLaborDetail(result.rows)),
    ownerSplit,
    accounts: accountViews,
    incomeCents: incomeAgg._sum.amountCents ?? 0,
    totalExpenseCents: result.totalExpenseCents,
    reserveTransferCents,
    reserveWithdrawalCents: result.reserveWithdrawalCents,
    receivablesCents,
    vermoegensbericht,
    ruecklagenEntwicklung,
    umlagebasis: baueUmlagebasis(units),
  };
}
