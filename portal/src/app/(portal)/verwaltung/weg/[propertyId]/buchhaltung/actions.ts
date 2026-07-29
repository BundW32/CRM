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
import { pruefeZahlung } from "@/lib/weg/bauabzugsteuer-service";
import { NOT_REVERSED } from "@/lib/weg/booking-scope";
import { loadWegProperty } from "@/lib/weg/scope";
import { allDatesEditable } from "@/lib/weg/statement-lock";

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
