// Jahresabrechnungs-Logik (§ 28 Abs. 2 WEG): Verteilung der Ist-Kosten auf die
// Einheiten (strikte Schlüssel; VERBRAUCH/INDIVIDUELL/FESTBETRAG aus manueller
// Erfassung, z. B. Messdienst), Abrechnungsspitze gegen die Soll-Vorschüsse,
// §35a-Ausweis und tagesgenaue Aufteilung bei Eigentümerwechsel.
// Pure Funktionen — DB/UI übernehmen die Server Actions.
import type { CostCategory, DistributionKey, LaborShareType } from "@/generated/prisma/client";
import { formatCents } from "@/lib/money";
import { distributeByWeight, weightsForKey, type UnitForDistribution } from "./distribution";
import { advanceWeightsForKey } from "./economic-plan";

// Schlüssel, die in der Abrechnung eine manuelle Verteilung je Einheit brauchen
export const MANUAL_KEYS: DistributionKey[] = ["VERBRAUCH", "FESTBETRAG", "INDIVIDUELL"];

export type StatementCostTypeInput = {
  id: string;
  name: string;
  category: CostCategory;
  distributionKey: DistributionKey;
  laborShareType: LaborShareType;
};

/**
 * Wohin ein Prüflisten-Punkt führt.
 *
 * Bewusst als Beschreibung des Ziels, nicht als fertige URL: Diese Datei kennt
 * weder `propertyId` noch Routen. Die Seite setzt daraus den Link zusammen —
 * und kann dabei zentral den Zeitraum des Wirtschaftsjahres anhängen, statt ihn
 * an jeder Fundstelle einzeln mitzuschleppen.
 *
 * Der Grund für das Ziel überhaupt: Eine Meldung wie „Ausgaben ohne Kostenart:
 * 1.240,00 €" nennt eine Summe und lässt den Verwalter suchen. Die Buchungen
 * dazu stehen eine Seite weiter, gefiltert erreichbar — nur wusste das bisher
 * niemand außer der Abfrage, die die Summe gebildet hat.
 */
export type Pruefziel =
  /** Buchhaltung, mit gesetzten Filtern (`konto`, `kostenart`, `buchung`, …). */
  | { art: "buchhaltung"; filter: Record<string, string>; label: string }
  /** Ein Abschnitt auf der Abrechnungsseite selbst (Anker ohne `#`). */
  | { art: "abschnitt"; anker: string; label: string }
  /** Stammdaten des Objekts (Anker ohne `#`). */
  | { art: "stammdaten"; anker: string; label: string };

/**
 * Ein Befund der Abrechnungsprüfung — dasselbe, was bisher als Zeichenkette in
 * `errors`/`warnings` stand, nur zerlegt: Titel, Erläuterung und der Weg zur
 * betroffenen Buchung.
 *
 * `errors` und `warnings` bleiben daneben bestehen und werden aus dieser Liste
 * abgeleitet: Sie stecken in den Snapshots fertiger Abrechnungen und werden von
 * `finalizeStatement` gelesen.
 */
export type StatementBefund = {
  art: "verteilung" | "stammdaten" | "ohne-kostenart" | "zufuehrung-plan" | "leer";
  /** true = verhindert das Fertigstellen. */
  blockierend: boolean;
  /** Kurz, für die Prüfliste. */
  titel: string;
  /** Der ausformulierte Satz — identisch mit dem Eintrag in `errors`/`warnings`. */
  text: string;
  ziel?: Pruefziel;
};

