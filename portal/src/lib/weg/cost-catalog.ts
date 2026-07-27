// Vorbefüllter WEG-Standardkatalog an Kostenarten. Wird beim Einrichten einer
// WEG übernommen und ist danach frei editierbar (Schlüssel, Kategorie, Flags).
// §35a-Flags: Lohnanteile haushaltsnaher Dienst-/Handwerkerleistungen sind für
// Eigentümer steuerlich bescheinigungsfähig. recoverableBetrKV: auf Mieter
// umlagefähig nach Betriebskostenverordnung (relevant für vermietende Eigentümer).
import type { CostCategory, DistributionKey, LaborShareType } from "@/generated/prisma/client";

export type CatalogEntry = {
  name: string;
  category: CostCategory;
  distributionKey: DistributionKey;
  laborShareType: LaborShareType;
  recoverableBetrKV: boolean;
  /** Heiz-/Warmwasserkosten nach HeizkostenV — Zwangsaufteilung 50–70/Rest Fläche. */
  heatingCost?: boolean;
};

export const WEG_COST_CATALOG: CatalogEntry[] = [
  { name: "Hausmeister", category: "BETRIEBSKOSTEN", distributionKey: "MEA", laborShareType: "HAUSHALTSNAHE_DIENSTLEISTUNG", recoverableBetrKV: true },
  { name: "Gartenpflege", category: "BETRIEBSKOSTEN", distributionKey: "MEA", laborShareType: "HAUSHALTSNAHE_DIENSTLEISTUNG", recoverableBetrKV: true },
  { name: "Allgemeinstrom", category: "BETRIEBSKOSTEN", distributionKey: "MEA", laborShareType: "KEINE", recoverableBetrKV: true },
  { name: "Wasser/Abwasser", category: "BETRIEBSKOSTEN", distributionKey: "PERSONEN", laborShareType: "KEINE", recoverableBetrKV: true },
  { name: "Müllabfuhr", category: "BETRIEBSKOSTEN", distributionKey: "PERSONEN", laborShareType: "KEINE", recoverableBetrKV: true },
  { name: "Heizung/Warmwasser", category: "BETRIEBSKOSTEN", distributionKey: "VERBRAUCH", laborShareType: "KEINE", recoverableBetrKV: true, heatingCost: true },
  { name: "Gebäudeversicherung", category: "BETRIEBSKOSTEN", distributionKey: "MEA", laborShareType: "KEINE", recoverableBetrKV: true },
  { name: "Haftpflichtversicherung", category: "BETRIEBSKOSTEN", distributionKey: "MEA", laborShareType: "KEINE", recoverableBetrKV: true },
  { name: "Aufzug (Wartung)", category: "BETRIEBSKOSTEN", distributionKey: "FLAECHE", laborShareType: "HANDWERKERLEISTUNG", recoverableBetrKV: true },
  { name: "Treppenhausreinigung", category: "BETRIEBSKOSTEN", distributionKey: "FLAECHE", laborShareType: "HAUSHALTSNAHE_DIENSTLEISTUNG", recoverableBetrKV: true },
  { name: "Winterdienst", category: "BETRIEBSKOSTEN", distributionKey: "FLAECHE", laborShareType: "HAUSHALTSNAHE_DIENSTLEISTUNG", recoverableBetrKV: true },
  { name: "Laufende Instandhaltung", category: "INSTANDHALTUNG", distributionKey: "MEA", laborShareType: "HANDWERKERLEISTUNG", recoverableBetrKV: false },
  { name: "Verwaltungskosten", category: "VERWALTUNG", distributionKey: "EINHEITEN", laborShareType: "KEINE", recoverableBetrKV: false },
  { name: "Kontoführung", category: "VERWALTUNG", distributionKey: "EINHEITEN", laborShareType: "KEINE", recoverableBetrKV: false },
  { name: "Zuführung Erhaltungsrücklage", category: "RUECKLAGENZUFUEHRUNG", distributionKey: "MEA", laborShareType: "KEINE", recoverableBetrKV: false },
  // Einnahmen (§ 28 Abs. 1 WEG). Sie mindern den Vorschussbedarf — fehlen sie im
  // Plan, ist das Hausgeld zu hoch angesetzt.
  { name: "Zinserträge", category: "ERTRAG", distributionKey: "MEA", laborShareType: "KEINE", recoverableBetrKV: false },
];
