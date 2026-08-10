"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { DueDayRule } from "@/generated/prisma/client";
import { AUDIT, logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { parseEuroToCents } from "@/lib/money";
import { requireVerwalter } from "@/lib/session";
import { planErlaubt } from "@/lib/plan-guard";
import { computeUnitAdvances, fiscalYearRange } from "@/lib/weg/economic-plan";
import { synchronisiereSollstellungen } from "@/lib/weg/due-postings";
import { faelligkeitsText, monatsBeginn } from "@/lib/weg/plan-validity";
import { ablageFehlerText } from "@/lib/weg/ablage-fehler";
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
  // Plan-Sperre: Arbeitsfunktion — im Start-Umfang (einrichten + ansehen)
  // nicht enthalten; Umfang je Tarif siehe PLAN_FUNKTIONEN in lib/billing.ts.
  if (!(await planErlaubt("vollerUmfang"))) redirect("/verwaltung/weg?flash=nur-mit-tarif");
  const parsed = createSchema.safeParse({
    propertyId: formData.get("propertyId"),
    year: formData.get("year"),
  });
  if (!parsed.success) redirect("/verwaltung/weg");
  const property = await loadWegProperty(verwalter, parsed.data.propertyId);
  if (!property) redirect("/verwaltung/weg");

  // Ein **Entwurf** desselben Jahres wird weitergeführt statt verdoppelt — zwei
  // halb ausgefüllte Entwürfe nebeneinander sind nur verwirrend. Ein bereits
  // beschlossener Plan steht einem neuen dagegen nicht im Weg: Das ist der
  // geänderte Wirtschaftsplan, der unterjährig greift.
  const offenerEntwurf = await db.economicPlan.findFirst({
    where: { propertyId: property.id, year: parsed.data.year, status: "ENTWURF" },
    select: { id: true },
  });
  if (offenerEntwurf) back(property.id, `/${offenerEntwurf.id}`);

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

/**
 * Gleicht die Pläne ab, deren Geltung gerade beendet wurde.
 *
 * Ihr Geltungszeitraum endet mit dem Beginn des neuen Plans; alle
 * Sollstellungen jenseits dieser Grenze tragen sie nicht mehr. Der Abgleich
 * räumt sie weg — aber nur, soweit sie noch nicht fällig waren. Was ein
 * Eigentümer im März schuldete, schuldete er, auch wenn im Juli ein neuer Plan
 * beschlossen wird.
 */
async function abgleicheVorgaenger(
  organizationId: string,
  property: {
    id: string;
    fiscalYearStartMonth: number;
    dueDayRule: DueDayRule;
    dueDayOfMonth: number | null;
  },
  neuerPlanId: string,
) {
  const vorgaenger = await db.economicPlan.findMany({
    where: {
      propertyId: property.id,
      status: "BESCHLOSSEN",
      id: { not: neuerPlanId },
      validFrom: { not: null },
      validUntil: { not: null },
    },
    include: { items: { include: { costType: true } } },
  });
  if (vorgaenger.length === 0) return;
  const units = await db.unit.findMany({
    where: { propertyId: property.id },
    select: { id: true, label: true, mea: true, livingArea: true, personCount: true, unitType: true },
  });
  for (const v of vorgaenger) {
    try {
      await synchronisiereSollstellungen({
        organizationId,
        property,
        planId: v.id,
        geltung: { validFrom: v.validFrom!, validUntil: v.validUntil, year: v.year },
        items: v.items.map((i) => ({
          costTypeId: i.costTypeId,
          distributionKey: i.costType.distributionKey,
          amountCents: i.amountCents,
          category: i.costType.category,
        })),
        units,
      });
    } catch (err) {
      // Ein alter Plan, dessen Verteilung sich heute nicht mehr rechnen lässt
      // (Einheit ohne MEA hinzugekommen), darf den neuen Beschluss nicht
      // blockieren. Seine künftigen Sollstellungen bleiben dann stehen und
      // fallen im Hausgeld auf.
      console.error("Abgleich des Vorgängerplans fehlgeschlagen", v.id, err);
    }
  }
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

  // Erst ALLE Zeilen ansehen, dann speichern — und die unlesbaren nur melden,
  // nicht die lesbaren mitreißen.
  //
  // Vorher brach die Schleife beim ersten unlesbaren Betrag mit einer
  // Weiterleitung ab. Gespeichert wurde dabei nichts (das `update` steht hinter
  // der Schleife), und die Seite rendert die Felder wieder aus der Datenbank:
  // Wer neun Positionen eintippte und sich bei der letzten vertippte, verlor
  // alle neun. Ein Tippfehler darf höchstens die eine Zeile kosten, in der er
  // steht.
  const updates: { id: string; amountCents: number }[] = [];
  const unlesbar: string[] = [];
  for (const item of plan.items) {
    const raw = String(formData.get(`item_${item.id}`) ?? "").trim();
    if (raw === "") continue;
    const cents = parseEuroToCents(raw);
    if (cents === null) {
      unlesbar.push(item.costType?.name ?? item.id);
      continue;
    }
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
    meta: { updatedItems: updates.length, unlesbar: unlesbar.length },
  });
  revalidatePath(`/verwaltung/weg/${property.id}/wirtschaftsplan/${plan.id}`);
  if (unlesbar.length > 0) {
    // Die lesbaren Werte stehen jetzt in der Datenbank und damit wieder in den
    // Feldern; die Meldung nennt genau die Positionen, die noch fehlen.
    back(
      property.id,
      `/${plan.id}`,
      `fehler=betrag&positionen=${encodeURIComponent(unlesbar.slice(0, 8).join(", "))}`,
    );
  }
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
  // Ab wann der Plan gilt. Leer = Beginn seines Wirtschaftsjahres, der
  // Normalfall. Gesetzt wird das Feld für den unterjährig **geänderten**
  // Wirtschaftsplan: Steigen die Kosten im Sommer, greift der neue Plan ab
  // einem Monat mitten im Jahr, und die Monate davor bleiben, wie sie waren.
  validFrom: z.string().optional(),
});