export type StatementInput = {
  costTypes: StatementCostTypeInput[];
  units: UnitForDistribution[];
  // Ist-Ausgaben je Kostenart im Wirtschaftsjahr (Cent, positiv)
  expenseByCostType: Map<string, number>;
  // Ausgaben ohne Kostenart (nicht umlegbar → Prüffehler)
  otherExpenseCents: number;
  /**
   * Wie viele Buchungen das sind. Nur für die Meldung: „1.240,00 € ohne
   * Kostenart" lässt offen, ob eine Buchung oder dreißig zu bearbeiten sind.
   */
  otherExpenseCount?: number;
  // manuelle Verteilung je Kostenart → Einheit (für MANUAL_KEYS)
  manualAmounts: Map<string, Map<string, number>>;
  // tatsächliche Umbuchungen Giro → Rücklage im Jahr
  reserveTransferCents: number;
  // Schlüssel der Zuführung laut beschlossenem Wirtschaftsplan (Default MEA).
  // Plan und Abrechnung müssen denselben Schlüssel verwenden, sonst ist die
  // Abrechnungsspitze bei jedem Eigentümer falsch (§ 16 Abs. 2 Satz 2 WEG).
  reserveTransferKey?: DistributionKey;
  // Geplante Zuführung laut Wirtschaftsplan — nur für den Soll-Ist-Hinweis.
  plannedReserveCents?: number;
  // Ist-Einnahmen je Kostenart der Kategorie ERTRAG (Zinsen, Miete aus
  // Gemeinschaftseigentum, PV). Sie mindern die Umlage, statt sie zu erhöhen.
  incomeByCostType?: Map<string, number>;
  // Ist-Ausgaben je Kostenart, die von einem RÜCKLAGEN-Konto bezahlt wurden.
  // Sie erscheinen in der Gesamtabrechnung als Ausgabe, werden aber NICHT
  // umgelegt — dazu siehe die Gegenposition unten.
  reserveSpendByCostType?: Map<string, number>;
  // §35a EStG je Kostenart: der begünstigte Lohn-/Fahrt-/Maschinenkostenanteil
  // (`baseCents`) und der Teil der Ausgaben, für den kein Anteil erfasst ist
  // (`unerfasstCents`). Siehe `computeLaborShares`.
  laborByCostType?: Map<string, { baseCents: number; unerfasstCents: number }>;
};

export type StatementCostRow = {
  costTypeId: string;
  name: string;
  distributionKey: DistributionKey;
  laborShareType: LaborShareType;
  totalCents: number; // Ist-Ausgabe gesamt (Giro + Rücklage)
  /** Davon aus der Erhaltungsrücklage bezahlt — nicht umgelegt. */
  reserveFundedCents?: number;
  perUnit: Map<string, number> | null; // null, wenn Verteilung (noch) nicht möglich
  /** §35a: begünstigter Lohnanteil dieser Position (nicht der Bruttobetrag). */
  laborBaseCents?: number;
  /** §35a: Betrag dieser Position, für den kein Lohnanteil erfasst ist. */
  laborUnerfasstCents?: number;
  error?: string;
};

export type StatementResult = {
  rows: StatementCostRow[];
  perUnitTotal: Map<string, number>; // Kostenanteil je Einheit (inkl. Rücklagen-Ist)
  totalExpenseCents: number; // Σ Ist-Ausgaben des Jahres (Giro + Rücklage)
  reserveTransferCents: number;
  /** Σ Ausgaben, die aus der Rücklage bezahlt und deshalb nicht umgelegt wurden. */
  reserveWithdrawalCents: number;
  errors: string[]; // blockiert das Fertigstellen — leer = verteilungsplausibel
  /** Hinweise, die NICHT blockieren (z. B. Zuführung weicht vom Plan ab). */
  warnings: string[];
  /**
   * Dieselben Feststellungen wie `errors`/`warnings`, nur zerlegt und mit dem
   * Weg zur betroffenen Buchung. Die Prüfliste der Seite baut darauf auf.
   */
  befunde: StatementBefund[];
  /**
   * Gab es überhaupt etwas zu verteilen?
   *
   * Die Prüfung „Summe der Einzelabrechnungen = Gesamtabrechnung" ist bei einer
   * leeren Abrechnung `0 = 0` — trivial erfüllt. Ohne diese Unterscheidung
   * meldete die Seite „Verteilung vollständig und centgenau" für ein
   * Wirtschaftsjahr, in dem keine einzige Buchung erfasst war. Eine Zusicherung
   * ohne Deckung ist schlimmer als keine: Sie beendet die Suche nach dem Fehler,
   * statt sie auszulösen.
   *
   * Bewusst kein `error`: Ein Jahr ohne Kosten ist theoretisch zulässig, und
   * das Fertigstellen zu blockieren hieße, einen fachlich möglichen Fall
   * unmöglich zu machen. Die Seite sagt stattdessen, was Sache ist.
   */
  hatPositionen: boolean;
};

