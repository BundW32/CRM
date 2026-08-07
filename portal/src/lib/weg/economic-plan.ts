// Wirtschaftsplan-Logik (§ 28 Abs. 1 WEG): Wirtschaftsjahr, Vorschuss-Gewichte,
// Einzelwirtschaftspläne und monatliche Hausgeld-Raten. Pure Funktionen —
// DB/UI übernehmen die Server Actions.
import type { CostCategory, DistributionKey } from "@/generated/prisma/client";
import { distributeByWeight, type Share, type UnitForDistribution } from "./distribution";

// Die 12 Kalendermonate des Wirtschaftsjahres, das im Jahr `year` beginnt
// (startMonth 1–12; bei 1 = Kalenderjahr).
export function fiscalYearMonths(year: number, startMonth: number): { year: number; month: number }[] {
  if (startMonth < 1 || startMonth > 12) throw new Error("Ungültiger Wirtschaftsjahr-Beginn.");
  return Array.from({ length: 12 }, (_, i) => {
    const m = startMonth + i;
    return { year: m > 12 ? year + 1 : year, month: m > 12 ? m - 12 : m };
  });
}

// Zeitraum des Wirtschaftsjahres als [start, endExclusive) in UTC.
export function fiscalYearRange(year: number, startMonth: number): { start: Date; end: Date } {
  if (startMonth < 1 || startMonth > 12) throw new Error("Ungültiger Wirtschaftsjahr-Beginn.");
  return {
    start: new Date(Date.UTC(year, startMonth - 1, 1)),
    end: new Date(Date.UTC(year + 1, startMonth - 1, 1)),
  };
}

/**
 * Vorschuss-Gewichte für den Wirtschaftsplan. Anders als die strikte
 * Abrechnungs-Verteilung (weightsForKey) gilt hier:
 * - VERBRAUCH / FESTBETRAG / INDIVIDUELL → nach MEA (übliche Praxis für
 *   Vorschüsse; die Jahresabrechnung korrigiert später centgenau).
 * - FLAECHE / PERSONEN: fehlende Werte zählen als 0 (z. B. Stellplatz ohne
 *   Wohnfläche trägt solche Kosten nicht mit).
 * - MEA bleibt strikt: ohne vollständige MEA kein Plan.
 */
export function advanceWeightsForKey(units: UnitForDistribution[], key: DistributionKey): Share[] {
  if (units.length === 0) throw new Error("Mindestens eine Einheit erforderlich.");
  const effective: DistributionKey =
    key === "VERBRAUCH" || key === "FESTBETRAG" || key === "INDIVIDUELL" ? "MEA" : key;
  switch (effective) {
    case "MEA":
      return units.map((u) => {
        if (u.mea == null) throw new Error(`Einheit ohne Miteigentumsanteil (MEA): ${u.id}`);
        return { unitId: u.id, weight: u.mea };
      });
    case "FLAECHE":
      return units.map((u) => ({ unitId: u.id, weight: Math.round((u.livingArea ?? 0) * 10000) }));
    case "EINHEITEN":
      return units.map((u) => ({ unitId: u.id, weight: 1 }));
    case "PERSONEN":
      return units.map((u) => ({ unitId: u.id, weight: u.personCount ?? 0 }));
    case "JE_STELLPLATZ":
      // Auch beim Vorschuss strikt auf die Stellplätze — hier gibt es keine
      // nachsichtige Variante: Ohne Stellplatz-Einheit liefe die Position auf
      // ein Gesamtgewicht von 0, und das übersetzt computeUnitAdvances in
      // eine verständliche PositionNichtVerteilbar-Meldung.
      return units.map((u) => ({ unitId: u.id, weight: u.unitType === "STELLPLATZ" ? 1 : 0 }));
    default:
      throw new Error(`Unerwarteter Umlageschlüssel: ${effective}`);
  }
}

