"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AUDIT, logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { formatCents, parseEuroToCents } from "@/lib/money";
import { requireVerwalter } from "@/lib/session";
import { planErlaubt } from "@/lib/plan-guard";
import { DOCUMENT_TYPES, saveUpload } from "@/lib/storage";
import {
  decodeBankFile,
  detectMapping,
  mapRows,
  mappingComplete,
  parseCsv,
  type ColumnMapping,
  type ParsedBooking,
  type Zeichensatz,
} from "@/lib/weg/bank-import";
import { erkenneFormat, leseBankdatei, type BankDateiFormat } from "@/lib/weg/bank-datei";
import { baueImportProfil, leseImportProfil } from "@/lib/weg/import-profil";
import { bereinigeZweck, kiKostenartAktiv, klassifiziereKostenarten } from "@/lib/weg/kostenart-ki";
import { ladeZuordnungsKontext } from "@/lib/weg/zuordnung-kontext";
import { schlageVorschlagVor, type Guete } from "@/lib/weg/zuordnung-vorschlag";
import { pruefeZahlung } from "@/lib/weg/bauabzugsteuer-service";
import { NOT_REVERSED } from "@/lib/weg/booking-scope";
import { loadWegProperty } from "@/lib/weg/scope";
import { allDatesEditable } from "@/lib/weg/statement-lock";

// Bank-CSVs sind klein; CAMT.053 ist als XML deutlich gesprächiger — ein
// Jahresauszug mit 400 Umsätzen liegt dort schnell bei einem Megabyte.
const MAX_DATEI_GROESSE = 5 * 1024 * 1024;

function back(propertyId: string, param?: string): never {
  redirect(`/verwaltung/weg/${propertyId}/buchhaltung${param ? `?${param}` : ""}`);
}

// Konto laden + prüfen, dass es zum (erlaubten) Objekt gehört (IDOR-Schutz).
async function loadAccount(propertyId: string, accountId: string) {
  if (!accountId) return null;
  return db.ledgerAccount.findFirst({ where: { id: accountId, propertyId } });
}

// ── Manuelle Buchung ─────────────────────────────────────────────────────────

const bookingSchema = z.object({
  propertyId: z.string().min(1),
  accountId: z.string().min(1),
  kind: z.enum(["EINNAHME", "AUSGABE"]),
  bookingDate: z.string().min(1),
  amount: z.string().min(1),
  costTypeId: z.string().optional(),
  /** §35a: Lohn-/Fahrt-/Maschinenkostenanteil laut Rechnung. Leer = nicht erfasst. */
  laborShare: z.string().optional(),
  text: z.string().trim().min(2).max(500),
  counterparty: z.string().trim().max(200).optional(),
  reference: z.string().trim().max(500).optional(),
  /** Verknüpfter Handwerker — Grundlage der § 48-Prüfung. */
  craftsmanId: z.string().optional(),
  /** Der Nutzer hat die Bauabzugsteuer-Warnung gesehen und trotzdem gebucht. */
  bauabzugBestaetigt: z.string().optional(),
});

