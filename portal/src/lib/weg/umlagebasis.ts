// Die Bezugsgrößen der Kostenverteilung — was ein Empfänger braucht, um seine
// Abrechnung nachzurechnen.
//
// Bisher stand in der Spalte „Umlageschlüssel" nur der Name des Schlüssels:
// „Miteigentumsanteile (MEA)" oder „Wohn-/Nutzfläche". Die Zahl dahinter — 205
// von 1.000 Anteilen, 90 von 500 m² — stand nirgends. Ein Mieter oder
// Eigentümer konnte damit zwar sehen, **wonach** verteilt wurde, aber nicht,
// **ob** die Verteilung stimmt. Ein Testnutzer hat genau das angemerkt.
//
// Dieses Modul rechnet aus den Stammdaten der Einheiten dieselben Summen, die
// die Verteilung (`weightsForKey`) benutzt — also den Nenner, mit dem tatsächlich
// gerechnet wurde, nicht einen getrennt gepflegten Sollwert. Zwei Ausgaben:
// die Zeilen für einen Block „Grundlage der Verteilung" im Kopf der Abrechnung
// und der kurze Anteil, der hinter dem Schlüssel in der Tabelle steht.
import type { DistributionKey } from "@/generated/prisma/client";
import type { UnitForDistribution } from "./distribution";

export type UmlagebasisEinheit = {
  mea: number | null;
  flaeche: number | null;
  personen: number | null;
  /** Zählt beim Schlüssel „je Einheit" mit (keine Stellplätze). */
  einheit: boolean;
  stellplatz: boolean;
};

export type Umlagebasis = {
  meaSumme: number;
  flaecheSumme: number;
  einheitenSumme: number;
  personenSumme: number;
  stellplaetzeSumme: number;
  einheiten: Record<string, UmlagebasisEinheit>;
};

/** Eine Zeile des Blocks „Grundlage der Verteilung". */
export type UmlagebasisZeile = { schluessel: string; einheit: string; gesamt: string };

export function baueUmlagebasis(units: UnitForDistribution[]): Umlagebasis {
  const basis: Umlagebasis = {
    meaSumme: 0,
    flaecheSumme: 0,
    einheitenSumme: 0,
    personenSumme: 0,
    stellplaetzeSumme: 0,
    einheiten: {},
  };
  for (const u of units) {
    const stellplatz = u.unitType === "STELLPLATZ";
    basis.einheiten[u.id] = {
      mea: u.mea,
      flaeche: u.livingArea,
      personen: u.personCount,
      einheit: !stellplatz,
      stellplatz,
    };
    basis.meaSumme += u.mea ?? 0;
    basis.flaecheSumme += u.livingArea ?? 0;
    basis.personenSumme += u.personCount ?? 0;
    if (stellplatz) basis.stellplaetzeSumme += 1;
    else basis.einheitenSumme += 1;
  }
  return basis;
}

const ganz = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });
const flaeche = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Zähler und Nenner eines Schlüssels für eine Einheit — oder null, wenn der
 * Schlüssel keine Stammdaten-Bezugsgröße hat (Verbrauch, Festbetrag,
 * individuell) oder die Einheit keinen Wert dafür trägt.
 */
export function anteilVon(
  key: DistributionKey,
  basis: Umlagebasis,
  unitId: string,
): { einheit: string; gesamt: string } | null {
  const e = basis.einheiten[unitId];
  if (!e) return null;
  switch (key) {
    case "MEA":
      if (e.mea == null || basis.meaSumme <= 0) return null;
      return { einheit: ganz.format(e.mea), gesamt: ganz.format(basis.meaSumme) };
    case "FLAECHE":
      if (e.flaeche == null || basis.flaecheSumme <= 0) return null;
      return { einheit: `${flaeche.format(e.flaeche)} m²`, gesamt: `${flaeche.format(basis.flaecheSumme)} m²` };
    case "EINHEITEN":
      if (!e.einheit || basis.einheitenSumme <= 0) return null;
      return { einheit: "1", gesamt: ganz.format(basis.einheitenSumme) };
    case "PERSONEN":
      if (e.personen == null || basis.personenSumme <= 0) return null;
      return { einheit: ganz.format(e.personen), gesamt: ganz.format(basis.personenSumme) };
    case "JE_STELLPLATZ":
      if (!e.stellplatz || basis.stellplaetzeSumme <= 0) return null;
      return { einheit: "1", gesamt: ganz.format(basis.stellplaetzeSumme) };
    default:
      return null;
  }
}

/**
 * Der Schlüssel samt Anteil, wie er in der Tabelle steht:
 * „Wohn-/Nutzfläche (90,00 m² / 500,00 m²)".
 *
 * Heizkosten bleiben beim HeizkostenV-Text („70 % Verbrauch, 30 % Wohnfläche"):
 * Ihr Flächenanteil steht im Block darüber, und die Zelle ist ohnehin die
 * längste der Tabelle.
 */
export function schluesselMitAnteil(
  label: string,
  row: { distributionKey: DistributionKey; heatingCost?: boolean | null },
  basis: Umlagebasis | null | undefined,
  unitId: string,
): string {
  if (!basis || row.heatingCost) return label;
  const anteil = anteilVon(row.distributionKey, basis, unitId);
  return anteil ? `${label} (${anteil.einheit} / ${anteil.gesamt})` : label;
}

const REIHENFOLGE: DistributionKey[] = ["MEA", "FLAECHE", "EINHEITEN", "PERSONEN", "JE_STELLPLATZ"];

const NAMEN: Partial<Record<DistributionKey, string>> = {
  MEA: "Miteigentumsanteile",
  FLAECHE: "Wohn-/Nutzfläche",
  EINHEITEN: "Einheiten",
  PERSONEN: "Personen",
  JE_STELLPLATZ: "Stellplätze",
};

/**
 * Die Zeilen des Blocks „Grundlage der Verteilung" — nur die Schlüssel, die in
 * den Positionen dieser Abrechnung tatsächlich vorkommen. Wer nichts nach
 * Personen verteilt, bekommt keine Personenzeile: Eine Zahl, die nirgends
 * eingeht, verwirrt mehr, als sie erklärt.
 *
 * Heizkosten verteilen ihren Grundkostenanteil nach Wohnfläche (§§ 7, 8
 * HeizkostenV) — deshalb bringt eine Heizkosten-Position die Flächenzeile mit,
 * auch wenn ihr Schlüssel „Verbrauch" heißt.
 */
export function umlagebasisZeilen(
  rows: { distributionKey: DistributionKey; heatingCost?: boolean | null }[],
  basis: Umlagebasis | null | undefined,
  unitId: string,
): UmlagebasisZeile[] {
  if (!basis) return [];
  const genutzt = new Set<DistributionKey>();
  for (const r of rows) {
    genutzt.add(r.distributionKey);
    if (r.heatingCost) genutzt.add("FLAECHE");
  }
  const zeilen: UmlagebasisZeile[] = [];
  for (const key of REIHENFOLGE) {
    if (!genutzt.has(key)) continue;
    const anteil = anteilVon(key, basis, unitId);
    if (!anteil) continue;
    zeilen.push({ schluessel: NAMEN[key] ?? key, einheit: anteil.einheit, gesamt: anteil.gesamt });
  }
  return zeilen;
}