export type PlanItemInput = {
  costTypeId: string;
  distributionKey: DistributionKey;
  amountCents: number; // Jahres-Planwert, immer positiv
  /** ERTRAG mindert den Vorschussbedarf, statt ihn zu erhöhen. */
  category?: CostCategory;
};

/**
 * Eine einzelne Position lässt sich nicht verteilen.
 *
 * Der Grund für eine eigene Fehlerklasse: Bis hierher fiel aus der Tiefe der
 * Verteilung ein „Gesamtgewicht muss größer als 0 sein" nach oben durch — ein
 * Satz aus der Rechenmaschine, der weder die Kostenart nennt noch das fehlende
 * Feld. Eine Gemeinschaft, die den Standardkatalog übernommen hat, stand damit
 * vor einem gesperrten Knopf und keiner Ahnung, wo sie ansetzen soll: Der
 * Katalog verteilt auch nach Personenzahl und Fläche, die Einrichtung verlangt
 * aber nur Miteigentumsanteile.
 *
 * `costTypeId` und `fehlendesFeld` reisen deshalb mit, damit die Oberfläche den
 * Namen der Kostenart einsetzen und direkt an die richtige Stelle verlinken kann.
 */
export class PositionNichtVerteilbar extends Error {
  constructor(
    readonly costTypeId: string,
    readonly distributionKey: DistributionKey,
    /** Welches Stammdatenfeld fehlt – null, wenn die Ursache woanders liegt. */
    readonly fehlendesFeld: "flaeche" | "personen" | "mea" | null,
    message: string,
  ) {
    super(message);
    this.name = "PositionNichtVerteilbar";
  }
}

/**
 * Welche Einheiten das genannte Feld nicht haben.
 *
 * `PositionNichtVerteilbar` sagt bisher nur, *welches* Feld fehlt — nicht, bei
 * wem. Für die Fehlermeldung ist genau das der Unterschied zwischen „Die
 * Verteilung ist nicht möglich" und „Bei WE 03 fehlt die Wohnfläche": Das eine
 * lässt den Nutzer suchen, das andere schickt ihn hin.
 */
export function einheitenOhneFeld<T extends UnitForDistribution>(
  units: T[],
  feld: "flaeche" | "personen" | "mea",
): T[] {
  const wert = (u: UnitForDistribution) =>
    feld === "flaeche" ? u.livingArea : feld === "personen" ? u.personCount : u.mea;
  return units.filter((u) => wert(u) == null);
}

/** Welches Feld ein Schlüssel braucht – für die Fehlermeldung und die Vorprüfung. */
export function benoetigtesFeld(key: DistributionKey): "flaeche" | "personen" | "mea" | null {
  if (key === "FLAECHE") return "flaeche";
  if (key === "PERSONEN") return "personen";
  if (key === "EINHEITEN") return null;
  // JE_STELLPLATZ braucht kein Stammdatenfeld, sondern Einheiten vom Typ
  // Stellplatz — die Meldung dazu formuliert die Verteilung selbst.
  if (key === "JE_STELLPLATZ") return null;
  // VERBRAUCH/FESTBETRAG/INDIVIDUELL laufen beim Vorschuss über MEA.
  return "mea";
}

export type UnitAdvances = {
  // Jahres-Vorschuss je Einheit (Summe über alle Positionen) — centgenau:
  // Σ perUnit == Σ items.amountCents
  perUnit: Map<string, number>;
  // Aufschlüsselung je Position (für den Einzelwirtschaftsplan)
  perItem: Map<string, Map<string, number>>;
  /** Vorschussbedarf gesamt: Ausgaben − Einnahmen. */
  totalCents: number;
  /** Σ geplanter Ausgaben (ohne Einnahmen) — für die Darstellung. */
  expenseCents: number;
  /** Σ geplanter Einnahmen — mindert den Bedarf. */
  incomeCents: number;
};