export async function createBooking(formData: FormData) {
  const verwalter = await requireVerwalter();
  // Plan-Sperre: Arbeitsfunktion — im Start-Umfang (einrichten + ansehen)
  // nicht enthalten; Umfang je Tarif siehe PLAN_FUNKTIONEN in lib/billing.ts.
  if (!(await planErlaubt("vollerUmfang"))) redirect("/verwaltung/weg?flash=nur-mit-tarif");
  const parsed = bookingSchema.safeParse({
    propertyId: formData.get("propertyId"),
    accountId: formData.get("accountId"),
    kind: formData.get("kind"),
    bookingDate: formData.get("bookingDate"),
    amount: formData.get("amount"),
    costTypeId: String(formData.get("costTypeId") ?? "") || undefined,
    laborShare: String(formData.get("laborShare") ?? "") || undefined,
    text: formData.get("text"),
    counterparty: String(formData.get("counterparty") ?? "") || undefined,
    reference: String(formData.get("reference") ?? "") || undefined,
    craftsmanId: String(formData.get("craftsmanId") ?? "") || undefined,
    bauabzugBestaetigt: String(formData.get("bauabzugBestaetigt") ?? "") || undefined,
  });
  if (!parsed.success) redirect("/verwaltung/weg");
  const property = await loadWegProperty(verwalter, parsed.data.propertyId);
  if (!property) redirect("/verwaltung/weg");

  const account = await loadAccount(property.id, parsed.data.accountId);
  if (!account) back(property.id, "fehler=konto");

  const amountCents = parseEuroToCents(parsed.data.amount);
  if (amountCents === null || amountCents === 0) back(property.id, "fehler=betrag");

  const bookingDate = new Date(parsed.data.bookingDate);
  if (isNaN(bookingDate.getTime())) back(property.id, "fehler=datum");

  // Kostenart muss (falls angegeben) zum Objekt gehören
  if (parsed.data.costTypeId) {
    const costType = await db.costType.findFirst({
      where: { id: parsed.data.costTypeId, propertyId: property.id },
      select: { id: true },
    });
    if (!costType) back(property.id, "fehler=kostenart");
  }

  // §35a-Lohnanteil: nur bei Ausgaben sinnvoll und nie größer als die Ausgabe
  // selbst. Ein Vertipper darf keinen Ausweis erzeugen, der über der Rechnung
  // liegt — das Finanzamt prüft genau diese Zahl.
  let laborShareCents: number | null = null;
  if (parsed.data.laborShare) {
    if (parsed.data.kind !== "AUSGABE") back(property.id, "fehler=lohnanteil");
    laborShareCents = parseEuroToCents(parsed.data.laborShare);
    if (laborShareCents === null || laborShareCents < 0 || laborShareCents > amountCents) {
      back(property.id, "fehler=lohnanteil");
    }
  }

  // Handwerker muss zur eigenen Organisation gehören (IDOR-Schutz).
  if (parsed.data.craftsmanId) {
    const handwerker = await db.craftsman.findFirst({
      where: { id: parsed.data.craftsmanId, organizationId: verwalter.organizationId },
      select: { id: true },
    });
    if (!handwerker) back(property.id, "fehler=handwerker");
  }

  // ── Bauabzugsteuer (§ 48 EStG) ─────────────────────────────────────────────
  //
  // Die Prüfung läuft **hier**, nicht nur im Browser: Das Häkchen in der
  // Sprechblase ist eine Bestätigung des Nutzers, keine Zusicherung — wer das
  // Formular ohne JavaScript abschickt, käme sonst an der Warnung vorbei.
  //
  // Gesperrt wird trotzdem nicht. Ob einbehalten wurde, weiß nur der Mensch
  // davor; vielleicht wurde bereits gekürzt überwiesen. Verlangt wird eine
  // bewusste Entscheidung, und die wird protokolliert.
  const bauabzug = await pruefeZahlung({
    organizationId: verwalter.organizationId,
    craftsmanId: parsed.data.craftsmanId ?? null,
    costTypeId: parsed.data.costTypeId ?? null,
    betragCents: amountCents,
    stichtag: bookingDate,
  });
  const einbehalten =
    bauabzug.pflicht &&
    parsed.data.kind === "AUSGABE" &&
    parsed.data.bauabzugBestaetigt === "einbehalten";
  const bauabzugEntschieden =
    parsed.data.bauabzugBestaetigt === "einbehalten" ||
    parsed.data.bauabzugBestaetigt === "ungekuerzt";
  if (bauabzug.pflicht && parsed.data.kind === "AUSGABE" && !bauabzugEntschieden) {
    back(property.id, "fehler=bauabzugsteuer");
  }

  // Optionaler Beleg (Foto/PDF)
  let beleg: { storedName: string; fileName: string; mimeType: string } | null = null;
  const file = formData.get("beleg");
  if (file instanceof File && file.size > 0) {
    try {
      beleg = await saveUpload(file, DOCUMENT_TYPES);
    } catch {
      back(property.id, "fehler=beleg");
    }
  }

  const created = await db.booking.create({
    data: {
      organizationId: verwalter.organizationId,
      propertyId: property.id,
      accountId: account.id,
      costTypeId: parsed.data.costTypeId ?? null,
      kind: parsed.data.kind,
      bookingDate,
      amountCents,
      laborShareCents,
      text: parsed.data.text,
      counterparty: parsed.data.counterparty ?? null,
      craftsmanId: parsed.data.craftsmanId ?? null,
      reference: parsed.data.reference ?? null,
      belegStoredName: beleg?.storedName ?? null,
      belegFileName: beleg?.fileName ?? null,
      belegMimeType: beleg?.mimeType ?? null,
      // `null` heißt „nicht einbehalten" — der Normalfall, und etwas anderes
      // als 0 Cent. Nur ein gesetzter Wert erzeugt eine Anmeldepflicht.
      bauabzugCents: einbehalten && bauabzug.pflicht ? bauabzug.einbehaltCents : null,
      createdById: verwalter.id,
    },
  });
  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_BOOKING_CREATED,
    targetType: "Booking",
    targetId: created.id,
    meta: {
      kind: parsed.data.kind,
      amountCents,
      account: account.name,
      // Wer trotz Einbehaltungspflicht ungekürzt bucht, hinterlässt eine Spur.
      // Bei einer späteren Haftungsfrage ist genau das die Frage: Wusste es
      // jemand, und wann?
      ...(bauabzug.pflicht
        ? {
            bauabzugsteuerBestaetigt: true,
            einbehaltCents: bauabzug.einbehaltCents,
            // Der Unterschied, auf den es bei einer Haftungsfrage ankommt.
            bauabzugsteuerEinbehalten: einbehalten,
          }
        : {}),
    },
  });
  revalidatePath(`/verwaltung/weg/${property.id}/buchhaltung`);
  back(property.id, "gespeichert=buchung");
}

// ── Umbuchung Giro ↔ Rücklage ────────────────────────────────────────────────

const transferSchema = z.object({
  propertyId: z.string().min(1),
  fromAccountId: z.string().min(1),
  toAccountId: z.string().min(1),
  bookingDate: z.string().min(1),
  amount: z.string().min(1),
  text: z.string().trim().min(2).max(500),
});

export async function createTransfer(formData: FormData) {
  const verwalter = await requireVerwalter();
  if (!(await planErlaubt("vollerUmfang"))) redirect("/verwaltung/weg?flash=nur-mit-tarif");
  const parsed = transferSchema.safeParse({
    propertyId: formData.get("propertyId"),
    fromAccountId: formData.get("fromAccountId"),
    toAccountId: formData.get("toAccountId"),
    bookingDate: formData.get("bookingDate"),
    amount: formData.get("amount"),
    text: formData.get("text"),
  });
  if (!parsed.success) redirect("/verwaltung/weg");
  const property = await loadWegProperty(verwalter, parsed.data.propertyId);
  if (!property) redirect("/verwaltung/weg");

  if (parsed.data.fromAccountId === parsed.data.toAccountId) back(property.id, "fehler=gleicheskonto");
  const [from, to] = await Promise.all([
    loadAccount(property.id, parsed.data.fromAccountId),
    loadAccount(property.id, parsed.data.toAccountId),
  ]);
  if (!from || !to) back(property.id, "fehler=konto");

  const amountCents = parseEuroToCents(parsed.data.amount);
  if (amountCents === null || amountCents === 0) back(property.id, "fehler=betrag");
  const bookingDate = new Date(parsed.data.bookingDate);
  if (isNaN(bookingDate.getTime())) back(property.id, "fehler=datum");

  // Zwei Gegenbuchungen mit gemeinsamer Gruppe — atomar.
  const transferGroupId = crypto.randomUUID();
  const common = {
    organizationId: verwalter.organizationId,
    propertyId: property.id,
    kind: "UMBUCHUNG" as const,
    bookingDate,
    amountCents,
    text: parsed.data.text,
    transferGroupId,
    createdById: verwalter.id,
  };
  await db.$transaction([
    db.booking.create({ data: { ...common, accountId: from.id, transferOut: true } }),
    db.booking.create({ data: { ...common, accountId: to.id, transferOut: false } }),
  ]);
  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_TRANSFER_CREATED,
    targetType: "Booking",
    targetId: transferGroupId,
    meta: { amountCents, from: from.name, to: to.name },
  });
  revalidatePath(`/verwaltung/weg/${property.id}/buchhaltung`);
  back(property.id, "gespeichert=umbuchung");
}

