"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AUDIT, logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { formatCents, parseEuroToCents } from "@/lib/money";
import { requireVerwalter } from "@/lib/session";
import { DOCUMENT_TYPES, saveUpload } from "@/lib/storage";
import {
  guessMapping,
  mapRows,
  parseCsv,
  type ColumnMapping,
} from "@/lib/weg/bank-import";
import { loadWegProperty } from "@/lib/weg/scope";

const MAX_CSV_SIZE = 2 * 1024 * 1024; // 2 MB — Bank-CSVs sind klein

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
  text: z.string().trim().min(2).max(500),
  counterparty: z.string().trim().max(200).optional(),
  reference: z.string().trim().max(500).optional(),
});

export async function createBooking(formData: FormData) {
  const verwalter = await requireVerwalter();
  const parsed = bookingSchema.safeParse({
    propertyId: formData.get("propertyId"),
    accountId: formData.get("accountId"),
    kind: formData.get("kind"),
    bookingDate: formData.get("bookingDate"),
    amount: formData.get("amount"),
    costTypeId: String(formData.get("costTypeId") ?? "") || undefined,
    text: formData.get("text"),
    counterparty: String(formData.get("counterparty") ?? "") || undefined,
    reference: String(formData.get("reference") ?? "") || undefined,
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
      text: parsed.data.text,
      counterparty: parsed.data.counterparty ?? null,
      reference: parsed.data.reference ?? null,
      belegStoredName: beleg?.storedName ?? null,
      belegFileName: beleg?.fileName ?? null,
      belegMimeType: beleg?.mimeType ?? null,
      createdById: verwalter.id,
    },
  });
  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_BOOKING_CREATED,
    targetType: "Booking",
    targetId: created.id,
    meta: { kind: parsed.data.kind, amountCents, account: account.name },
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

// ── CSV-Import (Zero-Key-Adapter) ────────────────────────────────────────────
// Schritt 1 (analyzeCsvAction): Datei parsen, Mapping raten/übernehmen, Vorschau
// mit Duplikat-Markierung liefern. Der Dateiinhalt wandert als Base64 in die
// Antwort und kommt in Schritt 2 als Hidden-Field zurück — nichts wird
// zwischengespeichert (Zero-Key, kein Aufräum-Job).
// Schritt 2 (importCsvAction): endgültiger Import als BankImportBatch.

export type ImportPreviewRow = {
  date: string;
  kind: "EINNAHME" | "AUSGABE";
  amountCents: number;
  amountLabel: string;
  text: string;
  counterparty?: string;
  duplicate: boolean;
};

export type ImportAnalysis =
  | {
      ok: true;
      accountId: string;
      fileName: string;
      contentBase64: string;
      header: string[];
      mapping: Partial<ColumnMapping>;
      rowsTotal: number;
      parseable: number;
      duplicates: number;
      preview: ImportPreviewRow[];
    }
  | { ok: false; error: string };

function readMappingOverride(formData: FormData): Partial<ColumnMapping> {
  const num = (name: string) => {
    const v = String(formData.get(name) ?? "").trim();
    if (v === "") return undefined;
    const n = Number(v);
    return Number.isInteger(n) && n >= 0 ? n : undefined;
  };
  return {
    date: num("col_date"),
    amount: num("col_amount"),
    purpose: num("col_purpose"),
    counterparty: num("col_counterparty"),
  };
}