export async function resolvePlan(formData: FormData) {
  const verwalter = await requireVerwalter();
  if (!(await planErlaubt("vollerUmfang"))) redirect("/verwaltung/weg?flash=nur-mit-tarif");
  const parsed = resolveSchema.safeParse({
    propertyId: formData.get("propertyId"),
    planId: formData.get("planId"),
    resolvedAt: formData.get("resolvedAt"),
    resolutionNote: String(formData.get("resolutionNote") ?? "") || undefined,
    validFrom: String(formData.get("validFrom") ?? "") || undefined,
  });
  if (!parsed.success) redirect("/verwaltung/weg");
  const property = await loadWegProperty(verwalter, parsed.data.propertyId);
  if (!property) redirect("/verwaltung/weg");
  const plan = await loadPlan(verwalter, property.id, parsed.data.planId);
  if (!plan) back(property.id);
  if (plan.status !== "ENTWURF") back(property.id, `/${plan.id}`, "fehler=beschlossen");

  const resolvedAt = new Date(parsed.data.resolvedAt);
  if (isNaN(resolvedAt.getTime())) back(property.id, `/${plan.id}`, "fehler=datum");

  // Geltungsbeginn: normalerweise der Beginn des Wirtschaftsjahres. Ein
  // abweichender Beginn muss auf einen Monatsersten fallen — Sollstellungen
  // sind Monatsraten, ein Wechsel zum 17. hätte keine.
  const fyStart = fiscalYearRange(plan.year, property.fiscalYearStartMonth).start;
  let validFrom = fyStart;
  if (parsed.data.validFrom) {
    const gewaehlt = new Date(parsed.data.validFrom);
    if (isNaN(gewaehlt.getTime()) || gewaehlt.getUTCDate() !== 1) {
      back(property.id, `/${plan.id}`, "fehler=geltungsbeginn");
    }
    validFrom = gewaehlt;
  }

  // Verdrängt der neue Plan einen bereits beschlossenen, darf er nicht in der
  // Vergangenheit beginnen. Sonst würde rückwirkend geändert, was ein
  // Eigentümer im März schuldete — und die Sollstellungen des Vorgängers, die
  // längst bezahlt oder gemahnt sein können, müssten dafür weichen. Ein
  // Beschluss wirkt nach vorn.
  //
  // Der Normalfall bleibt erlaubt: Tagt die Versammlung im April über den Plan
  // des laufenden Jahres, gibt es keinen Vorgänger für Januar — die Forderungen
  // entstehen nachträglich, wie § 28 Abs. 1 Satz 2 WEG es vorsieht.
  const jetzt = new Date();
  const monatsBeginnJetzt = monatsBeginn({
    year: jetzt.getUTCFullYear(),
    month: jetzt.getUTCMonth() + 1,
  });
  if (validFrom < monatsBeginnJetzt) {
    const vorgaengerDeckt = await db.economicPlan.findFirst({
      where: {
        propertyId: property.id,
        status: "BESCHLOSSEN",
        id: { not: plan.id },
        validFrom: { lte: validFrom },
        OR: [{ validUntil: null }, { validUntil: { gt: validFrom } }],
      },
      select: { id: true },
    });
    if (vorgaengerDeckt) back(property.id, `/${plan.id}`, "fehler=rueckwirkend");
  }

  const units = await db.unit.findMany({
    where: { propertyId: property.id },
    select: { id: true, label: true, mea: true, livingArea: true, personCount: true, unitType: true },
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

  // Vorgänger abgrenzen: Alle bisher fortgeltenden Pläne dieses Objekts enden
  // dort, wo der neue beginnt. Ohne diesen Schritt trügen zwei Pläne dieselben
  // Monate und der Eigentümer schuldete sein Hausgeld doppelt.
  await db.economicPlan.updateMany({
    where: {
      propertyId: property.id,
      status: "BESCHLOSSEN",
      id: { not: plan.id },
      validFrom: { lt: validFrom },
      OR: [{ validUntil: null }, { validUntil: { gt: validFrom } }],
    },
    data: { validUntil: validFrom },
  });

  await db.economicPlan.update({
    where: { id: plan.id },
    data: {
      status: "BESCHLOSSEN",
      resolvedAt,
      resolutionNote: parsed.data.resolutionNote ?? null,
      validFrom,
      validUntil: null,
    },
  });

  // Sollstellungen abgleichen statt löschen und neu anlegen: Eine bereits
  // fällige Forderung kann bezahlt oder gemahnt sein — sie verschwinden zu
  // lassen, verfälschte die Historie. Siehe `synchronisiereSollstellungen`.
  const abgleich = await synchronisiereSollstellungen({
    organizationId: verwalter.organizationId,
    property,
    planId: plan.id,
    geltung: { validFrom, validUntil: null, year: plan.year },
    items: plan.items.map((i) => ({
      costTypeId: i.costTypeId,
      distributionKey: i.costType.distributionKey,
      amountCents: i.amountCents,
      category: i.costType.category,
    })),
    units,
  });

  // Der Vorgänger trägt seine Monate ab dem Wechsel nicht mehr. Sein Abgleich
  // räumt die noch nicht fälligen Sollstellungen weg — die bereits fälligen
  // bleiben, denn sie waren geschuldet.
  await abgleicheVorgaenger(verwalter.organizationId, property, plan.id);
  // Jeder Eigentümer bekommt seinen Einzelwirtschaftsplan in die Dokumente
  // gelegt. Der Beschluss ist der richtige Moment: Erst er macht die Vorschüsse
  // fällig (§ 28 Abs. 1 WEG), und dies ist die Fassung, die der Eigentümer
  // aufbewahrt — „ab Januar zahle ich X, so setzt es sich zusammen".
  //
  // Ein Fehler bei der Ablage nimmt den Beschluss nicht zurück: Der Beschluss
  // und seine Sollstellungen sind der fachliche Vorgang, die Ablage die Folge.
  //
  // Der Grund des Fehlschlags geht als Klartext mit zurück. Vorher stand er
  // allein im Server-Log: Die Oberfläche meldete „konnten nicht abgelegt
  // werden" — ohne Ursache und ohne Weg nach vorn. Über `wiederholeAblage`
  // lässt sich der Schritt nachholen, ohne erneut zu beschließen.
  let ablage: Awaited<ReturnType<typeof legeEigentuemerDokumenteAb>> | null = null;
  let ablageFehler: string | null = null;
  try {
    ablage = await verteileEinzelwirtschaftsplaene(
      { id: property.id, name: property.name },
      verwalter.organizationId,
      plan.id,
      verwalter.id,
    );
  } catch (err) {
    console.error("Ablage der Einzelwirtschaftspläne fehlgeschlagen", err);
    ablageFehler = ablageFehlerText(err);
  }

  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_PLAN_RESOLVED,
    targetType: "EconomicPlan",
    targetId: plan.id,
    meta: {
      year: plan.year,
      totalCents: advances.totalCents,
      validFrom,
      sollstellungen: abgleich,
      dokumenteAbgelegt: ablage ? ablage.erstellt + ablage.ersetzt : 0,
    },
  });
  revalidatePath(`/verwaltung/weg/${property.id}/wirtschaftsplan/${plan.id}`);
  back(
    property.id,
    `/${plan.id}`,
    ablage
      ? `beschlossen=1&abgelegt=${ablage.erstellt + ablage.ersetzt}&ohne=${ablage.uebersprungen.length}`
      : `beschlossen=1&ablage=fehler&grund=${encodeURIComponent(ablageFehler ?? "")}`,
  );
}