// ── Dateiimport (Zero-Key-Adapter) ───────────────────────────────────────────
// Drei Formate, ein Weg: CSV (mit Spaltenzuordnung), MT940 und CAMT.053 (beide
// benennen ihre Felder selbst). Alle drei münden in dieselben ParsedBooking-
// Objekte — Duplikaterkennung, Vorschau, Zuordnungsvorschläge und Import hängen
// damit an einer Stelle.
// Schritt 1 (analyzeCsvAction): Datei parsen, Mapping raten/übernehmen, Vorschau
// mit Duplikat-Markierung liefern. Der Dateiinhalt wandert als Base64 in die
// Antwort und kommt in Schritt 2 als Hidden-Field zurück — nichts wird
// zwischengespeichert (Zero-Key, kein Aufräum-Job).
// Schritt 2 (importCsvAction): endgültiger Import als BankImportBatch.

export type ImportVorschlag = {
  /** Was vorgeschlagen wird — Einheit (Einnahme) oder Kostenart (Ausgabe). */
  label: string;
  art: "einheit" | "kostenart";
  guete: Guete;
  grund: string;
  /**
   * Aus der KI-Stufe. Muss gekennzeichnet werden (Art. 50 KI-VO) — und reist
   * als einziger Vorschlag über das Formular zurück, weil er sich nicht
   * wiederholbar nachrechnen lässt.
   */
  ki?: true;
  costTypeId?: string;
};

export type ImportPreviewRow = {
  /** Duplikat-Hash der Zeile — verbindet Vorschau und Import ohne Zeilennummern. */
  hash: string;
  date: string;
  kind: "EINNAHME" | "AUSGABE";
  amountCents: number;
  amountLabel: string;
  text: string;
  counterparty?: string;
  duplicate: boolean;
  vorschlag?: ImportVorschlag;
};

/**
 * Was beim Lesen der Datei erkannt wurde. Wandert **immer** in die Oberfläche,
 * nicht nur im Fehlerfall: Ohne diese Angaben ist der Unterschied zwischen
 * „falsche Zeile als Kopfzeile" und „Zeichensatz kaputt" von außen nicht zu
 * sehen, und der Verwalter kann nur „geht nicht" melden.
 */
export type ImportDiagnose = {
  /** CSV, MT940 oder CAMT.053 — am Inhalt erkannt, nicht an der Endung. */
  format: BankDateiFormat;
  encoding: Zeichensatz;
  delimiter: string;
  hasHeader: boolean;
  skippedBefore: number;
  rawLines: string[];
};

export type ImportAnalysis =
  | {
      ok: true;
      accountId: string;
      fileName: string;
      contentBase64: string;
      diagnose: ImportDiagnose;
      /**
       * Woher das gezeigte Mapping stammt. `format` heißt: Die Datei benennt
       * ihre Felder selbst (MT940, CAMT) — es gibt nichts zuzuordnen.
       */
      mappingQuelle: "gespeichert" | "erkannt" | "manuell" | "format";
      header: string[];
      mapping: Partial<ColumnMapping>;
      rowsTotal: number;
      parseable: number;
      duplicates: number;
      preview: ImportPreviewRow[];
      /** Anzahl Vorschläge je Gütegrad — Grundlage der Bestätigungs-Häkchen. */
      vorschlaege: Record<Guete, number>;
    }
  | { ok: false; error: string; diagnose?: ImportDiagnose };

/**
 * Das von Hand gesetzte Mapping aus dem Formular.
 *
 * `gesetzt` unterscheidet „das Formular trug keine Spaltenfelder" von „der
 * Verwalter hat eine Spalte auf ‚keine' gestellt". Ohne diese Unterscheidung
 * ließe sich eine einmal erkannte Spalte nicht mehr abwählen: Der leere Wert
 * käme als `undefined` an und der alte Vorschlag stünde wieder da.
 */
function readMappingOverride(formData: FormData): { mapping: Partial<ColumnMapping>; gesetzt: boolean } {
  const num = (name: string) => {
    const v = String(formData.get(name) ?? "").trim();
    if (v === "") return undefined;
    const n = Number(v);
    return Number.isInteger(n) && n >= 0 ? n : undefined;
  };
  const roh: Record<string, number | undefined> = {
    date: num("col_date"),
    amount: num("col_amount"),
    debit: num("col_debit"),
    credit: num("col_credit"),
    purpose: num("col_purpose"),
    counterparty: num("col_counterparty"),
  };
  return {
    mapping: Object.fromEntries(Object.entries(roh).filter(([, v]) => v !== undefined)),
    gesetzt: formData.has("col_date"),
  };
}

/** Der Zeichensatz reist zwischen den Schritten mit — nur zur Anzeige. */
function readEncoding(formData: FormData): Zeichensatz {
  const roh = String(formData.get("encoding") ?? "");
  const bekannt: Zeichensatz[] = ["utf-8", "utf-8-bom", "utf-16le", "utf-16be", "windows-1252"];
  return bekannt.includes(roh as Zeichensatz) ? (roh as Zeichensatz) : "utf-8";
}