export const RESERVE_ROW_ID = "__ruecklage__";
export const RESERVE_WITHDRAWAL_ROW_ID = "__ruecklagenentnahme__";

/**
 * Verteilt die Ist-Kosten des Jahres auf die Einheiten.
 *
 * Zwei Dinge, die hier bewusst NICHT umgelegt werden:
 *
 * 1. **Ausgaben aus der Erhaltungsrücklage.** Sie erscheinen in der
 *    Gesamtabrechnung als Ausgabe (§ 28 Abs. 2 WEG verlangt die
 *    Einnahmen-/Ausgabenrechnung), dürfen die Abrechnungsspitze aber nicht
 *    erhöhen: Bezahlt wurden sie aus Geld, das die Eigentümer über die
 *    Zuführungen früherer Jahre bereits aufgebracht haben. Ohne die
 *    Gegenposition „Entnahme aus der Erhaltungsrücklage" zahlten sie dieselbe
 *    Maßnahme ein zweites Mal.
 * 2. **Kostenarten der Kategorie RUECKLAGENZUFUEHRUNG.** Die Zuführung wird
 *    unten aus den tatsächlichen Umbuchungen gebildet. Stünde sie zusätzlich
 *    als Aufwandsposition hier, wäre sie doppelt enthalten.
 *
 * Kostenarten der Kategorie **ERTRAG** laufen umgekehrt: Ihre Ist-Einnahmen
 * werden nach demselben Schlüssel verteilt und **abgezogen** — sonst trüge die
 * Gemeinschaft Kosten, die durch Zinsen, Miete oder PV-Einspeisung längst
 * gedeckt sind.
 */
