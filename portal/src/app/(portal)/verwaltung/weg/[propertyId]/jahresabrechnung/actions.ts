"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { AUDIT, logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { parseEuroToCents } from "@/lib/money";
import { requireVerwalter } from "@/lib/session";
import { planErlaubt } from "@/lib/plan-guard";
import { computeStatementView } from "@/lib/weg/statement-service";
import { buildEinzelabrechnungPdf } from "@/lib/weg/einzelabrechnung-pdf";
import { legeEigentuemerDokumenteAb } from "@/lib/weg/owner-documents";
import { matchHeatingRows, parseHeatingCsv } from "@/lib/weg/heating-import";
import { loadWegProperty } from "@/lib/weg/scope";
import { advanceWeightsForKey, fiscalYearRange } from "@/lib/weg/economic-plan";
import { distributeByWeight } from "@/lib/weg/distribution";
import { isValidHeatingPercent, splitHeatingCosts } from "@/lib/weg/heating-costs";
import { NOT_REVERSED } from "@/lib/weg/booking-scope";
import { consumptionInPeriod } from "@/lib/weg/meter-distribution";

const METER_TYPES = ["STROM", "GAS", "WASSER_KALT", "WASSER_WARM", "HEIZUNG", "SONSTIGES"] as const;

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