async function analyzeInternal(
  propertyId: string,
  account: { id: string; importProfile: unknown },
  fileName: string,
  content: string,
  encoding: Zeichensatz,
  override: { mapping: Partial<ColumnMapping>; gesetzt: boolean },
): Promise<ImportAnalysis> {
  const format = erkenneFormat(content);
  const leer: Record<Guete, number> = { sicher: 0, wahrscheinlich: 0, unsicher: 0 };

  // MT940 und CAMT.053 benennen ihre Felder selbst — es gibt keine Spalten, die
  // man zuordnen könnte, und damit auch nichts zu raten oder zu merken.
  if (format !== "csv") {
    const diagnose: ImportDiagnose = {
      encoding,
      format,
      delimiter: "",
      hasHeader: false,
      skippedBefore: 0,
      rawLines: content.split(/\r?\n/).filter((l) => l.trim() !== "").slice(0, 3),
    };
    const buchungen = leseBankdatei(format, content, account.id);
    if (buchungen.length === 0) {
      return { ok: false, error: "Die Datei enthält keine auswertbaren Umsätze.", diagnose };
    }
    return vorschau({
      propertyId,
      accountId: account.id,
      fileName,
      content,
      diagnose,
      mappingQuelle: "format",
      header: [],
      mapping: {},
      rowsTotal: buchungen.length,
      buchungen,
    });
  }

  const parsed = parseCsv(content);
  const diagnose: ImportDiagnose = {
    encoding,
    format,
    delimiter: parsed.delimiter,
    hasHeader: parsed.hasHeader,
    skippedBefore: parsed.skippedBefore,
    rawLines: parsed.rawLines,
  };
  if (parsed.header.length === 0 || parsed.rows.length === 0) {
    return { ok: false, error: "Die Datei enthält keine auswertbaren Zeilen.", diagnose };
  }

  // Rangfolge: Was der Verwalter von Hand gesetzt hat, dann die gemerkte Lesart
  // dieses Kontos, dann die Erkennung. Ein gespeichertes Profil darf die
  // Erkennung überstimmen — es ist die einzige Angabe, die ein Mensch bestätigt
  // hat.
  const profil = leseImportProfil(account.importProfile);
  const erkannt = detectMapping(parsed);
  const passtNochAufDieDatei =
    profil !== null &&
    Object.values(profil.mapping).every((idx) => typeof idx === "number" && idx < parsed.header.length);
  const basis = passtNochAufDieDatei ? profil.mapping : erkannt;
  const mapping: Partial<ColumnMapping> = override.gesetzt ? override.mapping : basis;
  const mappingQuelle = (
    override.gesetzt ? "manuell" : passtNochAufDieDatei ? "gespeichert" : "erkannt"
  ) as "manuell" | "gespeichert" | "erkannt";

  const leerVorschlaege: Record<Guete, number> = { ...leer };
  if (!mappingComplete(mapping)) {
    return {
      ok: true,
      accountId: account.id,
      fileName,
      contentBase64: Buffer.from(content, "utf-8").toString("base64"),
      diagnose,
      mappingQuelle,
      header: parsed.header,
      mapping,
      rowsTotal: parsed.rows.length,
      parseable: 0,
      duplicates: 0,
      preview: [],
      vorschlaege: leerVorschlaege,
    };
  }

  return vorschau({
    propertyId,
    accountId: account.id,
    fileName,
    content,
    diagnose,
    mappingQuelle,
    header: parsed.header,
    mapping,
    rowsTotal: parsed.rows.length,
    buchungen: mapRows(parsed.rows, mapping, account.id),
  });
}

/**
 * Der gemeinsame Teil aller Formate: Duplikate suchen, Zuordnungen vorschlagen,
 * Vorschau bauen. Ab hier weiß niemand mehr, ob die Zeilen aus einer CSV, einem
 * MT940-Auszug oder einer CAMT-Datei stammen — genau wie es ein späterer
 * Open-Banking-Adapter vorfinden wird.
 */
async function vorschau(eingabe: {
  propertyId: string;
  accountId: string;
  fileName: string;
  content: string;
  diagnose: ImportDiagnose;
  mappingQuelle: "manuell" | "gespeichert" | "erkannt" | "format";
  header: string[];
  mapping: Partial<ColumnMapping>;
  rowsTotal: number;
  buchungen: ParsedBooking[];
}): Promise<ImportAnalysis> {
  const { accountId, buchungen } = eingabe;
  const [existing, kontext] = await Promise.all([
    db.booking.findMany({
      where: { accountId, dedupeHash: { in: buchungen.map((r) => r.dedupeHash) } },
      select: { dedupeHash: true },
    }),
    ladeZuordnungsKontext(eingabe.propertyId),
  ]);
  const known = new Set(existing.map((e) => e.dedupeHash));
  const seen = new Set<string>();
  let duplicates = 0;
  const vorschlaege: Record<Guete, number> = { sicher: 0, wahrscheinlich: 0, unsicher: 0 };
  const preview: ImportPreviewRow[] = buchungen.map((r) => {
    const duplicate = known.has(r.dedupeHash) || seen.has(r.dedupeHash);
    seen.add(r.dedupeHash);
    if (duplicate) duplicates++;
    const roh = duplicate ? null : schlageVorschlagVor(r, kontext);
    if (roh) vorschlaege[roh.guete]++;
    return {
      hash: r.dedupeHash,
      date: r.bookingDate.toISOString().slice(0, 10),
      kind: r.kind as "EINNAHME" | "AUSGABE",
      amountCents: r.amountCents,
      amountLabel: formatCents(r.amountCents),
      text: r.text,
      counterparty: r.counterparty,
      duplicate,
      vorschlag: roh
        ? {
            label: roh.unitLabel ?? roh.costTypeName ?? "",
            art: (roh.unitId ? "einheit" : "kostenart") as "einheit" | "kostenart",
            guete: roh.guete,
            grund: roh.gruende.join(", "),
            costTypeId: roh.costTypeId,
          }
        : undefined,
    };
  });

  await ergaenzeKiVorschlaege(eingabe.propertyId, preview, vorschlaege);
  return {
    ok: true,
    accountId,
    fileName: eingabe.fileName,
    // Der bereits dekodierte Text reist als UTF-8 weiter. Würde hier der
    // Rohinhalt zurückgereicht, käme im zweiten Schritt wieder die feste
    // UTF-8-Annahme zum Zug — und die Korrektur wäre weg.
    contentBase64: Buffer.from(eingabe.content, "utf-8").toString("base64"),
    diagnose: eingabe.diagnose,
    mappingQuelle: eingabe.mappingQuelle,
    header: eingabe.header,
    mapping: eingabe.mapping,
    rowsTotal: eingabe.rowsTotal,
    parseable: buchungen.length,
    duplicates,
    preview,
    vorschlaege,
  };
}