export function computeStatement(input: StatementInput): StatementResult {
  const rows: StatementCostRow[] = [];
  const befunde: StatementBefund[] = [];
  const perUnitTotal = new Map<string, number>(input.units.map((u) => [u.id, 0]));
  const reserveSpend = input.reserveSpendByCostType ?? new Map<string, number>();
  const income = input.incomeByCostType ?? new Map<string, number>();
  const labor = input.laborByCostType ?? new Map<string, { baseCents: number; unerfasstCents: number }>();
  let totalExpenseCents = 0;
  let reserveWithdrawalCents = 0;

  const addToUnits = (shares: Map<string, number>) => {
    for (const [unitId, cents] of shares) {
      perUnitTotal.set(unitId, (perUnitTotal.get(unitId) ?? 0) + cents);
    }
  };

  /**
   * Eine gescheiterte Verteilung.
   *
   * Die Unterscheidung ist die Antwort auf die Frage des Verwalters, ob das
   * Programm etwas vermisst oder der Bestand etwas nicht hergibt: Eine
   * unvollständige manuelle Erfassung ist eine **Eingabe**, die noch fehlt; ein
   * gescheiterter Umlageschlüssel ist eine **Stammdatenlücke** (Einheit ohne
   * MEA, ohne Wohnfläche). Beides blockiert, aber der nächste Handgriff liegt
   * woanders.
   */
  const verteilungsfehler = (
    ct: StatementCostTypeInput,
    text: string,
    art: "verteilung" | "stammdaten",
  ) => {
    befunde.push({
      art,
      blockierend: true,
      titel: `Verteilung offen: ${ct.name}`,
      text: `${ct.name}: ${text}`,
      ziel:
        art === "verteilung"
          ? { art: "abschnitt", anker: `verteilung-${ct.id}`, label: "Beträge je Einheit erfassen" }
          : { art: "stammdaten", anker: "einheiten", label: "Stammdaten der Einheiten öffnen" },
    });
  };

  for (const ct of input.costTypes) {
    // Siehe Punkt 2 oben: die Zuführung kommt aus den Umbuchungen, nicht von hier.
    if (ct.category === "RUECKLAGENZUFUEHRUNG") continue;

    // Einnahmen: gleiche Verteilung, umgekehrtes Vorzeichen.
    if (ct.category === "ERTRAG") {
      const ertragCents = income.get(ct.id) ?? 0;
      if (ertragCents === 0) continue;
      const row: StatementCostRow = {
        costTypeId: ct.id,
        name: `${ct.name} (Einnahme)`,
        distributionKey: ct.distributionKey,
        laborShareType: "KEINE",
        totalCents: -ertragCents,
        perUnit: null,
      };
      try {
        const shares = distributeByWeight(ertragCents, advanceWeightsForKey(input.units, ct.distributionKey));
        // Kein `-0` erzeugen (siehe economic-plan.ts).
        row.perUnit = new Map([...shares].map(([unitId, cents]) => [unitId, cents === 0 ? 0 : -cents]));
        addToUnits(row.perUnit);
        totalExpenseCents -= ertragCents;
      } catch (e) {
        row.error = e instanceof Error ? e.message : "Verteilung nicht möglich.";
        verteilungsfehler(ct, row.error, "stammdaten");
      }
      rows.push(row);
      continue;
    }

    const giroCents = input.expenseByCostType.get(ct.id) ?? 0;
    const ausRuecklageCents = reserveSpend.get(ct.id) ?? 0;
    const totalCents = giroCents + ausRuecklageCents;
    const manual = input.manualAmounts.get(ct.id);
    if (totalCents === 0 && (!manual || manual.size === 0)) continue;

    totalExpenseCents += totalCents;
    reserveWithdrawalCents += ausRuecklageCents;

    // Umgelegt wird nur der Teil, der NICHT aus der Rücklage kam.
    const verteilbarCents = giroCents;

    const row: StatementCostRow = {
      costTypeId: ct.id,
      name: ct.name,
      distributionKey: ct.distributionKey,
      laborShareType: ct.laborShareType,
      totalCents,
      reserveFundedCents: ausRuecklageCents > 0 ? ausRuecklageCents : undefined,
      perUnit: null,
      laborBaseCents: labor.get(ct.id)?.baseCents,
      // Ohne Eintrag ist für die ganze Position nichts erfasst. Der Rückfall auf
      // `verteilbarCents` ist wichtig: Sonst verschwände die Lücke stillschweigend
      // und die Abrechnung sähe aus, als gäbe es hier nichts Begünstigtes.
      laborUnerfasstCents:
        ct.laborShareType === "KEINE"
          ? undefined
          : (labor.get(ct.id)?.unerfasstCents ?? verteilbarCents),
    };

    if (MANUAL_KEYS.includes(ct.distributionKey)) {
      const manualSum = manual ? [...manual.values()].reduce((a, b) => a + b, 0) : 0;
      if (manualSum !== verteilbarCents) {
        row.error = `Manuelle Verteilung unvollständig: erfasst ${formatCents(manualSum)} von ${formatCents(verteilbarCents)}.`;
        verteilungsfehler(ct, row.error, "verteilung");
      } else {
        row.perUnit = new Map(manual);
      }
    } else if (verteilbarCents === 0) {
      // Vollständig aus der Rücklage bezahlt — nichts umzulegen, kein Fehler.
      row.perUnit = new Map(input.units.map((u) => [u.id, 0]));
    } else {
      try {
        row.perUnit = distributeByWeight(verteilbarCents, weightsForKey(input.units, ct.distributionKey));
      } catch (e) {
        row.error = e instanceof Error ? e.message : "Verteilung nicht möglich.";
        verteilungsfehler(ct, row.error, "stammdaten");
      }
    }
    if (row.perUnit) addToUnits(row.perUnit);
    rows.push(row);
  }

  // Gegenposition zu den aus der Rücklage bezahlten Ausgaben. Sie steht in der
  // Gesamtabrechnung als Deckung und wird nicht auf die Einheiten verteilt.
  if (reserveWithdrawalCents > 0) {
    rows.push({
      costTypeId: RESERVE_WITHDRAWAL_ROW_ID,
      name: "Entnahme aus der Erhaltungsrücklage (Deckung)",
      distributionKey: "MEA",
      laborShareType: "KEINE",
      totalCents: reserveWithdrawalCents,
      perUnit: null,
    });
  }

  // Tatsächliche Rücklagenzuführung (Umbuchungen) — nach dem Schlüssel des
  // beschlossenen Wirtschaftsplans, damit Plan und Abrechnung übereinstimmen.
  if (input.reserveTransferCents > 0) {
    const key = input.reserveTransferKey ?? "MEA";
    const row: StatementCostRow = {
      costTypeId: RESERVE_ROW_ID,
      name: "Zuführung Erhaltungsrücklage (Ist)",
      distributionKey: key,
      laborShareType: "KEINE",
      totalCents: input.reserveTransferCents,
      perUnit: null,
    };
    try {
      // Bewusst dieselbe Gewichtung wie der Wirtschaftsplan
      // (`advanceWeightsForKey`), nicht die strikte der Abrechnung: Der Plan
      // hat die Zuführung so verteilt, und beide müssen übereinstimmen. Sonst
      // liefe genau der Fehler wieder ein, den diese Änderung behebt — eine
      // Einheit ohne Wohnfläche trägt hier wie dort 0 statt zum Abbruch zu führen.
      row.perUnit = distributeByWeight(
        input.reserveTransferCents,
        advanceWeightsForKey(input.units, key),
      );
      addToUnits(row.perUnit);
    } catch (e) {
      row.error = e instanceof Error ? e.message : "Verteilung nicht möglich.";
      befunde.push({
        art: "stammdaten",
        blockierend: true,
        titel: "Zuführung zur Rücklage lässt sich nicht verteilen",
        text: `Rücklagenzuführung: ${row.error}`,
        ziel: { art: "stammdaten", anker: "einheiten", label: "Stammdaten der Einheiten öffnen" },
      });
    }
    rows.push(row);
  }

  // Soll-Ist-Abgleich der Zuführung. Bewusst nur ein Hinweis: Eine bewusst
  // abweichende Zuführung ist zulässig — eine vergessene Umbuchung wäre aber
  // ein stiller Fehler, der jedem Eigentümer ein Guthaben ausweist, das ihm
  // nicht zusteht.
  if (input.plannedReserveCents !== undefined && input.plannedReserveCents !== input.reserveTransferCents) {
    befunde.push({
      art: "zufuehrung-plan",
      blockierend: false,
      titel: "Zuführung weicht vom Wirtschaftsplan ab",
      text: `Zuführung zur Erhaltungsrücklage: laut Wirtschaftsplan ${formatCents(input.plannedReserveCents)}, tatsächlich umgebucht ${formatCents(input.reserveTransferCents)}. Bitte prüfen, ob die Umbuchung noch aussteht.`,
      // Nur Umbuchungen zählen als Zuführung (siehe `reserveTransferCents` in
      // statement-service.ts). Wer den Filter öffnet, sieht sofort, ob die
      // Umbuchung fehlt oder als Ein-/Ausgabe gebucht wurde.
      ziel: {
        art: "buchhaltung",
        filter: { art: "UMBUCHUNG" },
        label: "Umbuchungen des Jahres ansehen",
      },
    });
  }

  if (input.otherExpenseCents > 0) {
    const anzahl = input.otherExpenseCount;
    befunde.push({
      art: "ohne-kostenart",
      blockierend: true,
      titel: "Ausgaben ohne Kostenart",
      text:
        `Ausgaben ohne Kostenart: ${formatCents(input.otherExpenseCents)} sind keiner Kostenart zugeordnet und können nicht umgelegt werden.` +
        (anzahl ? ` Betroffen ${anzahl === 1 ? "ist 1 Buchung" : `sind ${anzahl} Buchungen`}.` : ""),
      ziel: {
        art: "buchhaltung",
        filter: { zuordnung: "offen", art: "AUSGABE" },
        label: "Die betroffenen Buchungen zuordnen",
      },
    });
  }

  // Eine Zeile mit 0 € ist keine Position: Kostenarten stehen im Katalog,
  // auch wenn im Jahr nichts darauf gebucht wurde. Gefragt ist, ob überhaupt
  // Geld bewegt wurde — Umbuchung in die Rücklage eingeschlossen.
  const hatPositionen = rows.some((r) => r.totalCents !== 0) || input.reserveTransferCents !== 0;
  if (!hatPositionen) {
    befunde.push({
      art: "leer",
      blockierend: false,
      titel: "Keine Buchungen im Wirtschaftsjahr",
      text:
        "Für dieses Wirtschaftsjahr ist nichts zu verteilen — es sind keine Buchungen erfasst. " +
        "Die Abrechnung wäre rechnerisch richtig und inhaltlich leer.",
      ziel: { art: "buchhaltung", filter: {}, label: "Buchhaltung des Jahres öffnen" },
    });
  }

  return {
    rows,
    perUnitTotal,
    totalExpenseCents,
    reserveTransferCents: input.reserveTransferCents,
    reserveWithdrawalCents,
    // Abgeleitet, nicht parallel geführt: Zwei Listen mit demselben Wortlaut
    // laufen auseinander, sobald eine Meldung umformuliert wird. `leer` ist
    // bewusst in keiner von beiden — es ist eine Feststellung, kein Hinweis auf
    // etwas Nachzubesserndes, und stand vorher als eigener Absatz auf der Seite.
    errors: befunde.filter((b) => b.blockierend).map((b) => b.text),
    warnings: befunde.filter((b) => !b.blockierend && b.art !== "leer").map((b) => b.text),
    befunde,
    hatPositionen,
  };
}

