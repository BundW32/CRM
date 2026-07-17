"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AUDIT, logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { parseEuroToCents } from "@/lib/money";
import { requireVerwalter } from "@/lib/session";
import { WEG_COST_CATALOG } from "@/lib/weg/cost-catalog";
import { syncOwnerVotingWeights } from "@/lib/weg/mea-sync";
import { loadWegProperty } from "@/lib/weg/scope";

const UNIT_TYPES = ["WOHNUNG", "TEILEIGENTUM", "STELLPLATZ", "SONSTIGES"] as const;
const DISTRIBUTION_KEYS = ["MEA", "FLAECHE", "EINHEITEN", "PERSONEN", "VERBRAUCH", "FESTBETRAG", "INDIVIDUELL"] as const;
const COST_CATEGORIES = ["BETRIEBSKOSTEN", "INSTANDHALTUNG", "VERWALTUNG", "RUECKLAGENZUFUEHRUNG", "SONSTIGES"] as const;
const LABOR_SHARE_TYPES = ["KEINE", "HAUSHALTSNAHE_DIENSTLEISTUNG", "HANDWERKERLEISTUNG"] as const;
const ACCOUNT_KINDS = ["GIRO", "RUECKLAGE"] as const;

function back(propertyId: string, param?: string): never {
  redirect(`/verwaltung/weg/${propertyId}/stammdaten${param ? `?${param}` : ""}`);
}

// Optionale Ganzzahl/Dezimalzahl aus deutschem Formular-Input ("76,38" → 76.38)
const optionalInt = z.preprocess(
  (v) => (typeof v === "string" && v.trim() !== "" ? Number(v.trim()) : null),
  z.number().int().min(0).nullable(),
);
const optionalFloat = z.preprocess(
  (v) => (typeof v === "string" && v.trim() !== "" ? Number(v.trim().replace(",", ".")) : null),
  z.number().min(0).nullable(),
);

// ── Objekt-Finanzeinstellungen (MEA-Nenner, Wirtschaftsjahr) ─────────────────

const settingsSchema = z.object({
  propertyId: z.string().min(1),
  meaTotal: optionalInt,
  fiscalYearStartMonth: z.coerce.number().int().min(1).max(12),
});

export async function saveFinanceSettings(formData: FormData) {
  const verwalter = await requireVerwalter();
  const parsed = settingsSchema.safeParse({
    propertyId: formData.get("propertyId"),
    meaTotal: formData.get("meaTotal"),
    fiscalYearStartMonth: formData.get("fiscalYearStartMonth"),
  });
  if (!parsed.success) redirect("/verwaltung/weg");
  const property = await loadWegProperty(verwalter, parsed.data.propertyId);
  if (!property) redirect("/verwaltung/weg");

  await db.property.update({
    where: { id: property.id },
    data: {
      meaTotal: parsed.data.meaTotal,
      fiscalYearStartMonth: parsed.data.fiscalYearStartMonth,
    },
  });
  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_FINANCE_SETTINGS_SAVED,
    targetType: "Property",
    targetId: property.id,
    meta: { meaTotal: parsed.data.meaTotal, fiscalYearStartMonth: parsed.data.fiscalYearStartMonth },
  });
  revalidatePath(`/verwaltung/weg/${property.id}/stammdaten`);
  back(property.id, "gespeichert=einstellungen");
}

// ── Einheiten-Finanzstammdaten (MEA, Fläche, Personen) ───────────────────────

const unitSchema = z.object({
  propertyId: z.string().min(1),
  unitId: z.string().min(1),
  unitType: z.enum(UNIT_TYPES),
  mea: optionalInt,
  livingArea: optionalFloat,
  personCount: optionalInt,
});

