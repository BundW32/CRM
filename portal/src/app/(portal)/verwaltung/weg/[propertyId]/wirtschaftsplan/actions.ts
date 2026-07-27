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
import { legeEigentuemerDokumenteAb } from "@/lib/weg/owner-documents";
import { loadWegProperty } from "@/lib/weg/scope";
import { buildEinzelwirtschaftsplanPdf, ownerNamesByUnit } from "@/lib/weg/wirtschaftsplan-pdf";
import { NOT_REVERSED } from "@/lib/weg/booking-scope";

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
      ...NOT_REVERSED,
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
        category: i.costType.category,
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
  // Jeder Eigentümer bekommt seinen Einzelwirtschaftsplan in die Dokumente
  // gelegt. Der Beschluss ist der richtige Moment: Erst er macht die Vorschüsse
  // fällig (§ 28 Abs. 1 WEG), und dies ist die Fassung, die der Eigentümer
  // aufbewahrt — „ab Januar zahle ich X, so setzt es sich zusammen".
  //
  // Ein Fehler bei der Ablage nimmt den Beschluss nicht zurück: Der Beschluss
  // und seine Sollstellungen sind der fachliche Vorgang, die Ablage die Folge.
  let ablage: Awaited<ReturnType<typeof legeEigentuemerDokumenteAb>> | null = null;
  try {
    const beschlossen = await db.economicPlan.findFirstOrThrow({
      where: { id: plan.id },
      include: { items: { include: { costType: true }, orderBy: { costType: { orderIndex: "asc" } } } },
    });
    const alleEinheiten = await db.unit.findMany({
      where: { propertyId: property.id },
      orderBy: [{ orderIndex: "asc" }, { label: "asc" }],
    });
    const namen = await ownerNamesByUnit(alleEinheiten.map((u) => u.id));
    ablage = await legeEigentuemerDokumenteAb({
      organizationId: verwalter.organizationId,
      propertyId: property.id,
      uploadedById: verwalter.id,
      category: "ABRECHNUNG",
      refPrefix: `weg-einzelwirtschaftsplan:${plan.id}`,
      documents: await Promise.all(
        alleEinheiten.map(async (u) => ({
          unitId: u.id,
          unitLabel: u.label,
          title: `Einzelwirtschaftsplan ${plan.year} — ${u.label}`,
          fileName: `Einzelwirtschaftsplan_${plan.year}_${u.label.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`,
          pdf: await buildEinzelwirtschaftsplanPdf({
            propertyName: property.name,
            organizationId: verwalter.organizationId,
            plan: beschlossen,
            units: alleEinheiten,
            ownerNamesByUnit: namen,
            onlyUnitIds: [u.id],
          }),
        })),
      ),
    });
  } catch (err) {
    console.error("Ablage der Einzelwirtschaftspläne fehlgeschlagen", err);
  }

  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_PLAN_RESOLVED,
    targetType: "EconomicPlan",
    targetId: plan.id,
    meta: {
      year: plan.year,
      totalCents: advances.totalCents,
      postings: postings.length,
      dokumenteAbgelegt: ablage ? ablage.erstellt + ablage.ersetzt : 0,
    },
  });
  revalidatePath(`/verwaltung/weg/${property.id}/wirtschaftsplan/${plan.id}`);
  back(
    property.id,
    `/${plan.id}`,
    ablage
      ? `beschlossen=1&abgelegt=${ablage.erstellt + ablage.ersetzt}&ohne=${ablage.uebersprungen.length}`
      : "beschlossen=1&ablage=fehler",
  );
}

/**
 * Bringt einen Wirtschaftsplan-Entwurf zur Abstimmung — als Tagesordnungspunkt
 * einer Versammlung oder als Umlaufbeschluss.
 *
 * Bisher gab es hier nur den Rückweg: „beschlossen am …" eintragen, also
 * nachtragen, was außerhalb des Programms passiert war. Der Weg nach vorn
 * fehlte, obwohl beide Bausteine längst existieren — Versammlungen mit
 * Beschluss-TOPs und die Umlaufabstimmung.
 *
 * Die Mehrheit ist bewusst gesetzt statt wählbar: In der Versammlung genügt für
 * den Wirtschaftsplan die einfache Mehrheit (§ 28 Abs. 1 WEG), im Umlauf
 * verlangt § 23 Abs. 3 Satz 1 WEG die Zustimmung ALLER. Wer das verwechselt,
 * fasst einen angreifbaren Beschluss.
 */
