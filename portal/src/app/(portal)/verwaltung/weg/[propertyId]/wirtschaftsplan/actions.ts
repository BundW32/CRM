"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AUDIT, logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { parseEuroToCents } from "@/lib/money";
import { requireVerwalter } from "@/lib/session";
import {
  computeUnitAdvances,
  fiscalYearMonths,
  fiscalYearRange,
  monthlyInstallments,
} from "@/lib/weg/economic-plan";
import { loadWegProperty } from "@/lib/weg/scope";

function back(propertyId: string, suffix = "", param?: string): never {
  redirect(`/verwaltung/weg/${propertyId}/wirtschaftsplan${suffix}${param ? `?${param}` : ""}`);
}

// ── Plan anlegen (Vorjahres-Istwerte vorbefüllt) ─────────────────────────────

const createSchema = z.object({
  propertyId: z.string().min(1),
  year: z.coerce.number().int().min(2000).max(2100),
});

export async function createPlan(formData: FormData) {
  const verwalter = await requireVerwalter();
  const parsed = createSchema.safeParse({
    propertyId: formData.get("propertyId"),
    year: formData.get("year"),
  });
  if (!parsed.success) redirect("/verwaltung/weg");
  const property = await loadWegProperty(verwalter, parsed.data.propertyId);
  if (!property) redirect("/verwaltung/weg");

  const existing = await db.economicPlan.findFirst({
    where: { propertyId: property.id, year: parsed.data.year },
    select: { id: true },
  });
  if (existing) back(property.id, `/${existing.id}`);

  const costTypes = await db.costType.findMany({
    where: { propertyId: property.id, active: true },
    orderBy: [{ orderIndex: "asc" }, { name: "asc" }],
    select: { id: true },
  });
  if (costTypes.length === 0) back(property.id, "", "fehler=kostenarten");

  // Vorjahres-Istwerte: Ausgaben je Kostenart im vorherigen Wirtschaftsjahr
  const prev = fiscalYearRange(parsed.data.year - 1, property.fiscalYearStartMonth);
  const actuals = await db.booking.groupBy({
    by: ["costTypeId"],
    where: {
      propertyId: property.id,
      kind: "AUSGABE",
      costTypeId: { not: null },
      bookingDate: { gte: prev.start, lt: prev.end },
    },
    _sum: { amountCents: true },
  });
  const actualByCostType = new Map(actuals.map((a) => [a.costTypeId as string, a._sum.amountCents ?? 0]));

  const plan = await db.economicPlan.create({
    data: {
      organizationId: verwalter.organizationId,
      propertyId: property.id,
      year: parsed.data.year,
      createdById: verwalter.id,
      items: {
        create: costTypes.map((c) => ({
          costTypeId: c.id,
          amountCents: actualByCostType.get(c.id) ?? 0,
          previousActualCents: actualByCostType.get(c.id) ?? null,
        })),
      },
    },
  });
  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_PLAN_SAVED,
    targetType: "EconomicPlan",
    targetId: plan.id,
    meta: { year: parsed.data.year, created: true },
  });
  revalidatePath(`/verwaltung/weg/${property.id}/wirtschaftsplan`);
  back(property.id, `/${plan.id}`);
}

// Lädt Plan + Scope-Prüfung; liefert null bei fehlendem Zugriff.
async function loadPlan(verwalterId: { organizationId: string }, propertyId: string, planId: string) {
  return db.economicPlan.findFirst({
    where: { id: planId, propertyId, organizationId: verwalterId.organizationId },
    include: { items: { include: { costType: true } } },
  });
}

// ── Planwerte speichern (nur ENTWURF) ────────────────────────────────────────

export async function updatePlanItems(formData: FormData) {
  const verwalter = await requireVerwalter();
  const propertyId = String(formData.get("propertyId") ?? "");
  const planId = String(formData.get("planId") ?? "");
  const property = await loadWegProperty(verwalter, propertyId);
  if (!property) redirect("/verwaltung/weg");
  const plan = await loadPlan(verwalter, property.id, planId);
  if (!plan) back(property.id);
  if (plan.status !== "ENTWURF") back(property.id, `/${plan.id}`, "fehler=beschlossen");

  const updates: { id: string; amountCents: number }[] = [];
  for (const item of plan.items) {
    const raw = String(formData.get(`item_${item.id}`) ?? "").trim();
    if (raw === "") continue;
    const cents = parseEuroToCents(raw);
    if (cents === null) back(property.id, `/${plan.id}`, "fehler=betrag");
    if (cents !== item.amountCents) updates.push({ id: item.id, amountCents: cents });
  }
  if (updates.length > 0) {
    await db.$transaction(
      updates.map((u) =>
        db.economicPlanItem.update({ where: { id: u.id }, data: { amountCents: u.amountCents } }),
      ),
    );
  }
  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_PLAN_SAVED,
    targetType: "EconomicPlan",
    targetId: plan.id,
    meta: { updatedItems: updates.length },
  });
  revalidatePath(`/verwaltung/weg/${property.id}/wirtschaftsplan/${plan.id}`);
  back(property.id, `/${plan.id}`, "gespeichert=1");
}