/**
 * Zweite Stufe: Was die Regeln nicht kennen, geht — wenn freigegeben — an die
 * KI. Ergänzt die Vorschau an Ort und Stelle.
 *
 * Nur Ausgaben ohne Regel-Treffer, nur der bereinigte Verwendungszweck, immer
 * Gütegrad „unsicher": Ein Vorschlag, der sich nicht nachrechnen lässt, ist
 * kein sicherer Vorschlag, egal wie überzeugt das Modell klingt.
 */
async function ergaenzeKiVorschlaege(
  propertyId: string,
  preview: ImportPreviewRow[],
  zaehler: Record<Guete, number>,
): Promise<void> {
  if (!kiKostenartAktiv()) return;
  const offene = preview.filter((r) => !r.vorschlag && !r.duplicate && r.kind === "AUSGABE");
  if (offene.length === 0) return;
  const kostenarten = await db.costType.findMany({
    where: { propertyId },
    select: { id: true, name: true },
  });
  if (kostenarten.length === 0) return;
  const treffer = await klassifiziereKostenarten(
    offene.map((r) => r.text),
    kostenarten,
  );
  if (treffer.size === 0) return;
  const nachId = new Map(kostenarten.map((k) => [k.id, k.name]));
  for (const zeile of offene) {
    const costTypeId = treffer.get(bereinigeZweck(zeile.text));
    if (!costTypeId) continue;
    zeile.vorschlag = {
      label: nachId.get(costTypeId) ?? "",
      art: "kostenart",
      guete: "unsicher",
      grund: "KI-Vorschlag aus dem Verwendungszweck",
      ki: true,
      costTypeId,
    };
    zaehler.unsicher++;
  }
}

export async function analyzeCsvAction(
  _prev: ImportAnalysis | null,
  formData: FormData,
): Promise<ImportAnalysis> {
  const verwalter = await requireVerwalter();
  const propertyId = String(formData.get("propertyId") ?? "");
  const accountId = String(formData.get("accountId") ?? "");
  const property = await loadWegProperty(verwalter, propertyId);
  if (!property) return { ok: false, error: "Kein Zugriff auf dieses Objekt." };
  const account = await loadAccount(property.id, accountId);
  if (!account) return { ok: false, error: "Bitte ein Konto auswählen." };

  // Datei aus Schritt 1 ODER Base64 aus einer erneuten Analyse (Mapping geändert)
  let fileName = "";
  let content = "";
  let encoding: Zeichensatz;
  const file = formData.get("csv");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_DATEI_GROESSE) return { ok: false, error: "Die Datei ist größer als 5 MB." };
    fileName = file.name;
    // Genau **einmal** dekodieren, hier. Bank-Exporte sind oft Windows-1252,
    // manche Excel-Umwege liefern UTF-16 — eine feste UTF-8-Annahme zerlegt die
    // Umlaute in Zahlungspartner und Verwendungszweck.
    const dekodiert = decodeBankFile(new Uint8Array(await file.arrayBuffer()));
    content = dekodiert.text;
    encoding = dekodiert.encoding;
  } else {
    const b64 = String(formData.get("contentBase64") ?? "");
    fileName = String(formData.get("fileName") ?? "import.csv");
    if (!b64) return { ok: false, error: "Bitte eine Datei auswählen." };
    if (b64.length > MAX_DATEI_GROESSE * 1.4) return { ok: false, error: "Die Datei ist größer als 5 MB." };
    content = Buffer.from(b64, "base64").toString("utf-8");
    encoding = readEncoding(formData);
  }
  return analyzeInternal(
    property.id,
    account,
    fileName,
    content,
    encoding,
    readMappingOverride(formData),
  );
}