// ── Verbrauchsabhängige Verteilung aus Zählern (Notiz 4, Etappe 2) ──────────
// Verteilt die Gesamtkosten einer (Verbrauchs-)Kostenart centgenau nach dem
// Verbrauch je Einheit (Endstand − Anfangsstand der Einzelzähler im
// Wirtschaftsjahr) und schreibt das Ergebnis in die manuellen Einzelbeträge.
// Der Verwalter kann die Werte anschließend prüfen/anpassen (Entwurf bleibt offen).
export async function distributeByMeters(formData: FormData) {
  const verwalter = await requireVerwalter();
  const propertyId = String(formData.get("propertyId") ?? "");
  const statementId = String(formData.get("statementId") ?? "");
  const costTypeId = String(formData.get("costTypeId") ?? "");
  const meterTypeRaw = String(formData.get("meterType") ?? "");

  const property = await loadWegProperty(verwalter, propertyId);
  if (!property) redirect("/verwaltung/weg");
  const statement = await loadStatement(verwalter.organizationId, property.id, statementId);
  if (!statement) back(property.id);
  if (statement.status !== "ENTWURF") back(property.id, `/${statement.id}`, "fehler=fertig");
  if (!(METER_TYPES as readonly string[]).includes(meterTypeRaw)) {
    back(property.id, `/${statement.id}`, "fehler=zaehlerart");
  }
  const meterType = meterTypeRaw as (typeof METER_TYPES)[number];

  const costType = await db.costType.findFirst({
    where: { id: costTypeId, propertyId: property.id },
    select: { id: true, heatingCost: true },
  });
  if (!costType) back(property.id, `/${statement.id}`, "fehler=kostenart");

  // HeizkostenV: Bei Heiz-/Warmwasserkosten ist die reine Zählerverteilung
  // unzulässig (§§ 7 Abs. 1, 8 Abs. 1). Der Verbrauchsanteil kommt aus dem
  // Formular und muss zwischen 50 und 70 Prozent liegen.
  let consumptionPercent = 100;
  if (costType.heatingCost) {
    consumptionPercent = Number(String(formData.get("consumptionPercent") ?? ""));
    if (!isValidHeatingPercent(consumptionPercent)) {
      back(property.id, `/${statement.id}`, "fehler=heizanteil");
    }
  }

  const { start, end } = fiscalYearRange(statement.year, property.fiscalYearStartMonth);

  // Zu verteilen ist nur, was aus dem laufenden Konto bezahlt wurde. Ausgaben
  // aus der Erhaltungsrücklage werden in der Abrechnung nicht umgelegt (siehe
  // `computeStatement`); zählte man sie hier mit, ergäbe die Verteilung eine
  // Summe, die die Abrechnung anschließend als „unvollständig" zurückweist.
  const totalAgg = await db.booking.aggregate({
    where: {
      propertyId: property.id,
      kind: "AUSGABE",
      costTypeId: costType.id,
      bookingDate: { gte: start, lt: end },
      account: { kind: { not: "RUECKLAGE" } },
      ...NOT_REVERSED,
    },
    _sum: { amountCents: true },
  });
  const totalCents = totalAgg._sum.amountCents ?? 0;
  if (totalCents <= 0) back(property.id, `/${statement.id}`, "fehler=keinekosten");

  // Verbrauch je Einheit aus ihren Einzelzählern dieser Art (mehrere Zähler je
  // Einheit werden summiert). Allgemeinzähler (ohne unitId) zählen hier nicht.
  const units = await db.unit.findMany({
    where: { propertyId: property.id },
    select: { id: true, mea: true, livingArea: true, personCount: true },
  });
  const meters = await db.meter.findMany({
    where: { unitId: { in: units.map((u) => u.id) }, type: meterType },
    select: { unitId: true, readings: { select: { value: true, readingDate: true } } },
  });
  const consumptionByUnit = new Map<string, number>();
  for (const m of meters) {
    if (!m.unitId) continue;
    const c = consumptionInPeriod(
      m.readings.map((r) => ({ value: r.value, date: r.readingDate })),
      start,
      end,
    );
    consumptionByUnit.set(m.unitId, (consumptionByUnit.get(m.unitId) ?? 0) + c);
  }
  const weights = units.map((u) => ({ unitId: u.id, weight: consumptionByUnit.get(u.id) ?? 0 }));
  const totalConsumption = weights.reduce((s, w) => s + w.weight, 0);
  if (totalConsumption <= 0) back(property.id, `/${statement.id}`, "fehler=keinverbrauch");

  // Ohne HeizkostenV-Kennzeichnung bleibt es bei der reinen Zählerverteilung —
  // für Kaltwasser oder Allgemeinstrom ist genau das richtig.
  let distributed: Map<string, number>;
  if (costType.heatingCost) {
    try {
      distributed = splitHeatingCosts({
        totalCents,
        consumptionPercent,
        consumptionWeights: weights,
        // Grundkosten nach Wohnfläche — bewusst die nachsichtige Gewichtung:
        // Ein Stellplatz hat keine Wohnfläche und wird auch nicht beheizt, er
        // trägt also zu Recht null Grundkosten. Die strenge Variante bräche
        // hier ab und machte die Funktion für jede WEG mit Garagen unbrauchbar.
        // Fehlt die Fläche bei *allen* Einheiten, schlägt die Verteilung fehl
        // und landet im catch unten.
        areaWeights: advanceWeightsForKey(units, "FLAECHE"),
      }).perUnit;
      // Den angewandten Anteil festhalten: Nur so kann die Abrechnung später
      // „70 % Verbrauch, 30 % Wohnfläche" ausweisen statt bloß „Verbrauch".
      await db.costType.update({
        where: { id: costType.id },
        data: { heatingConsumptionPercent: consumptionPercent },
      });
    } catch {
      back(property.id, `/${statement.id}`, "fehler=flaeche");
    }
  } else {
    distributed = distributeByWeight(totalCents, weights);
  }
  const writes = units.map((u) =>
    db.statementUnitAmount.upsert({
      where: {
        statementId_costTypeId_unitId: {
          statementId: statement.id,
          costTypeId: costType.id,
          unitId: u.id,
        },
      },
      update: { amountCents: distributed.get(u.id) ?? 0 },
      create: {
        statementId: statement.id,
        costTypeId: costType.id,
        unitId: u.id,
        amountCents: distributed.get(u.id) ?? 0,
      },
    }),
  );
  await db.$transaction(writes);
  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_STATEMENT_SAVED,
    targetType: "AnnualStatement",
    targetId: statement.id,
    meta: { meterDistributedCostType: costType.id, meterType, consumptionPercent },
  });
  revalidatePath(`/verwaltung/weg/${property.id}/jahresabrechnung/${statement.id}`);
  back(property.id, `/${statement.id}`, "gespeichert=zaehler");
}

