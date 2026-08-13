"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { MaintenanceInterval } from "@/generated/prisma/client";
import { AUDIT, logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { maintenanceIntervalLabels, maintenanceIntervalMonths } from "@/lib/labels";
import { requireVerwalter } from "@/lib/session";
import { addMonths } from "@/lib/weg/compliance";
import { WEG_COMPLIANCE_CATALOG } from "@/lib/weg/compliance-catalog";
import { loadWegProperty } from "@/lib/weg/scope";

// Form nach AGENTS.md: Name `backTo`, zweites Argument optional, das Suffix
// bringt sein `?` selbst mit.
function backTo(propertyId: string, suffix = ""): string {
  return `/verwaltung/weg/${propertyId}/pruefpflichten${suffix}`;
}

// Anker der Anlege-Karte – der Rücksprung landet sonst am Seitenanfang, und die
// Karte steht unter der Liste.
const ANKER_NEU = "#eigene-pflicht";

/**
 * Turnus aus dem Formular prüfen. Einzige Quelle der gültigen Werte ist der
 * Beschriftungs-Katalog in `labels.ts` — er ist ein `Record<MaintenanceInterval, …>`
 * und deckt damit den Enum vollständig ab, auch wenn dort ein Wert hinzukommt.
 */
function parseInterval(raw: string): MaintenanceInterval | null {
  return raw in maintenanceIntervalLabels ? (raw as MaintenanceInterval) : null;
}

// Übernimmt den Prüfpflichten-Katalog für ein Objekt. Idempotent: es werden nur
// Pflichten angelegt, die es (per catalogKey) für dieses Objekt noch nicht gibt —
// mehrfaches Klicken erzeugt keine Duplikate.
export async function adoptComplianceCatalog(formData: FormData) {
  const verwalter = await requireVerwalter();
  const propertyId = String(formData.get("propertyId") ?? "");
  const property = await loadWegProperty(verwalter, propertyId);
  if (!property) redirect("/verwaltung/weg");

  const existing = await db.maintenanceTask.findMany({
    where: { propertyId: property.id, catalogKey: { not: null } },
    select: { catalogKey: true },
  });
  const have = new Set(existing.map((t) => t.catalogKey));
  const toCreate = WEG_COMPLIANCE_CATALOG.filter((d) => !have.has(d.key));

  const now = new Date();
  if (toCreate.length > 0) {
    await db.maintenanceTask.createMany({
      data: toCreate.map((d) => ({
        organizationId: verwalter.organizationId,
        propertyId: property.id,
        title: d.title,
        description: d.description,
        interval: d.interval,
        dueDate: addMonths(now, d.initialDueMonths),
        catalogKey: d.key,
      })),
    });
  }

  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_PRUEFPFLICHT_CATALOG_ADOPTED,
    targetType: "Property",
    targetId: property.id,
    meta: { created: toCreate.length },
  });
  revalidatePath(`/verwaltung/weg/${property.id}/pruefpflichten`);
  revalidatePath("/dashboard");
  redirect(backTo(property.id, "?gespeichert=katalog"));
}

/**
 * Eigene Prüfpflicht anlegen — alles, was der Standardkatalog nicht kennt:
 * Fahrstuhl-Wartungsvertrag mit abweichendem Turnus, Tiefgaragentor, die
 * Zisterne. Fachlich derselbe Datensatz wie eine übernommene Pflicht, nur ohne
 * `catalogKey`; damit rechnet die Fälligkeitslogik unverändert weiter.
 *
 * Bis hierher gab es dafür nur den Umweg über den Jahresfahrplan auf der
 * Objekt-Übersicht — die Seite zeigte die Einträge an, sagte aber nirgends, wo
 * man sie anlegt.
 */