export async function importCsvAction(formData: FormData) {
  const verwalter = await requireVerwalter();
  if (!(await planErlaubt("vollerUmfang"))) redirect("/verwaltung/weg?flash=nur-mit-tarif");
  const propertyId = String(formData.get("propertyId") ?? "");
  const accountId = String(formData.get("accountId") ?? "");
  const property = await loadWegProperty(verwalter, propertyId);
  if (!property) redirect("/verwaltung/weg");
  const account = await loadAccount(property.id, accountId);
  if (!account) back(property.id, "fehler=konto");

  const b64 = String(formData.get("contentBase64") ?? "");
  const fileName = String(formData.get("fileName") ?? "import.csv").slice(0, 200);
  if (!b64 || b64.length > MAX_DATEI_GROESSE * 1.4) back(property.id, "fehler=datei");
  const content = Buffer.from(b64, "base64").toString("utf-8");

  // Dasselbe Format wie in der Vorschau — erkannt am Inhalt, nicht am
  // Formular. Bei MT940 und CAMT gibt es kein Spalten-Mapping zu prüfen.
  const format = erkenneFormat(content);
  const { mapping } = readMappingOverride(formData);
  let parsedRows: ParsedBooking[];
  let gelesen: number;
  let csvAufbau: { delimiter: string; hasHeader: boolean } | null = null;
  if (format === "csv") {
    if (!mappingComplete(mapping)) back(property.id, "fehler=mapping");
    const parsed = parseCsv(content);
    csvAufbau = { delimiter: parsed.delimiter, hasHeader: parsed.hasHeader };
    gelesen = parsed.rows.length;
    parsedRows = mapRows(parsed.rows, mapping, account.id);
  } else {
    parsedRows = leseBankdatei(format, content, account.id);
    gelesen = parsedRows.length;
  }
  if (parsedRows.length === 0) back(property.id, "fehler=keinezeilen");

  // Duplikate (Bestand + innerhalb der Datei) überspringen und zählen
  const existing = await db.booking.findMany({
    where: { accountId: account.id, dedupeHash: { in: parsedRows.map((r) => r.dedupeHash) } },
    select: { dedupeHash: true },
  });
  const known = new Set(existing.map((e) => e.dedupeHash));
  const toImport: typeof parsedRows = [];
  for (const r of parsedRows) {
    if (known.has(r.dedupeHash)) continue;
    known.add(r.dedupeHash); // dedupliziert auch innerhalb der Datei
    toImport.push(r);
  }

  // ── Zuordnungsvorschläge ───────────────────────────────────────────────────
  //
  // Übernommen wird nur, was der Verwalter in der Vorschau bestätigt hat — je
  // Gütegrad ein Häkchen. Die Vorschläge werden hier **neu berechnet** statt
  // aus dem Formular gelesen: Eine mitgeschickte Kostenart oder Einheit wäre
  // eine Angabe aus dem Browser, und die gehört nicht ungeprüft in eine
  // Buchung. Bestätigt wird der Gütegrad, gerechnet wird auf dem Server.
  //
  // Gesetzt wird ausschließlich `unitId` bzw. `costTypeId` — also dieselbe
  // Angabe, die auch die Zuordnungs-Hilfe auf der Hausgeld-Seite schreibt.
  // Keine Anrechnung auf offene Forderungen: Wohin eine Zahlung tilgt,
  // entscheidet der Verwalter (§ 366 BGB), nicht der Import.
  const bestaetigt = new Set(
    formData
      .getAll("uebernehmen")
      .map((v) => String(v))
      .filter((v): v is Guete => v === "sicher" || v === "wahrscheinlich" || v === "unsicher"),
  );
  const zuordnung = new Map<string, { unitId?: string; costTypeId?: string }>();
  if (bestaetigt.size > 0) {
    const kontext = await ladeZuordnungsKontext(property.id);
    for (const r of toImport) {
      const v = schlageVorschlagVor(r, kontext);
      if (!v || !bestaetigt.has(v.guete)) continue;
      zuordnung.set(r.dedupeHash, { unitId: v.unitId, costTypeId: v.costTypeId });
    }
    // KI-Vorschläge sind die einzige Ausnahme von „auf dem Server nachrechnen":
    // Dieselbe Anfrage kann eine andere Antwort geben, und dann stünde in der
    // Buchung etwas anderes als in der Vorschau. Sie reisen deshalb aus der
    // Vorschau zurück — geprüft wird trotzdem: Die Kostenart muss zu **diesem**
    // Objekt gehören, und übernommen wird nur mit bestätigtem „unsicher".
    if (bestaetigt.has("unsicher")) {
      const paare = formData
        .getAll("ki")
        .map((v) => String(v).split("|"))
        .filter((t) => t.length === 2);
      if (paare.length > 0) {
        const erlaubt = new Set(
          (
            await db.costType.findMany({
              where: { propertyId: property.id, id: { in: paare.map((t) => t[1]) } },
              select: { id: true },
            })
          ).map((k) => k.id),
        );
        for (const [hash, costTypeId] of paare) {
          if (!erlaubt.has(costTypeId) || zuordnung.has(hash)) continue;
          zuordnung.set(hash, { costTypeId });
        }
      }
    }
  }

  const batch = await db.$transaction(async (tx) => {
    const created = await tx.bankImportBatch.create({
      data: {
        organizationId: verwalter.organizationId,
        propertyId: property.id,
        accountId: account.id,
        fileName,
        source: "CSV",
        rowsTotal: gelesen,
        rowsImported: toImport.length,
        rowsSkipped: gelesen - toImport.length,
        createdById: verwalter.id,
      },
    });
    if (toImport.length > 0) {
      await tx.booking.createMany({
        data: toImport.map((r) => ({
          organizationId: verwalter.organizationId,
          propertyId: property.id,
          accountId: account.id,
          kind: r.kind,
          bookingDate: r.bookingDate,
          amountCents: r.amountCents,
          text: r.text,
          counterparty: r.counterparty ?? null,
          reference: r.reference || null,
          dedupeHash: r.dedupeHash,
          importBatchId: created.id,
          unitId: zuordnung.get(r.dedupeHash)?.unitId ?? null,
          costTypeId: zuordnung.get(r.dedupeHash)?.costTypeId ?? null,
          createdById: verwalter.id,
        })),
        skipDuplicates: true, // DB-Unique (accountId, dedupeHash) als letzte Wand
      });
    }
    // Die bestätigte Lesart der Datei am Konto merken — beim nächsten Import
    // derselben Bank ist sie vorbelegt. Nur für CSV: MT940 und CAMT benennen
    // ihre Felder selbst, und ein hier gespeichertes Spalten-Mapping würde beim
    // nächsten CSV-Import eine Zuordnung vortäuschen, die nie bestätigt wurde.
    if (csvAufbau) {
      await tx.ledgerAccount.update({
        where: { id: account.id },
        data: {
          importProfile: baueImportProfil(mapping, {
            encoding: readEncoding(formData),
            delimiter: csvAufbau.delimiter,
            hasHeader: csvAufbau.hasHeader,
          }),
        },
      });
    }
    return created;
  });

  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_BANK_IMPORT,
    targetType: "BankImportBatch",
    targetId: batch.id,
    meta: {
      fileName,
      imported: toImport.length,
      skipped: gelesen - toImport.length,
      // Wie viele Buchungen mit einem bestätigten Vorschlag hereinkamen — bei
      // einer späteren Rückfrage ist genau das die Frage.
      zugeordnet: zuordnung.size,
      guetegrade: [...bestaetigt].sort(),
    },
  });
  revalidatePath(`/verwaltung/weg/${property.id}/buchhaltung`);
  back(property.id, `import=${toImport.length}&uebersprungen=${gelesen - toImport.length}`);
}

// ── Kostenart nachträglich zuordnen ──────────────────────────────────────────
// Importierte Bankumsätze kommen ohne Kostenart herein. Ohne diese Zuordnung
// bleiben sie in der Jahresabrechnung als „Ausgaben ohne Kostenart" liegen,
// lassen sich nicht umlegen und blockieren das Fertigstellen dauerhaft.
// Zugelassen ist die Zuordnung für Einnahmen und Ausgaben; Umbuchungen sind
// kein Aufwand und bekommen deshalb keine Kostenart.

