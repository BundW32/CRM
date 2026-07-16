"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { AUDIT, logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { parseEuroToCents } from "@/lib/money";
import { requireVerwalter } from "@/lib/session";
import { computeStatementView } from "@/lib/weg/statement-service";
import { loadWegProperty } from "@/lib/weg/scope";

function back(propertyId: string, suffix = "", param?: string): never {
  redirect(`/verwaltung/weg/${propertyId}/jahresabrechnung${suffix}${param ? `?${param}` : ""}`);
}

async function loadStatement(orgId: string, propertyId: string, statementId: string) {
  return db.annualStatement.findFirst({
    where: { id: statementId, propertyId, organizationId: orgId },
  });
}

// ── Abrechnung anlegen ───────────────────────────────────────────────────────

const createSchema = z.object({
  propertyId: z.string().min(1),
  year: z.coerce.number().int().min(2000).max(2100),
});

export async function createStatement(formData: FormData) {
  const verwalter = await requireVerwalter();
  const parsed = createSchema.safeParse({
    propertyId: formData.get("propertyId"),
    year: formData.get("year"),
  });
  if (!parsed.success) redirect("/verwaltung/weg");
  const property = await loadWegProperty(verwalter, parsed.data.propertyId);
  if (!property) redirect("/verwaltung/weg");

  const existing = await db.annualStatement.findFirst({
    where: { propertyId: property.id, year: parsed.data.year },
    select: { id: true },
  });
  if (existing) back(property.id, `/${existing.id}`);

  const statement = await db.annualStatement.create({
    data: {
      organizationId: verwalter.organizationId,
      propertyId: property.id,
      year: parsed.data.year,
      createdById: verwalter.id,
    },
  });
  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_STATEMENT_SAVED,
    targetType: "AnnualStatement",
    targetId: statement.id,
    meta: { year: parsed.data.year, created: true },
  });
  revalidatePath(`/verwaltung/weg/${property.id}/jahresabrechnung`);
  back(property.id, `/${statement.id}`);
}

// ── Manuelle Verteilung je Einheit (Heizkosten etc.) speichern ───────────────

export async function saveManualAmounts(formData: FormData) {
  const verwalter = await requireVerwalter();
  const propertyId = String(formData.get("propertyId") ?? "");
  const statementId = String(formData.get("statementId") ?? "");
  const costTypeId = String(formData.get("costTypeId") ?? "");
  const property = await loadWegProperty(verwalter, propertyId);
  if (!property) redirect("/verwaltung/weg");
  const statement = await loadStatement(verwalter.organizationId, property.id, statementId);
  if (!statement) back(property.id);
  if (statement.status !== "ENTWURF") back(property.id, `/${statement.id}`, "fehler=fertig");

  const costType = await db.costType.findFirst({
    where: { id: costTypeId, propertyId: property.id },
    select: { id: true },
  });
  if (!costType) back(property.id, `/${statement.id}`, "fehler=kostenart");

  const units = await db.unit.findMany({
    where: { propertyId: property.id },
    select: { id: true },
  });
  const writes = [];
  for (const u of units) {
    const raw = String(formData.get(`amount_${u.id}`) ?? "").trim();
    const cents = raw === "" ? 0 : parseEuroToCents(raw);
    if (cents === null) back(property.id, `/${statement.id}`, "fehler=betrag");
    writes.push(
      db.statementUnitAmount.upsert({
        where: {
          statementId_costTypeId_unitId: {
            statementId: statement.id,
            costTypeId: costType.id,
            unitId: u.id,
          },
        },
        update: { amountCents: cents },
        create: {
          statementId: statement.id,
          costTypeId: costType.id,
          unitId: u.id,
          amountCents: cents,
        },
      }),
    );
  }
  await db.$transaction(writes);
  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_STATEMENT_SAVED,
    targetType: "AnnualStatement",
    targetId: statement.id,
    meta: { manualCostType: costType.id },
  });
  revalidatePath(`/verwaltung/weg/${property.id}/jahresabrechnung/${statement.id}`);
  back(property.id, `/${statement.id}`, "gespeichert=verteilung");
}

// ── Endbestände laut Kontoauszug (harte Plausibilitätsprüfung) ───────────────