export async function planZurAbstimmung(formData: FormData) {
  const verwalter = await requireVerwalter();
  const propertyId = String(formData.get("propertyId") ?? "").trim();
  const planId = String(formData.get("planId") ?? "").trim();
  const modus = String(formData.get("modus") ?? "").trim();
  const meetingId = String(formData.get("meetingId") ?? "").trim();

  const property = await loadWegProperty(verwalter, propertyId);
  if (!property) redirect("/verwaltung/weg");
  const plan = await loadPlan(verwalter, property.id, planId);
  if (!plan) back(property.id);
  // Ein beschlossener Plan braucht keine Abstimmung mehr.
  if (plan.status !== "ENTWURF") back(property.id, `/${plan.id}`, "fehler=beschlossen");

  // Dieselbe Prüfung wie beim Nachtragen eines Beschlusses: Ein Plan, dessen
  // Einzelwirtschaftspläne sich nicht rechnen lassen, darf nicht zur Abstimmung.
  // Sonst stimmt die Gemeinschaft über Beträge ab, die es nicht gibt — und der
  // Beschluss stünde anschließend in der Sammlung, ohne dass ihm je Zahlen
  // folgen könnten. Der graue Knopf in der Oberfläche allein reicht dafür nicht.
  const units = await db.unit.findMany({ where: { propertyId: property.id } });
  try {
    computeUnitAdvances(
      plan.items.map((i) => ({
        costTypeId: i.costTypeId,
        distributionKey: i.costType.distributionKey,
        amountCents: i.amountCents,
        category: i.costType.category,
      })),
      units,
    );
  } catch {
    back(property.id, `/${plan.id}`, "fehler=stammdaten");
  }

  const titel = `Wirtschaftsplan ${plan.year}`;
  const text =
    `Die Gemeinschaft der Wohnungseigentümer beschließt gemäß § 28 Abs. 1 WEG auf Grundlage ` +
    `des vorgelegten Wirtschaftsplans für das Wirtschaftsjahr ${plan.year} die Vorschüsse zur ` +
    `Kostentragung und zur Zuführung zur Erhaltungsrücklage. Die monatlichen Hausgeld-Vorschüsse ` +
    `je Einheit ergeben sich aus den Einzelwirtschaftsplänen und sind jeweils zum 1. eines ` +
    `Monats fällig.`;

  if (modus === "versammlung") {
    // Versammlung muss zum Objekt gehören und noch offen sein (Scope-Prüfung).
    const meeting = await db.ownersMeeting.findFirst({
      where: {
        id: meetingId,
        propertyId: property.id,
        organizationId: verwalter.organizationId,
        status: { in: ["GEPLANT", "EINBERUFEN"] },
      },
      select: { id: true },
    });
    if (!meeting) back(property.id, `/${plan.id}`, "fehler=versammlung");

    const resolution = await db.resolution.create({
      data: {
        propertyId: property.id,
        title: titel,
        description: text,
        // In der Versammlung genügt die einfache Mehrheit.
        majority: "EINFACH",
        createdById: verwalter.id,
        organizationId: verwalter.organizationId,
      },
    });
    await db.$transaction(async (tx) => {
      const max = await tx.meetingAgendaItem.aggregate({
        where: { meetingId: meeting.id },
        _max: { sortOrder: true },
      });
      await tx.meetingAgendaItem.create({
        data: {
          meetingId: meeting.id,
          sortOrder: (max._max.sortOrder ?? -1) + 1,
          title: titel,
          description: text,
          type: "BESCHLUSS",
          resolutionId: resolution.id,
        },
      });
    });
    revalidatePath(`/versammlungen/${meeting.id}`);
    redirect(`/versammlungen/${meeting.id}?flash=erstellt`);
  }

  // Umlaufbeschluss: Allstimmigkeit ist hier gesetzlich zwingend.
  await db.resolution.create({
    data: {
      propertyId: property.id,
      title: titel,
      description: text,
      majority: "ALLSTIMMIG",
      createdById: verwalter.id,
      organizationId: verwalter.organizationId,
    },
  });
  revalidatePath("/beschluesse");
  redirect("/beschluesse?flash=erstellt");
}