export async function saveUnitFinanceData(formData: FormData) {
  const verwalter = await requireVerwalter();
  const parsed = unitSchema.safeParse({
    propertyId: formData.get("propertyId"),
    unitId: formData.get("unitId"),
    unitType: formData.get("unitType"),
    mea: formData.get("mea"),
    livingArea: formData.get("livingArea"),
    personCount: formData.get("personCount"),
  });
  if (!parsed.success) redirect("/verwaltung/weg");
  const property = await loadWegProperty(verwalter, parsed.data.propertyId);
  if (!property) redirect("/verwaltung/weg");

  // Einheit muss zum (erlaubten) Objekt gehören — verhindert IDOR über unitId.
  const unit = await db.unit.findFirst({
    where: { id: parsed.data.unitId, propertyId: property.id },
    select: { id: true },
  });
  if (!unit) back(property.id, "fehler=einheit");

  await db.unit.update({
    where: { id: parsed.data.unitId },
    data: {
      unitType: parsed.data.unitType,
      mea: parsed.data.mea,
      livingArea: parsed.data.livingArea,
      personCount: parsed.data.personCount,
    },
  });
  // Stimmgewichte der Eigentümer aus den (neuen) Einheiten-MEA ableiten.
  await syncOwnerVotingWeights(property.id);
  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_UNIT_SAVED,
    targetType: "Unit",
    targetId: parsed.data.unitId,
    meta: { mea: parsed.data.mea, livingArea: parsed.data.livingArea, personCount: parsed.data.personCount },
  });
  revalidatePath(`/verwaltung/weg/${property.id}/stammdaten`);
  revalidatePath("/verwaltung/eigentuemer");
  back(property.id, "gespeichert=einheit");
}

// ── Kostenarten ──────────────────────────────────────────────────────────────

// Übernimmt den WEG-Standardkatalog (nur Kostenarten, die es dem Namen nach
// noch nicht gibt — mehrfaches Klicken erzeugt keine Duplikate).
export async function adoptCostCatalog(formData: FormData) {
  const verwalter = await requireVerwalter();
  const propertyId = String(formData.get("propertyId") ?? "");
  const property = await loadWegProperty(verwalter, propertyId);
  if (!property) redirect("/verwaltung/weg");

  const existing = await db.costType.findMany({
    where: { propertyId: property.id },
    select: { name: true },
  });
  const existingNames = new Set(existing.map((c) => c.name.toLowerCase()));
  const toCreate = WEG_COST_CATALOG.filter((e) => !existingNames.has(e.name.toLowerCase()));
  if (toCreate.length > 0) {
    await db.costType.createMany({
      data: toCreate.map((e, i) => ({
        organizationId: verwalter.organizationId,
        propertyId: property.id,
        name: e.name,
        category: e.category,
        distributionKey: e.distributionKey,
        laborShareType: e.laborShareType,
        recoverableBetrKV: e.recoverableBetrKV,
        orderIndex: existing.length + i,
      })),
    });
  }
  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_COST_CATALOG_ADOPTED,
    targetType: "Property",
    targetId: property.id,
    meta: { created: toCreate.length },
  });
  revalidatePath(`/verwaltung/weg/${property.id}/stammdaten`);
  back(property.id, "gespeichert=katalog");
}

const costTypeSchema = z.object({
  propertyId: z.string().min(1),
  costTypeId: z.string().optional(), // leer = neu anlegen
  name: z.string().trim().min(2).max(120),
  category: z.enum(COST_CATEGORIES),
  distributionKey: z.enum(DISTRIBUTION_KEYS),
  laborShareType: z.enum(LABOR_SHARE_TYPES),
  recoverableBetrKV: z.coerce.boolean(),
  active: z.coerce.boolean(),
});

export async function saveCostType(formData: FormData) {
  const verwalter = await requireVerwalter();
  const parsed = costTypeSchema.safeParse({
    propertyId: formData.get("propertyId"),
    costTypeId: String(formData.get("costTypeId") ?? "") || undefined,
    name: formData.get("name"),
    category: formData.get("category"),
    distributionKey: formData.get("distributionKey"),
    laborShareType: formData.get("laborShareType"),
    recoverableBetrKV: formData.get("recoverableBetrKV") === "on",
    active: formData.get("active") === "on",
  });
  if (!parsed.success) redirect("/verwaltung/weg");
  const property = await loadWegProperty(verwalter, parsed.data.propertyId);
  if (!property) redirect("/verwaltung/weg");

  const data = {
    name: parsed.data.name,
    category: parsed.data.category,
    distributionKey: parsed.data.distributionKey,
    laborShareType: parsed.data.laborShareType,
    recoverableBetrKV: parsed.data.recoverableBetrKV,
    active: parsed.data.active,
  };
  let targetId = parsed.data.costTypeId;
  if (targetId) {
    // Kostenart muss zum Objekt gehören (IDOR-Schutz)
    const found = await db.costType.findFirst({ where: { id: targetId, propertyId: property.id }, select: { id: true } });
    if (!found) back(property.id, "fehler=kostenart");
    await db.costType.update({ where: { id: targetId }, data });
  } else {
    const count = await db.costType.count({ where: { propertyId: property.id } });
    const created = await db.costType.create({
      data: { ...data, organizationId: verwalter.organizationId, propertyId: property.id, orderIndex: count },
    });
    targetId = created.id;
  }
  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_COSTTYPE_SAVED,
    targetType: "CostType",
    targetId,
    meta: { name: data.name, distributionKey: data.distributionKey },
  });
  revalidatePath(`/verwaltung/weg/${property.id}/stammdaten`);
  back(property.id, "gespeichert=kostenart");
}