/**
 * Erzeugt je Einheit den Einzelwirtschaftsplan und legt ihn bei den aktuellen
 * Eigentümern ab.
 *
 * Ausgelagert, weil zwei Wege hierher führen: das Beschließen und die
 * Wiederholung. Gerechnet wird dabei bewusst aus dem **beschlossenen** Plan,
 * frisch aus der Datenbank — ein Entwurfsstand hat in einem Dokument nichts zu
 * suchen, das der Eigentümer aufbewahrt.
 */
async function verteileEinzelwirtschaftsplaene(
  property: { id: string; name: string },
  organizationId: string,
  planId: string,
  uploadedById: string,
) {
  const beschlossen = await db.economicPlan.findFirstOrThrow({
    where: { id: planId },
    include: { items: { include: { costType: true }, orderBy: { costType: { orderIndex: "asc" } } } },
  });
  const alleEinheiten = await db.unit.findMany({
    where: { propertyId: property.id },
    orderBy: [{ orderIndex: "asc" }, { label: "asc" }],
  });
  const namen = await ownerNamesByUnit(alleEinheiten.map((u) => u.id));
  return legeEigentuemerDokumenteAb({
    organizationId,
    propertyId: property.id,
    uploadedById,
    category: "ABRECHNUNG",
    refPrefix: `weg-einzelwirtschaftsplan:${planId}`,
    documents: await Promise.all(
      alleEinheiten.map(async (u) => ({
        unitId: u.id,
        unitLabel: u.label,
        title: `Einzelwirtschaftsplan ${beschlossen.year} — ${u.label}`,
        fileName: `Einzelwirtschaftsplan_${beschlossen.year}_${u.label.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`,
        pdf: await buildEinzelwirtschaftsplanPdf({
          propertyName: property.name,
          organizationId,
          plan: beschlossen,
          units: alleEinheiten,
          ownerNamesByUnit: namen,
          onlyUnitIds: [u.id],
        }),
      })),
    ),
  });
}