export async function createCompliance(formData: FormData) {
  const verwalter = await requireVerwalter();
  const propertyId = String(formData.get("propertyId") ?? "");
  const property = await loadWegProperty(verwalter, propertyId);
  if (!property) redirect("/verwaltung/weg");

  const title = String(formData.get("title") ?? "").trim().slice(0, 200);
  const description = String(formData.get("description") ?? "").trim().slice(0, 2000);
  const interval = parseInterval(String(formData.get("interval") ?? ""));
  const dueRaw = String(formData.get("dueDate") ?? "").trim();
  const due = new Date(dueRaw);

  if (title.length < 2) redirect(backTo(property.id, `?fehler=titel${ANKER_NEU}`));
  if (!interval) redirect(backTo(property.id, `?fehler=turnus${ANKER_NEU}`));
  if (!dueRaw || Number.isNaN(due.getTime()))
    redirect(backTo(property.id, `?fehler=datum${ANKER_NEU}`));

  const task = await db.maintenanceTask.create({
    data: {
      organizationId: verwalter.organizationId,
      propertyId: property.id,
      title,
      description: description || null,
      interval,
      dueDate: due,
      // Kein `catalogKey`: das unterscheidet die eigene Pflicht von einer
      // übernommenen.
    },
    select: { id: true },
  });

  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_PRUEFPFLICHT_CREATED,
    targetType: "MaintenanceTask",
    targetId: task.id,
    meta: { propertyId: property.id, interval },
  });
  revalidatePath(`/verwaltung/weg/${property.id}/pruefpflichten`);
  revalidatePath("/dashboard");
  redirect(backTo(property.id, `?gespeichert=erstellt${ANKER_NEU}`));
}

// Als erledigt markieren: nächste Fälligkeit im Turnus setzen (bzw. einmalige
// Pflicht abschließen). Rechnet ab dem bisherigen Fälligkeitsdatum, damit der
// Turnus nicht schleichend nach hinten wandert, wenn spät quittiert wird.
export async function completeCompliance(formData: FormData) {
  const verwalter = await requireVerwalter();
  const propertyId = String(formData.get("propertyId") ?? "");
  const id = String(formData.get("id") ?? "");
  const property = await loadWegProperty(verwalter, propertyId);
  if (!property) redirect("/verwaltung/weg");

  const task = await db.maintenanceTask.findFirst({
    where: { id, propertyId: property.id },
  });
  if (!task) redirect(backTo(property.id, "?fehler=nichtgefunden"));

  const months = maintenanceIntervalMonths[task.interval];
  const now = new Date();
  if (months === null) {
    await db.maintenanceTask.update({
      where: { id: task.id },
      data: { lastDoneAt: now, active: false },
    });
  } else {
    // Basis ist das spätere von bisheriger Fälligkeit und heute – so bleibt der
    // Turnus stabil, ohne eine Fälligkeit in der Vergangenheit zu erzeugen.
    const base = task.dueDate.getTime() > now.getTime() ? task.dueDate : now;
    await db.maintenanceTask.update({
      where: { id: task.id },
      data: { lastDoneAt: now, dueDate: addMonths(base, months), lastReminderAt: null },
    });
  }

  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_PRUEFPFLICHT_COMPLETED,
    targetType: "MaintenanceTask",
    targetId: task.id,
  });
  revalidatePath(`/verwaltung/weg/${property.id}/pruefpflichten`);
  revalidatePath("/dashboard");
  redirect(backTo(property.id, "?gespeichert=erledigt"));
}

/**
 * Einen Eintrag bearbeiten: Titel, Turnus, Beschreibung und Fälligkeit.
 *
 * Bis hierher ließ sich ausschließlich die Fälligkeit verschieben. Ein Tippfehler
 * im Titel oder ein Turnus, der laut Wartungsvertrag halbjährlich statt jährlich
 * läuft, war damit nur über Löschen und Neuanlegen zu berichtigen — also über den
 * Verlust der Historie (`lastDoneAt`).
 *
 * Der Titel bleibt auch bei Katalog-Einträgen änderbar: „Trinkwasserprüfung
 * (Legionellen, Strang A)" ist die Pflicht, die die Gemeinschaft tatsächlich hat.
 * Der `catalogKey` bleibt unberührt, damit die Übernahme idempotent bleibt.
 */