// ── Entwicklung der Erhaltungsrücklage ──────────────────────────────────────

/** Die Bewegungen **eines** Rücklagenkontos im Wirtschaftsjahr. */
export type RuecklagenKontoBewegung = {
  name: string;
  /** Bestand zu Beginn des Wirtschaftsjahres. */
  startCents: number;
  /** Einnahmen auf dem Rücklagenkonto — in aller Regel Zinsen. */
  zinsenCents: number;
  /** Ausgaben, die direkt vom Rücklagenkonto bezahlt wurden. */
  ausgabeCents: number;
  /** Umbuchungen **auf** dieses Konto: die Zuführung (Ist). */
  zufuehrungCents: number;
  /** Umbuchungen **von** diesem Konto zurück aufs laufende Konto. */
  rueckbuchungCents: number;
  /** Bestand am Ende — rechnerisch aus derselben Quelle wie die Kontentabelle. */
  endCents: number;
};

export type RuecklagenEntwicklung = {
  konten: { name: string; startCents: number; endCents: number }[];
  anfangsbestandCents: number;
  zufuehrungCents: number;
  zinsenCents: number;
  ausgabeCents: number;
  rueckbuchungCents: number;
  /** Ausgaben + Rückbuchungen: was die Rücklage im Jahr verlassen hat. */
  entnahmeCents: number;
  endbestandCents: number;
  /**
   * Geht Anfangsbestand + Zuführung + Zinsen − Entnahmen == Endbestand auf?
   *
   * Muss immer `true` sein — beide Seiten stammen aus denselben Buchungen. Ist
   * es einmal `false`, ist die Kette selbst kaputt, und eine Rechnung, die
   * nicht aufgeht, darf sich nicht als Erklärung ausgeben.
   */
  gehtAuf: boolean;
};