// ── Eigentümerschaft je Einheit (tagesgenau, für die Jahresabrechnung) ───────

const ownershipSchema = z.object({
  propertyId: z.string().min(1),
  unitId: z.string().min(1),
  userId: z.string().min(1),
  validFrom: z.string().min(1),
  sharePercent: z.coerce.number().min(0.01).max(100),
});

// Trägt einen Eigentümer für eine Einheit ein. Ein zeitgleich laufender
// 100%-Eintrag desselben Nutzers wird nicht dupliziert; ein Eigentümerwechsel
// beendet automatisch offene Vor-Eigentümerschaften zum Stichtag (validTo).
export async function addUnitOwnership(formData: FormData) {
  const verwalter = await requireVerwalter();
  const parsed = ownershipSchema.safeParse({
    propertyId: formData.get("propertyId"),
    unitId: formData.get("unitId"),
    userId: formData.get("userId"),
    validFrom: formData.get("validFrom"),
    sharePercent: formData.get("sharePercent") || "100",
  });
  if (!parsed.success) redirect("/verwaltung/weg");
  const property = await loadWegProperty(verwalter, parsed.data.propertyId);
  if (!property) redirect("/verwaltung/weg");

  const unit = await db.unit.findFirst({
    where: { id: parsed.data.unitId, propertyId: property.id },
    select: { id: true },
  });
  if (!unit) back(property.id, "fehler=einheit");
  // Nutzer muss zur Org gehören (typisch: Eigentümer des Objekts)
  const user = await db.user.findFirst({
    where: { id: parsed.data.userId, organizationId: verwalter.organizationId },
    select: { id: true },
  });
  if (!user) back(property.id, "fehler=eigentuemer");

  const validFrom = new Date(parsed.data.validFrom);
  if (isNaN(validFrom.getTime())) back(property.id, "fehler=datum");

  const endPrevious = formData.get("endPrevious") === "on";
  await db.$transaction(async (tx) => {
    if (endPrevious) {
      // Eigentümerwechsel: offene Einträge dieser Einheit zum Stichtag beenden
      await tx.unitOwnership.updateMany({
        where: { unitId: unit.id, validTo: null, validFrom: { lt: validFrom } },
        data: { validTo: validFrom },
      });
    }
    await tx.unitOwnership.create({
      data: {
        organizationId: verwalter.organizationId,
        unitId: unit.id,
        userId: user.id,
        validFrom,
        sharePercent: parsed.data.sharePercent,
      },
    });
  });
  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_UNIT_OWNERSHIP_SAVED,
    targetType: "Unit",
    targetId: unit.id,
    meta: { userId: user.id, validFrom: parsed.data.validFrom, endPrevious },
  });
  await syncOwnerVotingWeights(property.id);
  revalidatePath(`/verwaltung/weg/${property.id}/stammdaten`);
  revalidatePath("/verwaltung/eigentuemer");
  back(property.id, "gespeichert=eigentuemer");
}

