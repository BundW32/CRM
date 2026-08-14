// Gemerkte Lesart der Bankdatei je Konto.
//
// Ein Verwalter importiert monatlich aus derselben Quelle. Ohne Gedächtnis
// ordnet er dieselben Spalten jedes Mal neu zu — und bei einer Datei ohne
// Kopfzeile heißen sie „Spalte 1…9", also genau das, was man sich nicht merkt.
// Gespeichert wird deshalb, was beim letzten bestätigten Import galt.
//
// Bewusst als Json-Feld am Konto und nicht als eigene Tabelle: Es gibt je Konto
// genau eine gültige Lesart, sie hat keine eigene Geschichte, und sie wird nur
// zusammen mit dem Konto gelesen.
import type { ColumnMapping, Zeichensatz } from "./bank-import";

export type BankImportProfil = {
  mapping: Partial<ColumnMapping>;
  encoding?: Zeichensatz;
  delimiter?: string;
  hasHeader?: boolean;
  /** ISO-Datum der letzten Bestätigung — für die Anzeige „zuletzt genutzt". */
  gespeichertAm?: string;
};

const SPALTEN = [
  "date", "amount", "debit", "credit", "purpose",
  "counterparty", "counterpartyIn", "counterpartyOut",
] as const;
const ZEICHENSAETZE: Zeichensatz[] = ["utf-8", "utf-8-bom", "utf-16le", "utf-16be", "windows-1252"];

/**
 * Liest das gespeicherte Profil. Der Wert kommt als `Json` aus der Datenbank —
 * also als „irgendetwas". Ein halb gültiges Profil wird verworfen statt
 * geflickt: Ein falscher Spaltenindex ist schlimmer als gar keiner, weil er
 * unbemerkt in die Buchung durchschlägt.
 */
export function leseImportProfil(raw: unknown): BankImportProfil | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const rohMapping = obj.mapping;
  if (!rohMapping || typeof rohMapping !== "object" || Array.isArray(rohMapping)) return null;
  const quelle = rohMapping as Record<string, unknown>;
  const mapping: Partial<ColumnMapping> = {};
  for (const spalte of SPALTEN) {
    const wert = quelle[spalte];
    if (typeof wert !== "number" || !Number.isInteger(wert) || wert < 0) continue;
    mapping[spalte] = wert;
  }
  if (mapping.date === undefined || mapping.purpose === undefined) return null;
  const encoding = typeof obj.encoding === "string" && ZEICHENSAETZE.includes(obj.encoding as Zeichensatz)
    ? (obj.encoding as Zeichensatz)
    : undefined;
  return {
    mapping,
    encoding,
    delimiter: typeof obj.delimiter === "string" ? obj.delimiter : undefined,
    hasHeader: typeof obj.hasHeader === "boolean" ? obj.hasHeader : undefined,
    gespeichertAm: typeof obj.gespeichertAm === "string" ? obj.gespeichertAm : undefined,
  };
}

/** Baut das zu speichernde Profil — nur gesetzte Spalten wandern hinein. */
export function baueImportProfil(
  mapping: Partial<ColumnMapping>,
  meta: { encoding?: Zeichensatz; delimiter?: string; hasHeader?: boolean; stichtag?: Date },
): BankImportProfil {
  const schlank: Partial<ColumnMapping> = {};
  for (const spalte of SPALTEN) {
    const wert = mapping[spalte];
    if (typeof wert === "number") schlank[spalte] = wert;
  }
  return {
    mapping: schlank,
    encoding: meta.encoding,
    delimiter: meta.delimiter,
    hasHeader: meta.hasHeader,
    gespeichertAm: (meta.stichtag ?? new Date()).toISOString(),
  };
}