/**
 * Die Entwicklungsrechnung der Erhaltungsrücklage.
 *
 * **Wozu.** Der Vermögensbericht (§ 28 Abs. 4 WEG) nennt den Stand der Rücklage
 * als eine Zahl. Wer wissen will, warum sie so hoch ist — und wer meldet, sie
 * sei „falsch" —, kann mit dieser einen Zahl nichts anfangen: Sie zeigt nicht,
 * ob die Zuführung gebucht wurde, ob Zinsen fehlen oder ob eine Erhaltungs-
 * maßnahme daraus bezahlt wurde. Die Kette zeigt genau das, Zeile für Zeile.
 *
 * Mehrere Rücklagenkonten werden zusammengezogen — wie im Vermögensbericht
 * (`vermoegensbericht.ts`), damit beide Stellen dieselbe Zahl nennen.
 */
export function baueRuecklagenEntwicklung(
  konten: RuecklagenKontoBewegung[],
): RuecklagenEntwicklung {
  const summe = (feld: keyof Omit<RuecklagenKontoBewegung, "name">) =>
    konten.reduce((s, k) => s + k[feld], 0);

  const anfangsbestandCents = summe("startCents");
  const zufuehrungCents = summe("zufuehrungCents");
  const zinsenCents = summe("zinsenCents");
  const ausgabeCents = summe("ausgabeCents");
  const rueckbuchungCents = summe("rueckbuchungCents");
  const entnahmeCents = ausgabeCents + rueckbuchungCents;
  const endbestandCents = summe("endCents");

  return {
    konten: konten.map((k) => ({ name: k.name, startCents: k.startCents, endCents: k.endCents })),
    anfangsbestandCents,
    zufuehrungCents,
    zinsenCents,
    ausgabeCents,
    rueckbuchungCents,
    entnahmeCents,
    endbestandCents,
    gehtAuf:
      anfangsbestandCents + zufuehrungCents + zinsenCents - entnahmeCents === endbestandCents,
  };
}