// ── Messdienst-Datei-Import (Heizkosten je Einheit, M-H) ─────────────────────
// Liest eine CSV-Datei des Messdienstes (ista/Techem/…) ein und ordnet die
// Beträge den Einheiten zu (anbieter-unabhängig, Zero-Key). Nicht zuordenbare
// Zeilen werden gemeldet, nicht stillschweigend verworfen.
export async function importHeatingAmounts(formData: FormData) {
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

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) back(property.id, `/${statement.id}`, "fehler=datei");
  // Nur CSV/Text — großzügig, aber keine Binärdateien.
  if (file.size > 2 * 1024 * 1024) back(property.id, `/${statement.id}`, "fehler=datei");
  const content = await file.text();
  const parsed = parseHeatingCsv(content);
  if (!parsed.ok) back(property.id, `/${statement.id}`, `fehler=${parsed.error === "spalten" ? "import_spalten" : "import_leer"}`);

  const units = await db.unit.findMany({
    where: { propertyId: property.id },
    select: { id: true, label: true },
  });
  const match = matchHeatingRows(units, parsed.rows);
  if (match.matched.length > 0) {
    await db.$transaction(
      match.matched.map((m) =>
        db.statementUnitAmount.upsert({
          where: {
            statementId_costTypeId_unitId: { statementId: statement.id, costTypeId: costType.id, unitId: m.unitId },
          },
          update: { amountCents: m.amountCents },
          create: { statementId: statement.id, costTypeId: costType.id, unitId: m.unitId, amountCents: m.amountCents },
        }),
      ),
    );
  }
  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_STATEMENT_SAVED,
    targetType: "AnnualStatement",
    targetId: statement.id,
    meta: { heatingImport: costType.id, matched: match.matched.length, unmatched: match.unmatchedRows.length },
  });
  revalidatePath(`/verwaltung/weg/${property.id}/jahresabrechnung/${statement.id}`);
  back(property.id, `/${statement.id}`, `importiert=${match.matched.length}&offen=${match.unmatchedRows.length}`);
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
  if (!(await planErlaubt("vollerUmfang"))) redirect("/verwaltung/weg?flash=nur-mit-tarif");
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

  const finalizedAt = new Date();
  await db.annualStatement.update({
    where: { id: statement.id },
    data: {
      status: "FERTIG",
      finalizedAt,
      snapshot: view as unknown as Prisma.InputJsonValue,
    },
  });

  // Jede Einheit bekommt ihre Einzelabrechnung in die Dokumente gelegt —
  // gezielt an ihre Eigentümer. Der Zeitpunkt ist bewusst dieser: Die
  // Abrechnung ist jetzt versandfertig, und die Eigentümer müssen sie **vor**
  // der Versammlung prüfen können, weil dort über die Abrechnungsspitze
  // beschlossen wird (§ 28 Abs. 2 Satz 1 WEG). Erst danach zu verteilen wäre
  // zu spät.
  //
  // Schlägt die Ablage fehl, bleibt die Abrechnung fertiggestellt: Das
  // Einfrieren ist der fachliche Vorgang, die Ablage nur seine Folge. Der
  // Verwalter sieht eine Warnung und kann sie über `wiederholeAblage` erneut
  // anstoßen — dank `refPrefix` entstehen dabei keine Dubletten.
  let ablage: Awaited<ReturnType<typeof legeEigentuemerDokumenteAb>> | null = null;
  try {
    ablage = await verteileEinzelabrechnungen(property, statement.id, statement.year, view, finalizedAt, verwalter.id);
  } catch (err) {
    console.error("Ablage der Einzelabrechnungen fehlgeschlagen", err);
  }
  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_STATEMENT_FINALIZED,
    targetType: "AnnualStatement",
    targetId: statement.id,
    meta: {
      year: statement.year,
      totalExpenseCents: view.totalExpenseCents,
      dokumenteAbgelegt: ablage ? ablage.erstellt + ablage.ersetzt : 0,
      ohneEigentuemer: ablage?.uebersprungen.length ?? 0,
    },
  });
  revalidatePath(`/verwaltung/weg/${property.id}/jahresabrechnung/${statement.id}`);
  back(
    property.id,
    `/${statement.id}`,
    ablage
      ? `fertig=1&abgelegt=${ablage.erstellt + ablage.ersetzt}&ohne=${ablage.uebersprungen.length}`
      : "fertig=1&ablage=fehler",
  );
}

