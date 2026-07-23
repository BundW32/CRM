"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { User } from "@/generated/prisma/client";
import { canVerwalterAccessProperty } from "@/lib/access";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";
import { parseEuroToCents } from "@/lib/money";
import { DOCUMENT_TYPES, IMAGE_TYPES, deleteBlob, saveUpload } from "@/lib/storage";
import { inviteOrLetter } from "@/lib/user-invite";
import { syncOwnerVotingWeights } from "@/lib/weg/mea-sync";

function optInt(raw: FormDataEntryValue | null): number | null {
  const v = String(raw ?? "").trim();
  if (!v) return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function optFloat(raw: FormDataEntryValue | null): number | null {
  const v = String(raw ?? "").trim().replace(",", ".");
  if (!v) return null;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function optStr(raw: FormDataEntryValue | null, max = 200): string | null {
  const v = String(raw ?? "").trim();
  return v ? v.slice(0, max) : null;
}

// Stammdaten eines bestehenden Objekts bearbeiten. Bewusst NUR die Objekt-Stammdaten
// (Adresse, Kennzahlen, Notizen) – Einheiten, Eigentümer und Mieter werden an ihren
// eigenen Stellen gepflegt. Die Verwaltungsart bleibt nach der Anlage unverändert
// (WEG/Mietverwaltung ist fundamental für Finanzen/Abstimmungen).
export async function updateObjekt(formData: FormData) {
  const actor = await requireVerwalter();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/verwaltung/objekte");
  // Org-/Zuständigkeits-Scope: kein Zugriff auf fremde Objekte (IDOR-Schutz).
  if (!(await canVerwalterAccessProperty(actor, id))) redirect("/verwaltung/objekte");

  const existing = await db.property.findFirst({
    where: { id, organizationId: actor.organizationId },
    select: { titleImageStoredName: true },
  });
  if (!existing) redirect("/verwaltung/objekte");

  const name = String(formData.get("name") ?? "").trim();
  const street = String(formData.get("street") ?? "").trim();
  const zip = String(formData.get("zip") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  if (!name || !street || !zip || !city) {
    redirect(`/verwaltung/objekte/${id}/bearbeiten?fehler=objekt`);
  }

  // Titelbild: neues Bild ersetzt, Häkchen entfernt es, sonst unverändert.
  // `titleImage` in den Update-Daten nur setzen, wenn sich etwas ändert.
  let titleImageUpdate: { titleImageStoredName: string | null } | Record<string, never> = {};
  let blobToDelete: string | null = null;
  const titleImageFile = formData.get("titleImage");
  const removeTitleImage = String(formData.get("removeTitleImage") ?? "") === "1";
  if (titleImageFile instanceof File && titleImageFile.size > 0) {
    try {
      const stored = (await saveUpload(titleImageFile, IMAGE_TYPES)).storedName;
      titleImageUpdate = { titleImageStoredName: stored };
      blobToDelete = existing.titleImageStoredName; // altes ersetzt
    } catch {
      // Bild-Fehler blockiert die Stammdaten-Änderung nicht.
    }
  } else if (removeTitleImage) {
    titleImageUpdate = { titleImageStoredName: null };
    blobToDelete = existing.titleImageStoredName;
  }

  // updateMany mit Org-Bindung: trifft garantiert nur das eigene Objekt.
  await db.property.updateMany({
    where: { id, organizationId: actor.organizationId },
    data: {
      name: name.slice(0, 200),
      street: street.slice(0, 200),
      zip: zip.slice(0, 20),
      city: city.slice(0, 200),
      buildYear: optInt(formData.get("buildYear")),
      livingArea: optFloat(formData.get("livingArea")),
      floors: optInt(formData.get("floors")),
      buildingType: optStr(formData.get("buildingType")),
      heatingType: optStr(formData.get("heatingType")),
      notes: optStr(formData.get("notes"), 2000),
      ...titleImageUpdate,
    },
  });

  // Altes Bild erst nach erfolgreichem Update entfernen (Blob-Store).
  if (blobToDelete) await deleteBlob(blobToDelete);

  revalidatePath("/verwaltung/objekte");
  redirect("/verwaltung/objekte?gespeichert=1");
}

// ── Einheiten-Verwaltung (aus dem Objekt heraus) ────────────────────────────
// Scope-Auflösung: die Einheit muss zu einem Objekt gehören, das der Verwalter
// bearbeiten darf. Gibt propertyId zurück (oder leitet weg).
async function requireUnitScope(actor: User, unitId: string): Promise<string> {
  const unit = await db.unit.findUnique({
    where: { id: unitId },
    select: { propertyId: true, property: { select: { organizationId: true } } },
  });
  if (!unit || unit.property.organizationId !== actor.organizationId) {
    redirect("/verwaltung/objekte");
  }
  if (!(await canVerwalterAccessProperty(actor, unit.propertyId))) {
    redirect("/verwaltung/objekte");
  }
  return unit.propertyId;
}

export async function addUnit(formData: FormData) {
  const actor = await requireVerwalter();
  const propertyId = String(formData.get("propertyId") ?? "").trim();
  if (!propertyId || !(await canVerwalterAccessProperty(actor, propertyId))) {
    redirect("/verwaltung/objekte");
  }
  const label = String(formData.get("label") ?? "").trim();
  if (!label) redirect(`/verwaltung/objekte/${propertyId}/bearbeiten?fehler=einheit`);

  const max = await db.unit.aggregate({ where: { propertyId }, _max: { orderIndex: true } });
  await db.unit.create({
    data: {
      propertyId,
      label: label.slice(0, 200),
      externalLabel: optStr(formData.get("externalLabel")),
      floor: optStr(formData.get("floor"), 50),
      livingArea: optFloat(formData.get("livingArea")),
      mea: optInt(formData.get("mea")),
      personCount: optInt(formData.get("personCount")),
      orderIndex: (max._max.orderIndex ?? 0) + 1,
    },
  });
  revalidatePath(`/verwaltung/objekte/${propertyId}/bearbeiten`);
  redirect(`/verwaltung/objekte/${propertyId}/bearbeiten?einheit=gespeichert`);
}

export async function updateUnit(formData: FormData) {
  const actor = await requireVerwalter();
  const unitId = String(formData.get("unitId") ?? "").trim();
  if (!unitId) redirect("/verwaltung/objekte");
  const propertyId = await requireUnitScope(actor, unitId);

  const label = String(formData.get("label") ?? "").trim();
  if (!label) redirect(`/verwaltung/objekte/${propertyId}/bearbeiten?fehler=einheit`);

  await db.unit.update({
    where: { id: unitId },
    data: {
      label: label.slice(0, 200),
      externalLabel: optStr(formData.get("externalLabel")),
      floor: optStr(formData.get("floor"), 50),
      livingArea: optFloat(formData.get("livingArea")),
      mea: optInt(formData.get("mea")),
      personCount: optInt(formData.get("personCount")),
    },
  });
  revalidatePath(`/verwaltung/objekte/${propertyId}/bearbeiten`);
  redirect(`/verwaltung/objekte/${propertyId}/bearbeiten?einheit=gespeichert`);
}

// Einheit löschen – NUR wenn sie leer ist (keine Mieter, Eigentümer, Buchungen,
// Sollstellungen, Mahnungen, Abrechnungsposten, SEPA-Mandate, Übergaben,
// Vorgänge, Dokumente oder Zähler). Sonst Hinweis statt Kaskadenlöschung.
export async function removeUnit(formData: FormData) {
  const actor = await requireVerwalter();
  const unitId = String(formData.get("unitId") ?? "").trim();
  if (!unitId) redirect("/verwaltung/objekte");
  const unit = await db.unit.findUnique({
    where: { id: unitId },
    select: {
      propertyId: true,
      property: { select: { organizationId: true } },
      _count: {
        select: {
          tenancies: true,
          unitOwnerships: true,
          hausgeldPayments: true,
          duePostings: true,
          hausgeldMahnungen: true,
          statementUnitAmounts: true,
          sepaMandates: true,
          handovers: true,
          tickets: true,
          documents: true,
          meters: true,
        },
      },
    },
  });
  if (!unit || unit.property.organizationId !== actor.organizationId) {
    redirect("/verwaltung/objekte");
  }
  if (!(await canVerwalterAccessProperty(actor, unit.propertyId))) {
    redirect("/verwaltung/objekte");
  }
  const c = unit._count;
  const dependents =
    c.tenancies + c.unitOwnerships + c.hausgeldPayments + c.duePostings + c.hausgeldMahnungen +
    c.statementUnitAmounts + c.sepaMandates + c.handovers + c.tickets + c.documents + c.meters;
  if (dependents > 0) {
    redirect(`/verwaltung/objekte/${unit.propertyId}/bearbeiten?fehler=einheit_belegt`);
  }
  await db.unit.delete({ where: { id: unitId } });
  revalidatePath(`/verwaltung/objekte/${unit.propertyId}/bearbeiten`);
  redirect(`/verwaltung/objekte/${unit.propertyId}/bearbeiten?einheit=geloescht`);
}

// ── Objekt archivieren / reaktivieren / löschen (nur SuperAdmin) ─────────────
async function requireSuperAdminProperty(actor: User, id: string) {
  if (!actor.isSuperAdmin) redirect("/verwaltung/objekte");
  if (!id || !(await canVerwalterAccessProperty(actor, id))) redirect("/verwaltung/objekte");
}

export async function archiveProperty(formData: FormData) {
  const actor = await requireVerwalter();
  const id = String(formData.get("id") ?? "").trim();
  await requireSuperAdminProperty(actor, id);
  await db.property.updateMany({
    where: { id, organizationId: actor.organizationId },
    data: { active: false },
  });
  revalidatePath("/verwaltung/objekte");
  redirect("/verwaltung/objekte?archiviert=1");
}

export async function unarchiveProperty(formData: FormData) {
  const actor = await requireVerwalter();
  const id = String(formData.get("id") ?? "").trim();
  await requireSuperAdminProperty(actor, id);
  await db.property.updateMany({
    where: { id, organizationId: actor.organizationId },
    data: { active: true },
  });
  revalidatePath("/verwaltung/objekte");
  redirect("/verwaltung/objekte?reaktiviert=1");
}

// Hartes Löschen NUR bei leeren Objekten (keine Einheiten, Vorgänge, Dokumente,
// Eigentümer, WEG-Finanzdaten usw.). Sonst Hinweis, stattdessen zu archivieren.
export async function deleteProperty(formData: FormData) {
  const actor = await requireVerwalter();
  const id = String(formData.get("id") ?? "").trim();
  await requireSuperAdminProperty(actor, id);
  const prop = await db.property.findFirst({
    where: { id, organizationId: actor.organizationId },
    select: {
      _count: {
        select: {
          units: true,
          tickets: true,
          documents: true,
          announcements: true,
          ownerships: true,
          resolutions: true,
          ownersMeetings: true,
          ownerMotions: true,
          maintenanceTasks: true,
          costTypes: true,
          ledgerAccounts: true,
          bookings: true,
          bankImportBatches: true,
          economicPlans: true,
          duePostings: true,
          annualStatements: true,
          hausgeldMahnungen: true,
          sonderumlagen: true,
          maintenanceMeasures: true,
          sepaMandates: true,
          co2Allocations: true,
          beiratTasks: true,
          meters: true,
        },
      },
    },
  });
  if (!prop) redirect("/verwaltung/objekte");
  const dependents = Object.values(prop._count).reduce((a, b) => a + b, 0);
  if (dependents > 0) {
    redirect(`/verwaltung/objekte/${id}/bearbeiten?fehler=objekt_belegt`);
  }
  try {
    await db.property.delete({ where: { id } });
  } catch {
    // Falls doch eine Fremdschlüssel-Beziehung greift: nicht hart löschen.
    redirect(`/verwaltung/objekte/${id}/bearbeiten?fehler=objekt_belegt`);
  }
  revalidatePath("/verwaltung/objekte");
  redirect("/verwaltung/objekte?geloescht=1");
}

// ── Eigentümer/Mieter je Einheit (aus dem Objekt heraus) ────────────────────
function personFields(formData: FormData) {
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const name = `${firstName} ${lastName}`.trim();
  const emailRaw = String(formData.get("email") ?? "").trim().toLowerCase();
  const email = emailRaw && emailRaw.includes("@") ? emailRaw : null;
  const phone = optStr(formData.get("phone"), 50);
  return { firstName, lastName, name, email, phone };
}

function backTo(propertyId: string, param: string) {
  return `/verwaltung/objekte/${propertyId}/bearbeiten?${param}`;
}

export async function addUnitTenant(formData: FormData) {
  const actor = await requireVerwalter();
  const unitId = String(formData.get("unitId") ?? "").trim();
  if (!unitId) redirect("/verwaltung/objekte");
  const propertyId = await requireUnitScope(actor, unitId);
  const { firstName, lastName, name, email, phone } = personFields(formData);
  if (name.length < 2) redirect(backTo(propertyId, "fehler=person"));
  const result = await inviteOrLetter({
    name, firstName: firstName || null, lastName: lastName || null, email, phone,
    role: "MIETER", organizationId: actor.organizationId,
  });
  if (!result) redirect(backTo(propertyId, "fehler=person_org"));
  await db.tenancy.upsert({
    where: { userId_unitId: { userId: result.id, unitId } },
    create: { userId: result.id, unitId },
    update: { active: true },
  });
  revalidatePath(backTo(propertyId, "").split("?")[0]);
  if (result.pw) redirect(`/zugangsschreiben/${result.id}?pw=${encodeURIComponent(result.pw)}`);
  redirect(backTo(propertyId, "person=gespeichert"));
}

export async function removeUnitTenant(formData: FormData) {
  const actor = await requireVerwalter();
  const tenancyId = String(formData.get("tenancyId") ?? "").trim();
  if (!tenancyId) redirect("/verwaltung/objekte");
  const tenancy = await db.tenancy.findUnique({
    where: { id: tenancyId },
    select: { unit: { select: { propertyId: true, property: { select: { organizationId: true } } } } },
  });
  if (!tenancy || tenancy.unit.property.organizationId !== actor.organizationId) {
    redirect("/verwaltung/objekte");
  }
  const propertyId = tenancy.unit.propertyId;
  if (!(await canVerwalterAccessProperty(actor, propertyId))) redirect("/verwaltung/objekte");
  await db.tenancy.delete({ where: { id: tenancyId } });
  revalidatePath(backTo(propertyId, "").split("?")[0]);
  redirect(backTo(propertyId, "person=entfernt"));
}

export async function addUnitOwner(formData: FormData) {
  const actor = await requireVerwalter();
  const unitId = String(formData.get("unitId") ?? "").trim();
  if (!unitId) redirect("/verwaltung/objekte");
  const propertyId = await requireUnitScope(actor, unitId);
  const { firstName, lastName, name, email, phone } = personFields(formData);
  if (name.length < 2) redirect(backTo(propertyId, "fehler=person"));
  const result = await inviteOrLetter({
    name, firstName: firstName || null, lastName: lastName || null, email, phone,
    role: "EIGENTUEMER", organizationId: actor.organizationId,
  });
  if (!result) redirect(backTo(propertyId, "fehler=person_org"));
  await db.unitOwnership
    .create({ data: { organizationId: actor.organizationId, unitId, userId: result.id, validFrom: new Date() } })
    .catch(() => {});
  await db.ownership.upsert({
    where: { userId_propertyId: { userId: result.id, propertyId } },
    create: { userId: result.id, propertyId },
    update: {},
  });
  await syncOwnerVotingWeights(propertyId);
  revalidatePath(backTo(propertyId, "").split("?")[0]);
  if (result.pw) redirect(`/zugangsschreiben/${result.id}?pw=${encodeURIComponent(result.pw)}`);
  redirect(backTo(propertyId, "person=gespeichert"));
}

export async function removeUnitOwner(formData: FormData) {
  const actor = await requireVerwalter();
  const unitOwnershipId = String(formData.get("unitOwnershipId") ?? "").trim();
  if (!unitOwnershipId) redirect("/verwaltung/objekte");
  const uo = await db.unitOwnership.findUnique({
    where: { id: unitOwnershipId },
    select: { userId: true, unit: { select: { propertyId: true, property: { select: { organizationId: true } } } } },
  });
  if (!uo || uo.unit.property.organizationId !== actor.organizationId) redirect("/verwaltung/objekte");
  const propertyId = uo.unit.propertyId;
  if (!(await canVerwalterAccessProperty(actor, propertyId))) redirect("/verwaltung/objekte");
  await db.unitOwnership.delete({ where: { id: unitOwnershipId } });
  // Besitzt der Eigentümer keine weitere Einheit dieses Objekts mehr, auch die
  // objektweite Eigentümerschaft (Stimmrecht) entfernen.
  const remaining = await db.unitOwnership.count({ where: { userId: uo.userId, unit: { propertyId } } });
  if (remaining === 0) {
    await db.ownership.deleteMany({ where: { userId: uo.userId, propertyId } });
  }
  await syncOwnerVotingWeights(propertyId);
  revalidatePath(backTo(propertyId, "").split("?")[0]);
  redirect(backTo(propertyId, "person=entfernt"));
}

export async function addPropertyOwner(formData: FormData) {
  const actor = await requireVerwalter();
  const propertyId = String(formData.get("propertyId") ?? "").trim();
  if (!propertyId || !(await canVerwalterAccessProperty(actor, propertyId))) {
    redirect("/verwaltung/objekte");
  }
  const { firstName, lastName, name, email, phone } = personFields(formData);
  if (name.length < 2) redirect(backTo(propertyId, "fehler=person"));
  const result = await inviteOrLetter({
    name, firstName: firstName || null, lastName: lastName || null, email, phone,
    role: "EIGENTUEMER", organizationId: actor.organizationId,
  });
  if (!result) redirect(backTo(propertyId, "fehler=person_org"));
  await db.ownership.upsert({
    where: { userId_propertyId: { userId: result.id, propertyId } },
    create: { userId: result.id, propertyId },
    update: {},
  });
  revalidatePath(backTo(propertyId, "").split("?")[0]);
  if (result.pw) redirect(`/zugangsschreiben/${result.id}?pw=${encodeURIComponent(result.pw)}`);
  redirect(backTo(propertyId, "person=gespeichert"));
}

function parseDateInput(raw: FormDataEntryValue | null): Date | null {
  const v = String(raw ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Mietvertrags-Daten eines Mietverhältnisses bearbeiten (Mietverwaltung):
// Kaltmiete, Nebenkosten-Vorauszahlung, Kaution, Zeitraum und Vertrags-PDF.
export async function updateTenancy(formData: FormData) {
  const actor = await requireVerwalter();
  const tenancyId = String(formData.get("tenancyId") ?? "").trim();
  if (!tenancyId) redirect("/verwaltung/objekte");
  const tenancy = await db.tenancy.findUnique({
    where: { id: tenancyId },
    select: {
      contractStoredName: true,
      unit: { select: { propertyId: true, property: { select: { organizationId: true } } } },
    },
  });
  if (!tenancy || tenancy.unit.property.organizationId !== actor.organizationId) {
    redirect("/verwaltung/objekte");
  }
  const propertyId = tenancy.unit.propertyId;
  if (!(await canVerwalterAccessProperty(actor, propertyId))) redirect("/verwaltung/objekte");

  const startDate = parseDateInput(formData.get("startDate"));
  const endDate = parseDateInput(formData.get("endDate"));

  // Vertrags-PDF: neu hochgeladen ersetzt, Häkchen entfernt es, sonst unverändert.
  let contractUpdate:
    | { contractStoredName: string | null; contractFileName: string | null; contractMimeType: string | null }
    | Record<string, never> = {};
  let blobToDelete: string | null = null;
  const file = formData.get("contract");
  const removeContract = String(formData.get("removeContract") ?? "") === "1";
  if (file instanceof File && file.size > 0) {
    try {
      const up = await saveUpload(file, DOCUMENT_TYPES);
      contractUpdate = {
        contractStoredName: up.storedName,
        contractFileName: up.fileName,
        contractMimeType: up.mimeType,
      };
      blobToDelete = tenancy.contractStoredName;
    } catch {
      // Datei-Fehler blockiert die übrigen Vertragsdaten nicht.
    }
  } else if (removeContract) {
    contractUpdate = { contractStoredName: null, contractFileName: null, contractMimeType: null };
    blobToDelete = tenancy.contractStoredName;
  }

  await db.tenancy.update({
    where: { id: tenancyId },
    data: {
      rentColdCents: parseEuroToCents(String(formData.get("rentCold") ?? "")),
      bkPrepaymentMonthlyCents: parseEuroToCents(String(formData.get("bkPrepay") ?? "")),
      depositCents: parseEuroToCents(String(formData.get("deposit") ?? "")),
      // startDate ist Pflichtfeld – nur bei gültiger Eingabe überschreiben.
      ...(startDate ? { startDate } : {}),
      endDate,
      ...contractUpdate,
    },
  });
  if (blobToDelete) await deleteBlob(blobToDelete);
  revalidatePath(backTo(propertyId, "").split("?")[0]);
  redirect(backTo(propertyId, "person=gespeichert"));
}

export async function removePropertyOwner(formData: FormData) {
  const actor = await requireVerwalter();
  const ownershipId = String(formData.get("ownershipId") ?? "").trim();
  if (!ownershipId) redirect("/verwaltung/objekte");
  const own = await db.ownership.findUnique({
    where: { id: ownershipId },
    select: { propertyId: true, property: { select: { organizationId: true } } },
  });
  if (!own || own.property.organizationId !== actor.organizationId) redirect("/verwaltung/objekte");
  if (!(await canVerwalterAccessProperty(actor, own.propertyId))) redirect("/verwaltung/objekte");
  await db.ownership.delete({ where: { id: ownershipId } });
  revalidatePath(backTo(own.propertyId, "").split("?")[0]);
  redirect(backTo(own.propertyId, "person=entfernt"));
}
