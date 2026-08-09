// Umlage-Verteilungs-Engine: verteilt einen Gesamtbetrag (Integer-Cent)
// centgenau auf Einheiten nach Gewichten. Kein UI, keine DB — pure Funktionen.
import type { DistributionKey, UnitType } from "@/generated/prisma/client";

export type Share = { unitId: string; weight: number };

/**
 * Verteilt totalCents nach Gewichten (Largest-Remainder-Verfahren).
 * Garantie: Summe der Rückgabe == totalCents (centgenau). Eine durch die
 * Restcent-Regel des Auftrags verbleibende Differenz wird der betragsgrößten
 * Position zugeschlagen.
 *
 * totalCents < 0 oder Gesamtgewicht <= 0 → Fehler; totalCents == 0 → alle 0.
 */
export function distributeByWeight(totalCents: number, shares: Share[]): Map<string, number> {
  if (!Number.isInteger(totalCents)) throw new Error("totalCents muss eine Ganzzahl (Cent) sein.");
  if (totalCents < 0) throw new Error("totalCents darf nicht negativ sein.");
  if (shares.length === 0) throw new Error("Mindestens eine Einheit erforderlich.");
  for (const s of shares) {
    if (!Number.isFinite(s.weight) || s.weight < 0) {
      throw new Error(`Ungültiges Gewicht für Einheit ${s.unitId}.`);
    }
  }
  const totalWeight = shares.reduce((sum, s) => sum + s.weight, 0);
  if (totalWeight <= 0) throw new Error("Gesamtgewicht muss größer als 0 sein.");

  const result = new Map<string, number>();
  if (totalCents === 0) {
    for (const s of shares) result.set(s.unitId, 0);
    return result;
  }

  // 1) Ganzzahl-Anteil (abgerundet) + Nachkommarest je Einheit
  const remainders: { unitId: string; remainder: number; base: number }[] = [];
  let assigned = 0;
  for (const s of shares) {
    const exact = (totalCents * s.weight) / totalWeight;
    const base = Math.floor(exact);
    assigned += base;
    remainders.push({ unitId: s.unitId, remainder: exact - base, base });
    result.set(s.unitId, base);
  }

  // 2) Restcents nach größtem Nachkommarest verteilen (stabil: bei Gleichstand
  //    gewinnt die frühere Position — deterministisch für Tests und Abrechnung)
  let leftover = totalCents - assigned;
  const byRemainder = remainders
    .map((r, index) => ({ ...r, index }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (let i = 0; leftover > 0; i = (i + 1) % byRemainder.length, leftover--) {
    const target = byRemainder[i];
    result.set(target.unitId, (result.get(target.unitId) ?? 0) + 1);
  }

  // 3) Restcent-Regel des Auftrags: sollte je eine Differenz verbleiben
  //    (defensiv — mathematisch ist die Summe hier bereits exakt), der
  //    betragsgrößten Position zuschlagen.
  const sum = [...result.values()].reduce((a, b) => a + b, 0);
  const diff = totalCents - sum;
  if (diff !== 0) {
    let largest = shares[0].unitId;
    for (const s of shares) {
      if ((result.get(s.unitId) ?? 0) > (result.get(largest) ?? 0)) largest = s.unitId;
    }
    result.set(largest, (result.get(largest) ?? 0) + diff);
  }
  return result;
}

export type UnitForDistribution = {
  id: string;
  // Für Fehlermeldungen: Eine Verteilung, die scheitert, nennt die Einheit
  // beim Namen — „WE 03" schickt den Verwalter hin, eine Datenbank-Id lässt
  // ihn suchen. Pflichtfeld aus demselben Grund wie unitType.
  label: string;
  mea: number | null;
  livingArea: number | null;
  personCount: number | null;
  // Für den Schlüssel JE_STELLPLATZ: Nur Einheiten vom Typ STELLPLATZ tragen.
  // Pflichtfeld, damit keine Abfrage das Feld vergisst und der Schlüssel dann
  // still „keine Stellplätze" meldet, obwohl es welche gibt.
  unitType: UnitType;
};

/**
 * Gewichte je Einheit für einen Umlageschlüssel (MEA/FLAECHE/EINHEITEN/PERSONEN).
 * VERBRAUCH/FESTBETRAG/INDIVIDUELL benötigen Zusatzdaten und werden separat
 * behandelt (nicht Teil dieses Schritts).
 *
 * Fehlende Stammdaten (mea/Fläche/Personen = null) → verständlicher Fehler,
 * damit keine Abrechnung mit stillschweigend falschen Gewichten entsteht.
 * Ausnahme Stellplätze: Ein Stellplatz hat zu Recht keine Wohnfläche und keine
 * Personenzahl — er trägt bei FLAECHE/PERSONEN Gewicht 0, statt die Abrechnung
 * zu blockieren (dieselbe Überlegung wie bei der Vorschuss-Gewichtung,
 * DECISIONS Nr. 125). MEA bleibt auch für Stellplätze Pflicht: Jedes
 * Sondereigentum hat einen Miteigentumsanteil.
 */
export function weightsForKey(units: UnitForDistribution[], key: DistributionKey): Share[] {
  if (units.length === 0) throw new Error("Mindestens eine Einheit erforderlich.");
  switch (key) {
    case "MEA":
      return units.map((u) => {
        if (u.mea == null) throw new Error(`Einheit ohne Miteigentumsanteil (MEA): ${u.label}`);
        return { unitId: u.id, weight: u.mea };
      });
    case "FLAECHE":
      return units.map((u) => {
        if (u.livingArea == null) {
          if (u.unitType === "STELLPLATZ") return { unitId: u.id, weight: 0 };
          throw new Error(`Einheit ohne Wohnfläche: ${u.label}`);
        }
        // Ganzzahl-Gewichte in cm² — vermeidet Fließkomma-Artefakte
        return { unitId: u.id, weight: Math.round(u.livingArea * 10000) };
      });
    case "EINHEITEN":
      // Stellplätze sind keine „Einheiten" im Sinne dieses Schlüssels: Wer die
      // Verwaltervergütung „je Einheit" umlegt, meint Wohn- und Gewerbe-
      // einheiten — sonst zahlte ein Tiefgaragenplatz so viel wie eine Wohnung.
      // Für stellplatzbezogene Kosten gibt es JE_STELLPLATZ.
      if (!units.some((u) => u.unitType !== "STELLPLATZ")) {
        throw new Error(
          "Der Schlüssel „je Einheit“ braucht mindestens eine Wohn- oder Gewerbeeinheit.",
        );
      }
      return units.map((u) => ({ unitId: u.id, weight: u.unitType === "STELLPLATZ" ? 0 : 1 }));
    case "PERSONEN":
      return units.map((u) => {
        if (u.personCount == null) {
          if (u.unitType === "STELLPLATZ") return { unitId: u.id, weight: 0 };
          throw new Error(`Einheit ohne Personenzahl: ${u.label}`);
        }
        return { unitId: u.id, weight: u.personCount };
      });
    case "JE_STELLPLATZ": {
      // Gleichmäßig, aber NUR auf Stellplätze/Garagen — Wohn- und
      // Gewerbeeinheiten tragen solche Kosten nicht mit.
      if (!units.some((u) => u.unitType === "STELLPLATZ")) {
        throw new Error(
          "Der Schlüssel „je Stellplatz“ braucht mindestens eine Einheit vom Typ Stellplatz.",
        );
      }
      return units.map((u) => ({ unitId: u.id, weight: u.unitType === "STELLPLATZ" ? 1 : 0 }));
    }
    default:
      throw new Error(`Umlageschlüssel ${key} benötigt Zusatzdaten (nicht in diesem Schritt).`);
  }
}