export async function saveAccountChecks(formData: FormData) {
  const verwalter = await requireVerwalter();
  const propertyId = String(formData.get("propertyId") ?? "");
  const statementId = String(formData.get("statementId") ?? "");
  const property = await loadWegProperty(verwalter, propertyId);
  if (!property) redirect("/verwaltung/weg");
  const statement = await loadStatement(verwalter.organizationId, property.id, statementId);
  if (!statement) back(property.id);
  if (statement.status !== "ENTWURF") back(property.id, `/${statement.id}`, "fehler=fertig");

  const accounts = await db.ledgerAccount.findMany({
    where: { propertyId: property.id, active: true },
    select: { id: true },
  });
  const writes = [];
  for (const a of accounts) {
    const raw = String(formData.get(`check_${a.id}`) ?? "").trim();
    if (raw === "") continue;
    // Endbestand darf negativ sein (Konto im Soll)
    const negative = raw.startsWith("-");
    const cents = parseEuroToCents(negative ? raw.slice(1) : raw);
    if (cents === null) back(property.id, `/${statement.id}`, "fehler=betrag");
    const reportedEndCents = negative ? -cents : cents;
    writes.push(
      db.statementAccountCheck.upsert({
        where: { statementId_accountId: { statementId: statement.id, accountId: a.id } },
        update: { reportedEndCents },
        create: { statementId: statement.id, accountId: a.id, reportedEndCents },
      }),
    );
  }
  await db.$transaction(writes);
  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_STATEMENT_SAVED,
    targetType: "AnnualStatement",
    targetId: statement.id,
    meta: { accountChecks: writes.length },
  });
  revalidatePath(`/verwaltung/weg/${property.id}/jahresabrechnung/${statement.id}`);
  back(property.id, `/${statement.id}`, "gespeichert=konten");
}

// ── Entwurf löschen ──────────────────────────────────────────────────────────

export async function deleteStatement(formData: FormData) {
  const verwalter = await requireVerwalter();
  const propertyId = String(formData.get("propertyId") ?? "");
  const statementId = String(formData.get("statementId") ?? "");
  const property = await loadWegProperty(verwalter, propertyId);
  if (!property) redirect("/verwaltung/weg");
  const statement = await loadStatement(verwalter.organizationId, property.id, statementId);
  if (!statement) back(property.id);
  if (statement.status !== "ENTWURF") back(property.id, `/${statement.id}`, "fehler=fertig");

  await db.annualStatement.delete({ where: { id: statement.id } });
  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_STATEMENT_DELETED,
    targetType: "AnnualStatement",
    targetId: statement.id,
    meta: { year: statement.year },
  });
  revalidatePath(`/verwaltung/weg/${property.id}/jahresabrechnung`);
  back(property.id, "", "geloescht=1");
}

// ── Fertigstellen (harte Plausibilitätsprüfung, dann Snapshot) ───────────────

export async function finalizeStatement(formData: FormData) {
  const verwalter = await requireVerwalter();
  const propertyId = String(formData.get("propertyId") ?? "");
  const statementId = String(formData.get("statementId") ?? "");
  const property = await loadWegProperty(verwalter, propertyId);
  if (!property) redirect("/verwaltung/weg");
  const statement = await loadStatement(verwalter.organizationId, property.id, statementId);
  if (!statement) back(property.id);
  if (statement.status !== "ENTWURF") back(property.id, `/${statement.id}`, "fehler=fertig");

  const view = await computeStatementView(property, statement.year, statement.id);

  // 1) Verteilungs-Plausibilität: keine offenen Fehler
  if (view.errors.length > 0) back(property.id, `/${statement.id}`, "fehler=pruefung");

  // 2) Kontenprüfung: für jedes aktive Konto muss der gemeldete Endbestand
  //    (Kontoauszug) exakt dem rechnerischen Endbestand entsprechen.
  const checks = await db.statementAccountCheck.findMany({ where: { statementId: statement.id } });
  const reported = new Map(checks.map((c) => [c.accountId, c.reportedEndCents]));
  for (const account of view.accounts) {
    const value = reported.get(account.id);
    if (value === undefined || value !== account.endCents) {
      back(property.id, `/${statement.id}`, "fehler=kontenpruefung");
    }
  }

  await db.annualStatement.update({
    where: { id: statement.id },
    data: {
      status: "FERTIG",
      finalizedAt: new Date(),
      snapshot: view as unknown as Prisma.InputJsonValue,
    },
  });
  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_STATEMENT_FINALIZED,
    targetType: "AnnualStatement",
    targetId: statement.id,
    meta: { year: statement.year, totalExpenseCents: view.totalExpenseCents },
  });
  revalidatePath(`/verwaltung/weg/${property.id}/jahresabrechnung/${statement.id}`);
  back(property.id, `/${statement.id}`, "fertig=1");
}