// Erzeugt je Einheit die Einzelabrechnung und legt sie ab. Ausgelagert, damit
// `finalizeStatement` lesbar bleibt.
// ── Ablage der Einzelabrechnungen wiederholen ────────────────────────────────
// Die Ablage ist die Folge des Fertigstellens, nicht sein Kern: Schlägt sie
// fehl (Speicher weg, Verbindung ab), bleibt die Abrechnung fertiggestellt und
// die Dokumente fehlen. Ohne diesen Knopf gäbe es keinen Weg zurück, weil
// `finalizeStatement` nur für Entwürfe läuft.
//
// Zweiter, häufigerer Fall: Beim Fertigstellen war für eine Einheit kein
// Eigentümer erfasst; sie wurde übersprungen. Nachtragen und hier erneut
// auslösen — die vorhandenen Dokumente werden dabei ersetzt, nicht verdoppelt.
//
// Gerechnet wird bewusst aus dem **Snapshot**, nicht neu: Eine fertige
// Abrechnung ist eingefroren. Würde hier neu gerechnet, bekämen die Eigentümer
// nach einer späteren Buchung andere Zahlen als in der Fassung, über die die
// Versammlung beschlossen hat.
export async function wiederholeAblage(formData: FormData) {
  const verwalter = await requireVerwalter();
  const propertyId = String(formData.get("propertyId") ?? "");
  const statementId = String(formData.get("statementId") ?? "");
  const property = await loadWegProperty(verwalter, propertyId);
  if (!property) redirect("/verwaltung/weg");
  const statement = await loadStatement(verwalter.organizationId, property.id, statementId);
  if (!statement) back(property.id);
  if (statement.status !== "FERTIG" || !statement.snapshot) {
    back(property.id, `/${statement.id}`, "fehler=nichtfertig");
  }

  let ablage: Awaited<ReturnType<typeof legeEigentuemerDokumenteAb>>;
  try {
    ablage = await verteileEinzelabrechnungen(
      property,
      statement.id,
      statement.year,
      statement.snapshot as unknown as Awaited<ReturnType<typeof computeStatementView>>,
      statement.finalizedAt ?? statement.createdAt,
      verwalter.id,
    );
  } catch (err) {
    console.error("Wiederholte Ablage der Einzelabrechnungen fehlgeschlagen", err);
    back(property.id, `/${statement.id}`, "fehler=ablage");
  }
  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_STATEMENT_DOCUMENTS_RETRIED,
    targetType: "AnnualStatement",
    targetId: statement.id,
    meta: {
      year: statement.year,
      abgelegt: ablage.erstellt + ablage.ersetzt,
      ohneEigentuemer: ablage.uebersprungen.length,
    },
  });
  revalidatePath(`/verwaltung/weg/${property.id}/jahresabrechnung/${statement.id}`);
  back(
    property.id,
    `/${statement.id}`,
    `abgelegt=${ablage.erstellt + ablage.ersetzt}&ohne=${ablage.uebersprungen.length}`,
  );
}

async function verteileEinzelabrechnungen(
  property: { id: string; name: string; organizationId: string },
  statementId: string,
  year: number,
  view: Awaited<ReturnType<typeof computeStatementView>>,
  finalizedAt: Date,
  uploadedById: string,
) {
  const units = await db.unit.findMany({
    where: { propertyId: property.id },
    orderBy: [{ orderIndex: "asc" }, { label: "asc" }],
    select: { id: true, label: true },
  });
  const documents = await Promise.all(
    units.map(async (u) => ({
      unitId: u.id,
      unitLabel: u.label,
      title: `Einzelabrechnung ${year} — ${u.label}`,
      fileName: `Einzelabrechnung_${year}_${u.label.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`,
      pdf: await buildEinzelabrechnungPdf({
        propertyName: property.name,
        organizationId: property.organizationId,
        view,
        units: [u],
        finalizedAt,
      }),
    })),
  );
  return legeEigentuemerDokumenteAb({
    organizationId: property.organizationId,
    propertyId: property.id,
    uploadedById,
    category: "ABRECHNUNG",
    refPrefix: `weg-einzelabrechnung:${statementId}`,
    documents,
  });
}