// Abrechnungsspitze je Einheit (§ 28 Abs. 2 WEG): Kostenanteil − Soll-Vorschüsse.
// Positiv = Nachschuss, negativ = Guthaben. Gerechnet gegen das SOLL —
// Zahlungsrückstände bleiben davon unberührt offene Forderungen.
//
// „Soll" heißt: das **tatsächlich gestellte** Soll, also die Summe der
// DuePosting-Zeilen des Jahres (siehe `computeStatementView`), nicht der
// Jahresvorschuss aus dem Wirtschaftsplan. Der Unterschied ist erst mit der
// gerundeten Monatsrate entstanden und dort entscheidend: Zwölf aufgerundete
// Raten ergeben etwas mehr als der Planwert, und diese Überdeckung ist ein
// Guthaben des Eigentümers. Rechnete man gegen den ungerundeten Jahresbetrag,
// verschwände sie spurlos — ein Fehler, der still ins Ergebnis liefe und
// niemandem auffiele, weil beide Zahlen plausibel aussehen.
export function computePeakAmounts(
  perUnitTotal: Map<string, number>,
  duePerUnit: Map<string, number>,
): Map<string, number> {
  const result = new Map<string, number>();
  const unitIds = new Set([...perUnitTotal.keys(), ...duePerUnit.keys()]);
  for (const unitId of unitIds) {
    result.set(unitId, (perUnitTotal.get(unitId) ?? 0) - (duePerUnit.get(unitId) ?? 0));
  }
  return result;
}

export type LaborShareResult = {
  haushaltsnah: number;
  handwerker: number;
  /** Umgelegter Betrag, für den kein Lohnanteil erfasst ist — bewusste Lücke. */
  unerfasst: number;
};

/**
 * §35a-EStG-Ausweis je Einheit.
 *
 * **Ausgewiesen wird der Lohnanteil, nicht der Bruttobetrag.** Begünstigt sind
 * nach § 35a EStG nur Lohn-, Fahrt- und Maschinenkosten; Material ist es nicht.
 * Vorher stand hier der volle Rechnungsbetrag der geflaggten Kostenarten — und
 * genau diese Zahl trägt der Eigentümer in seine Steuererklärung ein. Bei einer
 * Handwerkerrechnung mit hohem Materialanteil war das um ein Vielfaches zu hoch.
 *
 * Der Anteil wird entlang derselben Verteilung umgelegt wie die Position selbst
 * (`perUnit` als Gewicht) — wer 3,7 % der Kosten trägt, trägt 3,7 % des
 * Lohnanteils. Verteilt wird centgenau, damit Σ Einheiten == Lohnanteil.
 *
 * **Wo nichts erfasst ist, wird nichts ausgewiesen.** Der Betrag wandert
 * stattdessen nach `unerfasst` und wird in der Abrechnung als Lücke benannt.
 * Eine geschätzte Zahl wäre schlimmer als keine: Sie sieht amtlich aus, hält
 * aber keiner Rückfrage des Finanzamts stand (§ 35a Abs. 5 Satz 3 EStG verlangt
 * die Rechnung).
 */