export async function assignCostType(formData: FormData) {
  const verwalter = await requireVerwalter();
  const propertyId = String(formData.get("propertyId") ?? "");
  const costTypeId = String(formData.get("costTypeId") ?? "");
  // Handwerker mitzuordnen ist der einzige Weg, importierte Buchungen für die
  // Prüfung nach § 48 EStG greifbar zu machen: Der Bankimport liefert nur
  // Verwendungszweck-Text, und über Text lässt sich nicht summieren.
  const craftsmanId = String(formData.get("craftsmanId") ?? "");
  const bookingIds = formData
    .getAll("bookingId")
    .map((v) => String(v))
    .filter(Boolean);

  const property = await loadWegProperty(verwalter, propertyId);
  if (!property) redirect("/verwaltung/weg");
  if (bookingIds.length === 0) back(property.id, "fehler=keineauswahl");

  // Kostenart muss zum Objekt gehören; leer = Zuordnung aufheben.
  if (costTypeId) {
    const costType = await db.costType.findFirst({
      where: { id: costTypeId, propertyId: property.id },
      select: { id: true },
    });
    if (!costType) back(property.id, "fehler=kostenart");
  }

  // „—" lässt den Handwerker unverändert; „ohne" hebt die Zuordnung auf. Ohne
  // diese Unterscheidung löschte jedes Setzen einer Kostenart die mühsam
  // gepflegte Handwerker-Zuordnung gleich mit.
  if (craftsmanId && craftsmanId !== "OHNE") {
    const handwerker = await db.craftsman.findFirst({
      where: { id: craftsmanId, organizationId: verwalter.organizationId },
      select: { id: true },
    });
    if (!handwerker) back(property.id, "fehler=handwerker");
  }

  // Nur Buchungen dieses Objekts — und nur solche, die eine Kostenart tragen
  // dürfen und nicht Teil eines Stornopaars sind.
  const bookings = await db.booking.findMany({
    where: {
      id: { in: bookingIds },
      propertyId: property.id,
      kind: { in: ["EINNAHME", "AUSGABE"] },
      ...NOT_REVERSED,
    },
    select: { id: true, bookingDate: true },
  });
  if (bookings.length === 0) back(property.id, "fehler=buchung");

  if (!(await allDatesEditable(property, bookings.map((b) => b.bookingDate)))) {
    back(property.id, "fehler=abgeschlossen");
  }

  await db.booking.updateMany({
    where: { id: { in: bookings.map((b) => b.id) } },
    data: {
      costTypeId: costTypeId || null,
      ...(craftsmanId ? { craftsmanId: craftsmanId === "OHNE" ? null : craftsmanId } : {}),
    },
  });
  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_BOOKING_COSTTYPE_ASSIGNED,
    targetType: "Booking",
    targetId: bookings.length === 1 ? bookings[0].id : property.id,
    meta: { count: bookings.length, costTypeId: costTypeId || null, craftsmanId: craftsmanId || null },
  });

  // Nachträgliche Prüfung nach § 48 EStG.
  //
  // **Hier wird nicht gewarnt, sondern informiert** — und der Unterschied ist
  // kein sprachlicher: Diese Buchungen stammen aus dem Bankauszug, das Geld ist
  // längst überwiesen. Einbehalten lässt sich nichts mehr. Was bleibt, ist die
  // Anmeldung beim Finanzamt und die Bescheinigung für das nächste Mal. Ein
  // Formular zu blockieren, dessen Zahlung schon raus ist, hülfe niemandem.
  let hinweis = "";
  if (craftsmanId && craftsmanId !== "OHNE" && costTypeId) {
    const kostenart = await db.costType.findUnique({
      where: { id: costTypeId },
      select: { constructionWork: true },
    });
    if (kostenart?.constructionWork) {
      const pruefung = await pruefeZahlung({
        organizationId: verwalter.organizationId,
        craftsmanId,
        costTypeId,
        betragCents: 0, // schon gebucht — geprüft wird der erreichte Jahresstand
        stichtag: new Date(),
      });
      if (pruefung.pflicht) hinweis = "&fehler=bauabzugnachtraeglich";
    }
  }
  revalidatePath(`/verwaltung/weg/${property.id}/buchhaltung`);
  back(property.id, `zugeordnet=${bookings.length}${hinweis}`);
}

// ── §35a-Lohnanteil nachtragen ───────────────────────────────────────────────
// Beim Bankimport gibt es keinen Lohnanteil — die Bank kennt nur den
// Gesamtbetrag. Er steht auf der Rechnung, und die liegt oft erst später vor.
// Ohne diese Nachtragsmöglichkeit bliebe jede importierte Handwerkerrechnung
// dauerhaft ohne §35a-Ausweis. Gleiche Sperre wie bei der Kostenart:
// abgeschlossene Jahre und Stornopaare bleiben unverändert.

export async function setLaborShare(formData: FormData) {
  const verwalter = await requireVerwalter();
  const propertyId = String(formData.get("propertyId") ?? "");
  const bookingId = String(formData.get("bookingId") ?? "");
  const eingabe = String(formData.get("laborShare") ?? "").trim();

  const property = await loadWegProperty(verwalter, propertyId);
  if (!property) redirect("/verwaltung/weg");

  const booking = await db.booking.findFirst({
    where: { id: bookingId, propertyId: property.id, kind: "AUSGABE", ...NOT_REVERSED },
    select: { id: true, amountCents: true, bookingDate: true },
  });
  if (!booking) back(property.id, "fehler=buchung");

  if (!(await allDatesEditable(property, [booking.bookingDate]))) {
    back(property.id, "fehler=abgeschlossen");
  }

  // Leer = wieder auf „nicht erfasst" zurücksetzen. Das ist etwas anderes als
  // „null Euro Lohnanteil" und muss deshalb möglich bleiben.
  let laborShareCents: number | null = null;
  if (eingabe !== "") {
    laborShareCents = parseEuroToCents(eingabe);
    if (laborShareCents === null || laborShareCents < 0 || laborShareCents > booking.amountCents) {
      back(property.id, "fehler=lohnanteil");
    }
  }

  await db.booking.update({ where: { id: booking.id }, data: { laborShareCents } });
  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_BOOKING_LABOR_SHARE_SET,
    targetType: "Booking",
    targetId: booking.id,
    meta: { laborShareCents },
  });
  revalidatePath(`/verwaltung/weg/${property.id}/buchhaltung`);
  back(property.id, "gespeichert=lohnanteil");
}