export async function updateCompliance(formData: FormData) {
  const verwalter = await requireVerwalter();
  const propertyId = String(formData.get("propertyId") ?? "");
  const id = String(formData.get("id") ?? "");
  const property = await loadWegProperty(verwalter, propertyId);
  if (!property) redirect("/verwaltung/weg");

  const anker = `#pflicht-${id}`;
  const title = String(formData.get("title") ?? "").trim().slice(0, 200);
  const description = String(formData.get("description") ?? "").trim().slice(0, 2000);
  const interval = parseInterval(String(formData.get("interval") ?? ""));
  const dueRaw = String(formData.get("dueDate") ?? "").trim();
  const due = new Date(dueRaw);

  if (title.length < 2) redirect(backTo(property.id, `?fehler=titel${anker}`));
  if (!interval) redirect(backTo(property.id, `?fehler=turnus${anker}`));
  if (!dueRaw || Number.isNaN(due.getTime()))
    redirect(backTo(property.id, `?fehler=datum${anker}`));

  const task = await db.maintenanceTask.findFirst({
    where: { id, propertyId: property.id },
    select: { id: true, dueDate: true },
  });
  if (!task) redirect(backTo(property.id, "?fehler=nichtgefunden"));

  await db.maintenanceTask.update({
    where: { id: task.id },
    data: {
      title,
      description: description || null,
      interval,
      dueDate: due,
      // Die Erinnerungssperre fällt nur, wenn sich die Fälligkeit wirklich
      // bewegt hat — sonst schickt eine Titelkorrektur eine zweite Mail.
      ...(task.dueDate.getTime() === due.getTime() ? {} : { lastReminderAt: null }),
    },
  });

  await logAudit({
    actorId: verwalter.id,
    action: AUDIT.WEG_PRUEFPFLICHT_UPDATED,
    targetType: "MaintenanceTask",
    targetId: task.id,
  });
  revalidatePath(`/verwaltung/weg/${property.id}/pruefpflichten`);
  revalidatePath("/dashboard");
  redirect(backTo(property.id, `?gespeichert=gespeichert${anker}`));
}

/**
 * „Trifft auf dieses Objekt nicht zu" — und der Weg zurück.
 *
 * Eine Gemeinschaft ohne Aufzug braucht die Aufzugsprüfung nicht im Fahrplan.
 * Löschen wäre dafür das falsche Werkzeug: Kommt der Aufzug später doch (Anbau,
 * Fehleinschätzung), ist die Pflicht samt Historie weg, und die Katalog-Übernahme
 * legt sie stumm wieder an. `active = false` blendet sie aus — aus Dashboard,
 * Erinnerungen und Fahrplan —, behält sie aber am Objekt.
 */
export async function setComplianceActive(formData: FormData) {
  const verwalter = await requireVerwalter();
  const propertyId = String(formData.get("propertyId") ?? "");
  const id = String(formData.get("id") ?? "");
  const aktiv = String(formData.get("aktiv") ?? "") === "1";
  const property = await loadWegProperty(verwalter, propertyId);
  if (!property) redirect("/verwaltung/weg");

  const task = await db.maintenanceTask.findFirst({
    where: { id, propertyId: property.id },
    select: { id: true },
  });
  if (!task) redirect(backTo(property.id, "?fehler=nichtgefunden"));

  await db.maintenanceTask.update({
    where: { id: task.id },
    // Die Erinnerungssperre wird beim Wiederaufnehmen zurückgesetzt: Eine
    // Pflicht, die währenddessen fällig geworden ist, soll wieder mahnen dürfen.
    data: aktiv ? { active: true, lastReminderAt: null } : { active: false },
  });

  await logAudit({
    actorId: verwalter.id,
    action: aktiv
      ? AUDIT.WEG_PRUEFPFLICHT_REACTIVATED
      : AUDIT.WEG_PRUEFPFLICHT_DEACTIVATED,
    targetType: "MaintenanceTask",
    targetId: task.id,
  });
  revalidatePath(`/verwaltung/weg/${property.id}/pruefpflichten`);
  revalidatePath("/dashboard");
  redirect(
    backTo(
      property.id,
      `?gespeichert=${aktiv ? "aufgenommen" : "ausgeblendet"}#nicht-zutreffend`,
    ),
  );
}

export async function deleteCompliance(formData: FormData) {
  const verwalter = await requireVerwalter();
  const propertyId = String(formData.get("propertyId") ?? "");
  const id = String(formData.get("id") ?? "");
  const property = await loadWegProperty(verwalter, propertyId);
  if (!property) redirect("/verwaltung/weg");

  const task = await db.maintenanceTask.findFirst({
    where: { id, propertyId: property.id },
    select: { id: true },
  });
  if (task) {
    await db.maintenanceTask.delete({ where: { id: task.id } }).catch(() => {});
    await logAudit({
      actorId: verwalter.id,
      action: AUDIT.WEG_PRUEFPFLICHT_DELETED,
      targetType: "MaintenanceTask",
      targetId: task.id,
    });
  }
  revalidatePath(`/verwaltung/weg/${property.id}/pruefpflichten`);
  revalidatePath("/dashboard");
  redirect(backTo(property.id, "?gespeichert=geloescht"));
}