/**
 * Verteilt alle Planpositionen auf die Einheiten (Einzelwirtschaftspläne).
 *
 * § 28 Abs. 1 WEG verlangt einen Plan über die voraussichtlichen **Einnahmen und
 * Ausgaben**. Positionen der Kategorie `ERTRAG` — Zinsen, Miete aus
 * Gemeinschaftseigentum, PV-Einspeisung — mindern deshalb den Vorschussbedarf,
 * verteilt nach ihrem eigenen Schlüssel. Ohne sie wäre das Hausgeld bei jeder
 * Gemeinschaft mit Einnahmen systematisch zu hoch angesetzt.
 *
 * Die Beträge bleiben wie überall positiv; die Richtung steckt in der Kategorie.
 */
export function computeUnitAdvances(items: PlanItemInput[], units: UnitForDistribution[]): UnitAdvances {
  const perUnit = new Map<string, number>(units.map((u) => [u.id, 0]));
  const perItem = new Map<string, Map<string, number>>();
  let expenseCents = 0;
  let incomeCents = 0;
  for (const item of items) {
    if (item.amountCents < 0) throw new Error("Planwerte dürfen nicht negativ sein.");
    if (item.amountCents === 0) continue;
    const istErtrag = item.category === "ERTRAG";
    if (istErtrag) incomeCents += item.amountCents;
    else expenseCents += item.amountCents;
    let shares: Map<string, number>;
    try {
      shares = distributeByWeight(item.amountCents, advanceWeightsForKey(units, item.distributionKey));
    } catch (e) {
      // Den Rechenfehler in etwas übersetzen, mit dem eine Gemeinschaft etwas
      // anfangen kann – siehe `PositionNichtVerteilbar`.
      const feld = benoetigtesFeld(item.distributionKey);
      throw new PositionNichtVerteilbar(
        item.costTypeId,
        item.distributionKey,
        feld,
        feld === "flaeche"
          ? "Bei keiner Einheit ist eine Wohn-/Nutzfläche hinterlegt."
          : feld === "personen"
            ? "Bei keiner Einheit ist eine Personenzahl hinterlegt."
            : feld === "mea"
              ? "Die Miteigentumsanteile sind unvollständig."
              : item.distributionKey === "JE_STELLPLATZ"
                ? "Im Objekt ist keine Einheit vom Typ „Stellplatz“ angelegt — " +
                  "der Schlüssel „je Stellplatz“ braucht mindestens eine."
                : e instanceof Error
                  ? e.message
                  : "Verteilung nicht möglich.",
      );
    }
    // Einnahmen mit umgekehrtem Vorzeichen — je Einheit und in der
    // Aufschlüsselung, damit der Einzelwirtschaftsplan beides zeigt.
    // `0 * -1` ergibt in JavaScript `-0` — das reist durch JSON und Snapshots
    // und liest sich in der Oberfläche als „−0,00 €". Deshalb explizit.
    const gerichtet = istErtrag
      ? new Map([...shares].map(([unitId, cents]) => [unitId, cents === 0 ? 0 : -cents]))
      : shares;
    perItem.set(item.costTypeId, gerichtet);
    for (const [unitId, cents] of gerichtet) {
      perUnit.set(unitId, (perUnit.get(unitId) ?? 0) + cents);
    }
  }
  const totalCents = expenseCents - incomeCents;
  if (totalCents < 0) {
    throw new Error(
      "Die geplanten Einnahmen übersteigen die geplanten Ausgaben — daraus lässt sich kein Hausgeld ableiten.",
    );
  }
  return { perUnit, perItem, totalCents, expenseCents, incomeCents };
}

// 12 Monatsraten, die centgenau den Jahresbetrag ergeben (Restcents auf die
// ersten Monate verteilt — deterministisch).
export function monthlyInstallments(annualCents: number): number[] {
  if (annualCents === 0) return Array(12).fill(0);
  const shares = distributeByWeight(
    annualCents,
    Array.from({ length: 12 }, (_, i) => ({ unitId: String(i), weight: 1 })),
  );
  return Array.from({ length: 12 }, (_, i) => shares.get(String(i)) ?? 0);
}
