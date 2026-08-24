// Welches Format hat die hochgeladene Datei — und wie wird daraus dieselbe
// Liste von Buchungsvorschlägen wie beim CSV-Import?
//
// Drei Wege, ein Ergebnis: `ParsedBooking[]`. Duplikaterkennung, Vorschau,
// Zuordnungsvorschläge und Import hängen damit an einer einzigen Stelle und
// wissen nicht, aus welchem Format die Zeilen kamen — genau wie ein späterer
// Open-Banking-Adapter.
//
// MT940 und CAMT.053 brauchen **keine** Spaltenzuordnung: Beide benennen ihre
// Felder selbst. Der Assistent blendet den Schritt für sie aus, statt eine
// Auswahl anzubieten, bei der es nichts zu wählen gibt.
import { dedupeHash, type ParsedBooking } from "./bank-import";
import { parseCamt053 } from "./camt";
import { parseMt940, type Umsatzzeile } from "./mt940";
import type { BookingKind } from "@/generated/prisma/client";

export type BankDateiFormat = "csv" | "mt940" | "camt";

export const FORMAT_LABEL: Record<BankDateiFormat, string> = {
  csv: "CSV",
  mt940: "MT940 (SWIFT-Auszug)",
  camt: "CAMT.053 (ISO 20022)",
};

/**
 * Erkennt das Format am Inhalt, nicht an der Dateiendung: `.txt` trägt
 * genauso oft einen MT940-Auszug wie `.sta`, und ein als `.csv` gespeichertes
 * CAMT ist auch schon vorgekommen.
 */
export function erkenneFormat(inhalt: string): BankDateiFormat {
  const kopf = inhalt.slice(0, 8000);
  if (/<(?:[\w.-]+:)?(?:Document|BkToCstmrStmt|Stmt)\b/.test(kopf)) return "camt";
  // MT940: Auszugsnummer/Kontobezeichnung im Kopf, Umsätze in :61:.
  if (/(^|\n):(?:20|25|28C?):/.test(kopf) && /(^|\n):61:/.test(inhalt.slice(0, 40000))) {
    return "mt940";
  }
  return "csv";
}

/** MT940/CAMT-Zeilen in dieselben Buchungsvorschläge wie `mapRows`. */
export function zuBuchungen(zeilen: Umsatzzeile[], accountId: string): ParsedBooking[] {
  const buchungen: ParsedBooking[] = [];
  for (const z of zeilen) {
    if (z.amountCents === 0) continue;
    const reference = z.purpose.trim();
    const counterparty = z.counterparty?.trim() || undefined;
    const kind: BookingKind = z.amountCents < 0 ? "AUSGABE" : "EINNAHME";
    buchungen.push({
      bookingDate: z.bookingDate,
      amountCents: Math.abs(z.amountCents),
      kind,
      text: reference.slice(0, 200) || counterparty || "Bankumsatz",
      counterparty,
      reference,
      // Derselbe Hash wie beim CSV-Import: Wer denselben Zeitraum einmal als
      // CSV und einmal als MT940 einliest, bekommt keine Dubletten.
      dedupeHash: dedupeHash(accountId, z.bookingDate, z.amountCents, reference),
    });
  }
  return buchungen;
}

/** Liest eine Nicht-CSV-Datei vollständig ein. */
export function leseBankdatei(
  format: Exclude<BankDateiFormat, "csv">,
  inhalt: string,
  accountId: string,
): ParsedBooking[] {
  const zeilen = format === "mt940" ? parseMt940(inhalt) : parseCamt053(inhalt);
  return zuBuchungen(zeilen, accountId);
}