// ── Plan löschen (nur ENTWURF) ───────────────────────────────────────────────

export async function deletePlan(formData: FormData) {
  const verwalter = await requireVerwalter();
  const propertyId = String(formData.get("propertyId") ?? "");
  const planId = String(formData.get("planId") ?? "");
  const property = await loadWegProperty(verwalter, propertyId);
  if (!property) redirect("/verwaltung/weg");
  const plan = await loadPlan(verwalter, property.id, planId);
  if (!plan) back(property.id);
  if (plan.status !== "ENTWURF") back(property.id, `/${plan.id}`, "fehler=beschlossen");

  await db.economicPlan.delete({ where: { id: plan.id } });
  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_PLAN_DELETED,
    targetType: "EconomicPlan",
    targetId: plan.id,
    meta: { year: plan.year },
  });
  revalidatePath(`/verwaltung/weg/${property.id}/wirtschaftsplan`);
  back(property.id, "", "geloescht=1");
}

// ── Plan beschließen → Sollstellungen erzeugen ───────────────────────────────

const resolveSchema = z.object({
  propertyId: z.string().min(1),
  planId: z.string().min(1),
  resolvedAt: z.string().min(1),
  resolutionNote: z.string().trim().max(300).optional(),
});

export async function resolvePlan(formData: FormData) {
  const verwalter = await requireVerwalter();
  const parsed = resolveSchema.safeParse({
    propertyId: formData.get("propertyId"),
    planId: formData.get("planId"),
    resolvedAt: formData.get("resolvedAt"),
    resolutionNote: String(formData.get("resolutionNote") ?? "") || undefined,
  });
  if (!parsed.success) redirect("/verwaltung/weg");
  const property = await loadWegProperty(verwalter, parsed.data.propertyId);
  if (!property) redirect("/verwaltung/weg");
  const plan = await loadPlan(verwalter, property.id, parsed.data.planId);
  if (!plan) back(property.id);
  if (plan.status !== "ENTWURF") back(property.id, `/${plan.id}`, "fehler=beschlossen");

  const resolvedAt = new Date(parsed.data.resolvedAt);
  if (isNaN(resolvedAt.getTime())) back(property.id, `/${plan.id}`, "fehler=datum");

  const units = await db.unit.findMany({
    where: { propertyId: property.id },
    select: { id: true, mea: true, livingArea: true, personCount: true },
  });
  if (units.length === 0) back(property.id, `/${plan.id}`, "fehler=einheiten");

  // Einzelwirtschaftspläne berechnen; fehlende MEA o. Ä. → verständlicher Fehler
  let advances;
  try {
    advances = computeUnitAdvances(
      plan.items.map((i) => ({
        costTypeId: i.costTypeId,
        distributionKey: i.costType.distributionKey,
        amountCents: i.amountCents,
      })),
      units,
    );
  } catch {
    back(property.id, `/${plan.id}`, "fehler=stammdaten");
  }
  if (advances.totalCents === 0) back(property.id, `/${plan.id}`, "fehler=leer");

  // Monatliche Sollstellungen: 12 Raten je Einheit, centgenau; Fälligkeit am
  // 1. des jeweiligen Kalendermonats des Wirtschaftsjahres.
  const months = fiscalYearMonths(plan.year, property.fiscalYearStartMonth);
  const postings = units.flatMap((u) => {
    const annual = advances.perUnit.get(u.id) ?? 0;
    const rates = monthlyInstallments(annual);
    return months.map((m, i) => ({
      organizationId: verwalter.organizationId,
      propertyId: property.id,
      unitId: u.id,
      planId: plan.id,
      dueDate: new Date(Date.UTC(m.year, m.month - 1, 1)),
      periodYear: m.year,
      periodMonth: m.month,
      amountCents: rates[i],
      source: "WIRTSCHAFTSPLAN",
    }));
  });

  await db.$transaction([
    db.economicPlan.update({
      where: { id: plan.id },
      data: {
        status: "BESCHLOSSEN",
        resolvedAt,
        resolutionNote: parsed.data.resolutionNote ?? null,
      },
    }),
    // Idempotenz: alte Sollstellungen dieses Plans (falls vorhanden) ersetzen
    db.duePosting.deleteMany({ where: { planId: plan.id } }),
    db.duePosting.createMany({ data: postings }),
  ]);
  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_PLAN_RESOLVED,
    targetType: "EconomicPlan",
    targetId: plan.id,
    meta: { year: plan.year, totalCents: advances.totalCents, postings: postings.length },
  });
  revalidatePath(`/verwaltung/weg/${property.id}/wirtschaftsplan/${plan.id}`);
  back(property.id, `/${plan.id}`, "beschlossen=1");
}