// Beendet eine laufende Eigentümerschaft zum Stichtag (oder löscht einen
// fehlerhaften Eintrag, wenn kein Datum übergeben wird).
export async function endUnitOwnership(formData: FormData) {
  const verwalter = await requireVerwalter();
  const propertyId = String(formData.get("propertyId") ?? "");
  const ownershipId = String(formData.get("ownershipId") ?? "");
  const validToRaw = String(formData.get("validTo") ?? "").trim();
  const property = await loadWegProperty(verwalter, propertyId);
  if (!property) redirect("/verwaltung/weg");

  const ownership = await db.unitOwnership.findFirst({
    where: {
      id: ownershipId,
      organizationId: verwalter.organizationId,
      unit: { propertyId: property.id },
    },
    select: { id: true, unitId: true },
  });
  if (!ownership) back(property.id, "fehler=eigentuemer");

  if (validToRaw) {
    const validTo = new Date(validToRaw);
    if (isNaN(validTo.getTime())) back(property.id, "fehler=datum");
    await db.unitOwnership.update({ where: { id: ownership.id }, data: { validTo } });
  } else {
    await db.unitOwnership.delete({ where: { id: ownership.id } });
  }
  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_UNIT_OWNERSHIP_SAVED,
    targetType: "Unit",
    targetId: ownership.unitId,
    meta: { ownershipId: ownership.id, validTo: validToRaw || "gelöscht" },
  });
  await syncOwnerVotingWeights(property.id);
  revalidatePath(`/verwaltung/weg/${property.id}/stammdaten`);
  revalidatePath("/verwaltung/eigentuemer");
  back(property.id, "gespeichert=eigentuemer");
}

// ── Konten ───────────────────────────────────────────────────────────────────

const accountSchema = z.object({
  propertyId: z.string().min(1),
  accountId: z.string().optional(), // leer = neu anlegen
  name: z.string().trim().min(2).max(120),
  kind: z.enum(ACCOUNT_KINDS),
  iban: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s/g, "").toUpperCase())
    .refine((v) => v === "" || /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(v), "Ungültige IBAN")
    .optional(),
  openingBalance: z.string().optional(),
  openingBalanceDate: z.string().optional(),
});

export async function saveAccount(formData: FormData) {
  const verwalter = await requireVerwalter();
  const parsed = accountSchema.safeParse({
    propertyId: formData.get("propertyId"),
    accountId: String(formData.get("accountId") ?? "") || undefined,
    name: formData.get("name"),
    kind: formData.get("kind"),
    iban: formData.get("iban") ?? "",
    openingBalance: formData.get("openingBalance") ?? "",
    openingBalanceDate: formData.get("openingBalanceDate") ?? "",
  });
  if (!parsed.success) redirect("/verwaltung/weg");
  const property = await loadWegProperty(verwalter, parsed.data.propertyId);
  if (!property) redirect("/verwaltung/weg");

  // Anfangsbestand: deutsches Format, darf negativ sein (Konto im Soll)
  const raw = (parsed.data.openingBalance ?? "").trim();
  let openingBalanceCents = 0;
  if (raw !== "") {
    const negative = raw.startsWith("-");
    const cents = parseEuroToCents(negative ? raw.slice(1) : raw);
    if (cents === null) back(property.id, "fehler=betrag");
    openingBalanceCents = negative ? -cents : cents;
  }
  const openingBalanceDate = parsed.data.openingBalanceDate ? new Date(parsed.data.openingBalanceDate) : null;

  const data = {
    name: parsed.data.name,
    kind: parsed.data.kind,
    iban: parsed.data.iban || null,
    openingBalanceCents,
    openingBalanceDate: openingBalanceDate && !isNaN(openingBalanceDate.getTime()) ? openingBalanceDate : null,
  };
  let targetId = parsed.data.accountId;
  if (targetId) {
    const found = await db.ledgerAccount.findFirst({
      where: { id: targetId, propertyId: property.id },
      select: { id: true },
    });
    if (!found) back(property.id, "fehler=konto");
    await db.ledgerAccount.update({ where: { id: targetId }, data });
  } else {
    const created = await db.ledgerAccount.create({
      data: { ...data, organizationId: verwalter.organizationId, propertyId: property.id },
    });
    targetId = created.id;
  }
  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_ACCOUNT_SAVED,
    targetType: "LedgerAccount",
    targetId,
    meta: { name: data.name, kind: data.kind },
  });
  revalidatePath(`/verwaltung/weg/${property.id}/stammdaten`);
  back(property.id, "gespeichert=konto");
}