async function analyzeInternal(
  accountId: string,
  fileName: string,
  content: string,
  override: Partial<ColumnMapping>,
): Promise<ImportAnalysis> {
  const { header, rows } = parseCsv(content);
  if (header.length === 0 || rows.length === 0) {
    return { ok: false, error: "Die Datei enthält keine auswertbaren Zeilen." };
  }
  const guessed = guessMapping(header);
  const mapping: Partial<ColumnMapping> = {
    date: override.date ?? guessed.date,
    amount: override.amount ?? guessed.amount,
    purpose: override.purpose ?? guessed.purpose,
    counterparty: override.counterparty ?? guessed.counterparty,
  };
  const base = {
    ok: true as const,
    accountId,
    fileName,
    contentBase64: Buffer.from(content, "utf-8").toString("base64"),
    header,
    mapping,
    rowsTotal: rows.length,
  };
  if (mapping.date === undefined || mapping.amount === undefined || mapping.purpose === undefined) {
    return { ...base, parseable: 0, duplicates: 0, preview: [] };
  }
  const parsedRows = mapRows(rows, mapping as ColumnMapping, accountId);
  // Duplikate: gegen den Bestand UND innerhalb der Datei
  const existing = await db.booking.findMany({
    where: { accountId, dedupeHash: { in: parsedRows.map((r) => r.dedupeHash) } },
    select: { dedupeHash: true },
  });
  const known = new Set(existing.map((e) => e.dedupeHash));
  const seen = new Set<string>();
  let duplicates = 0;
  const preview: ImportPreviewRow[] = parsedRows.map((r) => {
    const duplicate = known.has(r.dedupeHash) || seen.has(r.dedupeHash);
    seen.add(r.dedupeHash);
    if (duplicate) duplicates++;
    return {
      date: r.bookingDate.toISOString().slice(0, 10),
      kind: r.kind as "EINNAHME" | "AUSGABE",
      amountCents: r.amountCents,
      amountLabel: formatCents(r.amountCents),
      text: r.text,
      counterparty: r.counterparty,
      duplicate,
    };
  });
  return { ...base, parseable: parsedRows.length, duplicates, preview };
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
  const file = formData.get("csv");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_CSV_SIZE) return { ok: false, error: "Die Datei ist größer als 2 MB." };
    fileName = file.name;
    content = Buffer.from(await file.arrayBuffer()).toString("utf-8");
  } else {
    const b64 = String(formData.get("contentBase64") ?? "");
    fileName = String(formData.get("fileName") ?? "import.csv");
    if (!b64) return { ok: false, error: "Bitte eine CSV-Datei auswählen." };
    if (b64.length > MAX_CSV_SIZE * 1.4) return { ok: false, error: "Die Datei ist größer als 2 MB." };
    content = Buffer.from(b64, "base64").toString("utf-8");
  }
  return analyzeInternal(account.id, fileName, content, readMappingOverride(formData));
}

export async function importCsvAction(formData: FormData) {
  const verwalter = await requireVerwalter();
  const propertyId = String(formData.get("propertyId") ?? "");
  const accountId = String(formData.get("accountId") ?? "");
  const property = await loadWegProperty(verwalter, propertyId);
  if (!property) redirect("/verwaltung/weg");
  const account = await loadAccount(property.id, accountId);
  if (!account) back(property.id, "fehler=konto");

  const b64 = String(formData.get("contentBase64") ?? "");
  const fileName = String(formData.get("fileName") ?? "import.csv").slice(0, 200);
  if (!b64 || b64.length > MAX_CSV_SIZE * 1.4) back(property.id, "fehler=datei");
  const content = Buffer.from(b64, "base64").toString("utf-8");

  const override = readMappingOverride(formData);
  if (override.date === undefined || override.amount === undefined || override.purpose === undefined) {
    back(property.id, "fehler=mapping");
  }
  const mapping = override as ColumnMapping;
  const { rows } = parseCsv(content);
  const parsedRows = mapRows(rows, mapping, account.id);
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

  const batch = await db.$transaction(async (tx) => {
    const created = await tx.bankImportBatch.create({
      data: {
        organizationId: verwalter.organizationId,
        propertyId: property.id,
        accountId: account.id,
        fileName,
        source: "CSV",
        rowsTotal: rows.length,
        rowsImported: toImport.length,
        rowsSkipped: rows.length - toImport.length,
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
          createdById: verwalter.id,
        })),
        skipDuplicates: true, // DB-Unique (accountId, dedupeHash) als letzte Wand
      });
    }
    return created;
  });

  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_BANK_IMPORT,
    targetType: "BankImportBatch",
    targetId: batch.id,
    meta: { fileName, imported: toImport.length, skipped: rows.length - toImport.length },
  });
  revalidatePath(`/verwaltung/weg/${property.id}/buchhaltung`);
  back(property.id, `import=${toImport.length}&uebersprungen=${rows.length - toImport.length}`);
}