// ── Ablage der Einzelwirtschaftspläne wiederholen ────────────────────────────
// Die Ablage ist die Folge des Beschlusses, nicht sein Kern. Schlägt sie fehl
// (Dateiablage weg, Verbindung ab), bleibt der Plan beschlossen und die
// Dokumente fehlen — und `resolvePlan` läuft nur für Entwürfe, es gäbe also
// keinen Weg zurück. Dieselbe Lage entsteht, wenn beim Beschließen für eine
// Einheit kein Eigentümer erfasst war: nachtragen und hier erneut auslösen.
//
// Dank `refPrefix` ersetzt ein zweiter Lauf die vorhandenen Dokumente, statt
// sie zu verdoppeln — die Wiederholung ist damit gefahrlos.
export async function wiederholeAblage(formData: FormData) {
  const verwalter = await requireVerwalter();
  if (!(await planErlaubt("vollerUmfang"))) redirect("/verwaltung/weg?flash=nur-mit-tarif");
  const propertyId = String(formData.get("propertyId") ?? "");
  const planId = String(formData.get("planId") ?? "");
  const property = await loadWegProperty(verwalter, propertyId);
  if (!property) redirect("/verwaltung/weg");
  const plan = await db.economicPlan.findFirst({
    where: { id: planId, propertyId: property.id },
    select: { id: true, year: true, status: true },
  });
  if (!plan) back(property.id);
  if (plan.status !== "BESCHLOSSEN") back(property.id, `/${plan.id}`, "fehler=nichtbeschlossen");

  let ablage: Awaited<ReturnType<typeof legeEigentuemerDokumenteAb>>;
  try {
    ablage = await verteileEinzelwirtschaftsplaene(
      { id: property.id, name: property.name },
      verwalter.organizationId,
      plan.id,
      verwalter.id,
    );
  } catch (err) {
    console.error("Wiederholte Ablage der Einzelwirtschaftspläne fehlgeschlagen", err);
    back(
      property.id,
      `/${plan.id}`,
      `ablage=fehler&grund=${encodeURIComponent(ablageFehlerText(err))}`,
    );
  }
  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_PLAN_DOCUMENTS_RETRIED,
    targetType: "EconomicPlan",
    targetId: plan.id,
    meta: {
      year: plan.year,
      abgelegt: ablage.erstellt + ablage.ersetzt,
      ohneEigentuemer: ablage.uebersprungen.length,
    },
  });
  revalidatePath(`/verwaltung/weg/${property.id}/wirtschaftsplan/${plan.id}`);
  back(
    property.id,
    `/${plan.id}`,
    `abgelegt=${ablage.erstellt + ablage.ersetzt}&ohne=${ablage.uebersprungen.length}`,
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
    `je Einheit ergeben sich aus den Einzelwirtschaftsplänen und sind ` +
    `${faelligkeitsText(property.dueDayRule, property.dueDayOfMonth)} fällig.`;

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