// ── Storno ───────────────────────────────────────────────────────────────────
// Buchungen werden nie geändert oder gelöscht. Eine falsche Buchung wird durch
// eine Gegenbuchung neutralisiert: gleicher Betrag, gleiches Konto, gleicher
// Buchungstag, umgekehrte Richtung. Beide bleiben im Journal sichtbar.

export async function reverseBooking(formData: FormData) {
  const verwalter = await requireVerwalter();
  const propertyId = String(formData.get("propertyId") ?? "");
  const bookingId = String(formData.get("bookingId") ?? "");
  const property = await loadWegProperty(verwalter, propertyId);
  if (!property) redirect("/verwaltung/weg");

  const booking = await db.booking.findFirst({
    where: { id: bookingId, propertyId: property.id },
    include: { reversedBy: { select: { id: true } } },
  });
  if (!booking) back(property.id, "fehler=buchung");
  // Ein Storno storniert man nicht; und zweimal geht es auch nicht.
  if (booking.reversalOfId || booking.reversedBy) back(property.id, "fehler=schonstorniert");

  if (!(await allDatesEditable(property, [booking.bookingDate]))) {
    back(property.id, "fehler=abgeschlossen");
  }

  // Bei einer Umbuchung hängen zwei Gegenbuchungen zusammen — beide Seiten
  // müssen storniert werden, sonst steht ein halber Übertrag im Buch.
  const originals = booking.transferGroupId
    ? await db.booking.findMany({
        where: {
          propertyId: property.id,
          transferGroupId: booking.transferGroupId,
          ...NOT_REVERSED,
        },
      })
    : [booking];

  const reverseKind = (kind: string) =>
    kind === "EINNAHME" ? "AUSGABE" : kind === "AUSGABE" ? "EINNAHME" : "UMBUCHUNG";

  await db.$transaction(
    originals.map((o) =>
      db.booking.create({
        data: {
          organizationId: verwalter.organizationId,
          propertyId: property.id,
          accountId: o.accountId,
          costTypeId: o.costTypeId,
          kind: reverseKind(o.kind) as typeof o.kind,
          bookingDate: o.bookingDate,
          valueDate: o.valueDate,
          amountCents: o.amountCents,
          text: `Storno: ${o.text}`.slice(0, 500),
          counterparty: o.counterparty,
          reference: o.reference,
          // Richtung der Umbuchung umkehren; dedupeHash bleibt leer, damit ein
          // späterer Import derselben Zeile nicht am Storno hängen bleibt.
          transferGroupId: o.transferGroupId,
          transferOut: o.transferOut === null ? null : !o.transferOut,
          reversalOfId: o.id,
          createdById: verwalter.id,
        },
      }),
    ),
  );
  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_BOOKING_REVERSED,
    targetType: "Booking",
    targetId: booking.id,
    meta: {
      amountCents: booking.amountCents,
      kind: booking.kind,
      text: booking.text,
      teile: originals.length,
    },
  });
  revalidatePath(`/verwaltung/weg/${property.id}/buchhaltung`);
  back(property.id, "storniert=1");
}

// ── Import zurücknehmen ──────────────────────────────────────────────────────
// Eng begrenzte Ausnahme vom Storno-Prinzip: Bei einem falsch zugeordneten
// Import (z. B. vertauschte Spalten) wären hunderte Stornozeilen im Journal
// unlesbar. Der Import wird deshalb als Ganzes entfernt — aber nur, solange er
// noch nirgends verwertet wurde.

export async function undoImportBatch(formData: FormData) {
  const verwalter = await requireVerwalter();
  const propertyId = String(formData.get("propertyId") ?? "");
  const batchId = String(formData.get("batchId") ?? "");
  const property = await loadWegProperty(verwalter, propertyId);
  if (!property) redirect("/verwaltung/weg");

  const batch = await db.bankImportBatch.findFirst({
    where: { id: batchId, propertyId: property.id, organizationId: verwalter.organizationId },
    include: { bookings: { select: { id: true, bookingDate: true, reversalOfId: true } } },
  });
  if (!batch) back(property.id, "fehler=import");

  // 1) Kein Buchungstag darf in ein abgeschlossenes Wirtschaftsjahr fallen.
  if (!(await allDatesEditable(property, batch.bookings.map((b) => b.bookingDate)))) {
    back(property.id, "fehler=abgeschlossen");
  }
  // 2) Keine Buchung des Imports darf storniert oder selbst ein Storno sein —
  //    sonst hinge die Gegenbuchung nach dem Löschen in der Luft.
  const reversedCount = await db.booking.count({
    where: {
      importBatchId: batch.id,
      OR: [{ reversalOfId: { not: null } }, { reversedBy: { isNot: null } }],
    },
  });
  if (reversedCount > 0) back(property.id, "fehler=importstorniert");

  const count = batch.bookings.length;
  await db.$transaction([
    db.booking.deleteMany({ where: { importBatchId: batch.id } }),
    db.bankImportBatch.delete({ where: { id: batch.id } }),
  ]);
  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_BANK_IMPORT_UNDONE,
    targetType: "BankImportBatch",
    targetId: batch.id,
    meta: { fileName: batch.fileName, removed: count },
  });
  revalidatePath(`/verwaltung/weg/${property.id}/buchhaltung`);
  back(property.id, `importzurueck=${count}`);
}