export function computeLaborShares(rows: StatementCostRow[]): Map<string, LaborShareResult> {
  const result = new Map<string, LaborShareResult>();
  const add = (unitId: string, feld: keyof LaborShareResult, cents: number) => {
    const entry = result.get(unitId) ?? { haushaltsnah: 0, handwerker: 0, unerfasst: 0 };
    entry[feld] += cents;
    result.set(unitId, entry);
  };

  for (const row of rows) {
    if (row.laborShareType === "KEINE" || !row.perUnit) continue;
    const feld = row.laborShareType === "HAUSHALTSNAHE_DIENSTLEISTUNG" ? "haushaltsnah" : "handwerker";
    for (const [feldName, cents] of [
      [feld, row.laborBaseCents ?? 0] as const,
      ["unerfasst", row.laborUnerfasstCents ?? 0] as const,
    ]) {
      const verteilt = distributeAlong(row.perUnit, cents);
      if (!verteilt) continue;
      for (const [unitId, anteil] of verteilt) add(unitId, feldName, anteil);
    }
  }
  return result;
}

/**
 * Verteilt `cents` entlang einer bereits berechneten Verteilung.
 *
 * Gibt `null` zurück, wenn nichts zu verteilen ist oder die Position vollständig
 * aus der Rücklage bezahlt wurde (alle Anteile 0) — dann gibt es kein Gewicht,
 * an dem sich der Lohnanteil ausrichten könnte, und umgelegt wurde ohnehin nichts.
 */
function distributeAlong(perUnit: Map<string, number>, cents: number): Map<string, number> | null {
  if (cents <= 0) return null;
  const shares = [...perUnit].map(([unitId, weight]) => ({ unitId, weight: weight > 0 ? weight : 0 }));
  if (shares.reduce((sum, s) => sum + s.weight, 0) <= 0) return null;
  return distributeByWeight(cents, shares);
}

// ── Tagesgenaue Aufteilung bei Eigentümerwechsel ─────────────────────────────

export type OwnershipPeriod = {
  userId: string;
  userName: string;
  validFrom: Date;
  validTo: Date | null; // null = offen
  sharePercent: number; // Anteil bei Miteigentum derselben Einheit
};

export type OwnerShare = { userId: string; userName: string; days: number; cents: number };

const DAY_MS = 24 * 60 * 60 * 1000;

// Teilt einen Einheiten-Betrag tagesgenau auf die Eigentümer des
// Wirtschaftsjahres [fyStart, fyEnd) auf. Nicht abgedeckte Tage landen in
// uncoveredCents (Hinweis in der UI, z. B. Eigentümer noch nicht erfasst).
export function splitByOwnership(
  amountCents: number,
  periods: OwnershipPeriod[],
  fyStart: Date,
  fyEnd: Date,
): { shares: OwnerShare[]; uncoveredCents: number } {
  if (amountCents === 0 || periods.length === 0) {
    return { shares: [], uncoveredCents: amountCents };
  }
  const totalDays = Math.round((fyEnd.getTime() - fyStart.getTime()) / DAY_MS);
  const weighted = periods
    .map((p, index) => {
      const from = Math.max(p.validFrom.getTime(), fyStart.getTime());
      const to = Math.min((p.validTo ?? fyEnd).getTime(), fyEnd.getTime());
      const days = Math.max(0, Math.round((to - from) / DAY_MS));
      return { ...p, days, weight: days * p.sharePercent, key: `${p.userId}#${index}` };
    })
    .filter((p) => p.weight > 0);
  if (weighted.length === 0) return { shares: [], uncoveredCents: amountCents };

  const coveredWeight = weighted.reduce((sum, p) => sum + p.weight, 0);
  const fullWeight = totalDays * 100;
  const uncoveredWeight = Math.max(0, fullWeight - coveredWeight);

  const UNCOVERED = "__uncovered__";
  const shares = distributeByWeight(amountCents, [
    ...weighted.map((p) => ({ unitId: p.key, weight: p.weight })),
    ...(uncoveredWeight > 0 ? [{ unitId: UNCOVERED, weight: uncoveredWeight }] : []),
  ]);

  return {
    shares: weighted.map((p) => ({
      userId: p.userId,
      userName: p.userName,
      days: p.days,
      cents: shares.get(p.key) ?? 0,
    })),
    uncoveredCents: shares.get(UNCOVERED) ?? 0,
  };
}
