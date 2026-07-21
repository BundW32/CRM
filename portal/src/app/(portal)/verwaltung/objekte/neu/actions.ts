"use server";

import bcrypt from "bcryptjs";
import crypto from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { generatePassword, generateUsername } from "@/lib/credentials";
import { db } from "@/lib/db";
import { getBrandingForOrg } from "@/lib/branding-server";
import { isSelfManaged } from "@/lib/access";
import { portalUrl, sendMail } from "@/lib/mailer";
import { getOrganization, requireVerwalter } from "@/lib/session";
import { syncOwnerVotingWeights } from "@/lib/weg/mea-sync";

const MAX_UNITS = 100;
const MAX_TENANTS = 100;
const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 Tage

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

async function inviteOrLetter(opts: {
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  email: string | null;
  phone: string | null;
  role: "EIGENTUEMER" | "MIETER";
  organizationId: string;
}): Promise<{ id: string; pw: string } | null> {
  // Existiert bereits ein Nutzer mit dieser E-Mail, wird dieser mit dem Objekt
  // verknüpft – aber nur, wenn er zur SELBEN Org gehört (sonst kein Cross-Org-Link).
  if (opts.email) {
    const exists = await db.user.findUnique({
      where: { email: opts.email },
      select: { id: true, organizationId: true },
    });
    if (exists) {
      return exists.organizationId === opts.organizationId ? { id: exists.id, pw: "" } : null;
    }
  }

  if (opts.email) {
    const inviteToken = crypto.randomBytes(32).toString("hex");
    const user = await db.user.create({
      data: {
        name: opts.name,
        firstName: opts.firstName ?? undefined,
        lastName: opts.lastName ?? undefined,
        email: opts.email,
        phone: opts.phone ?? undefined,
        role: opts.role,
        passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12),
        passwordResetToken: inviteToken,
        passwordResetExpiry: new Date(Date.now() + INVITE_TTL_MS),
        organizationId: opts.organizationId,
      },
    });
    const branding = await getBrandingForOrg(opts.organizationId);
    await sendMail(
      opts.email,
      "Ihr Zugang zum Kundenportal",
      `Guten Tag ${opts.name},\n\n` +
        `Sie wurden zum Kundenportal der ${branding.legalName} eingeladen.\n\n` +
        `Zugang einrichten (gültig 7 Tage):\n` +
        `${portalUrl(`/login/reset/${inviteToken}?einladung=1`)}\n\n` +
        `Mit freundlichen Grüßen\n${branding.legalName}`,
      undefined,
      branding
    );
    return { id: user.id, pw: "" };
  }

  // Ohne E-Mail: Zugangsschreiben mit Benutzername + Erst-Passwort
  const tempPassword = generatePassword(10);
  const username = await generateUsername(opts.name);
  const user = await db.user.create({
    data: {
      name: opts.name,
      firstName: opts.firstName ?? undefined,
      lastName: opts.lastName ?? undefined,
      username,
      phone: opts.phone ?? undefined,
      role: opts.role,
      passwordHash: await bcrypt.hash(tempPassword, 12),
      mustChangePassword: true,
      organizationId: opts.organizationId,
    },
  });
  return { id: user.id, pw: tempPassword };
}

export async function createObjekt(formData: FormData) {
  const actor = await requireVerwalter();
  // Neue Objekte anzulegen ist eine Stammdaten-Aktion – nur SuperAdmin der Org
  // (eingeschränkte Verwalter verwalten nur ihre zugewiesenen Bestandsobjekte).
  if (!actor.isSuperAdmin) redirect("/verwaltung/objekte");

  const name = String(formData.get("name") ?? "").trim();
  const street = String(formData.get("street") ?? "").trim();
  const zip = String(formData.get("zip") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  if (!name || !street || !zip || !city) {
    redirect("/verwaltung/objekte/neu?fehler=objekt");
  }

  // Selbstverwalter verwalten ausschließlich ihre eigene WEG – ein Mietshaus
  // (Mietverwaltung) dürfen sie nicht anlegen. Serverseitig erzwingen, unabhängig
  // vom übermittelten Formularwert.
  const org = await getOrganization();
  const managementType = isSelfManaged(org)
    ? "WEG"
    : String(formData.get("managementType") ?? "") === "WEG"
      ? "WEG"
      : "MIETVERWALTUNG";
  const vpRaw = String(formData.get("votingPrinciple") ?? "");
  const votingPrinciple = vpRaw === "MEA" ? "MEA" : vpRaw === "OBJEKT" ? "OBJEKT" : "KOPF";

  // ── Objekt anlegen (inkl. optionaler Stammdaten) ────────────────────
  const property = await db.property.create({
    data: {
      name,
      street,
      zip,
      city,
      managementType,
      votingPrinciple,
      organizationId: actor.organizationId,
      buildYear: optInt(formData.get("buildYear")),
      livingArea: optFloat(formData.get("livingArea")),
      floors: optInt(formData.get("floors")),
      buildingType: optStr(formData.get("buildingType")),
      heatingType: optStr(formData.get("heatingType")),
      notes: optStr(formData.get("notes"), 2000),
    },
  });

  // ── Einheiten ───────────────────────────────────────────────────────
  // Fläche/MEA/Personen je Einheit indexgleich zu unitLabel einlesen (VOR dem
  // Leerfilter), damit die Zuordnung erhalten bleibt. MEA nur bei WEG.
  const unitLabels = formData.getAll("unitLabel").map((v) => String(v).trim());
  const unitFloors = formData.getAll("unitFloor").map((v) => String(v).trim());
  const unitAreas = formData.getAll("unitArea").map((v) => String(v));
  const unitMeas = formData.getAll("unitMea").map((v) => String(v));
  const unitPersonsRaw = formData.getAll("unitPersons").map((v) => String(v));
  const unitLabelToId = new Map<string, string>();

  const unitsToCreate = unitLabels
    .map((label, i) => ({
      label: label.slice(0, 200),
      floor: unitFloors[i] || undefined,
      livingArea: optFloat(unitAreas[i] ?? null),
      mea: managementType === "WEG" ? optInt(unitMeas[i] ?? null) : null,
      personCount: optInt(unitPersonsRaw[i] ?? null),
    }))
    .filter((u) => u.label.length > 0)
    .slice(0, MAX_UNITS);

  if (unitsToCreate.length > 0) {
    await db.unit.createMany({
      data: unitsToCreate.map((u) => ({
        propertyId: property.id,
        label: u.label,
        floor: u.floor,
        livingArea: u.livingArea,
        mea: u.mea,
        personCount: u.personCount,
      })),
    });
    const created = await db.unit.findMany({
      where: { propertyId: property.id },
      select: { id: true, label: true },
    });
    created.forEach((u) => unitLabelToId.set(u.label, u.id));
  }

  // Sammlung aller Zugangsschreiben-Nutzer: [{id, pw}]
  const letterUsers: Array<{ id: string; pw: string }> = [];

  // ── Eigentümer (optional, einzeln) ──────────────────────────────────
  const eigFirst = String(formData.get("eigFirstName") ?? "").trim();
  const eigLast = String(formData.get("eigLastName") ?? "").trim();
  const eigName = `${eigFirst} ${eigLast}`.trim();
  if (eigName.length >= 2) {
    const eigEmailRaw = String(formData.get("eigEmail") ?? "").trim().toLowerCase();
    const result = await inviteOrLetter({
      name: eigName,
      firstName: eigFirst || null,
      lastName: eigLast || null,
      email: eigEmailRaw && eigEmailRaw.includes("@") ? eigEmailRaw : null,
      phone: optStr(formData.get("eigPhone"), 50),
      role: "EIGENTUEMER",
      organizationId: actor.organizationId,
    });
    if (result) {
      // catch: bereits bestehende Verknüpfung (Unique-Constraint) ignorieren
      await db.ownership
        .create({ data: { userId: result.id, propertyId: property.id } })
        .catch(() => {});
      if (result.pw) letterUsers.push(result);
    }
  }

  // ── WEG-Eigentümer je Einheit ───────────────────────────────────────
  // In einer WEG gehört jede Einheit einem eigenen Eigentümer. Legt je Zeile
  // einen Eigentümer an und verknüpft ihn mit der Einheit (UnitOwnership,
  // Grundlage der zeitanteiligen Abrechnung) UND objektweit (Ownership, für
  // Stimmrecht/MEA und Belegeinsicht).
  if (managementType === "WEG") {
    const ownerFirst = formData.getAll("wegOwnerFirstName").map((v) => String(v).trim());
    const ownerLast = formData.getAll("wegOwnerLastName").map((v) => String(v).trim());
    const ownerEmails = formData.getAll("wegOwnerEmail").map((v) => String(v).trim().toLowerCase());
    const ownerPhones = formData.getAll("wegOwnerPhone").map((v) => String(v).trim());
    const ownerUnits = formData.getAll("wegOwnerUnit").map((v) => String(v).trim());
    const ownerCount = Math.min(ownerFirst.length, MAX_TENANTS);
    for (let i = 0; i < ownerCount; i++) {
      const oFirst = ownerFirst[i] ?? "";
      const oLast = ownerLast[i] ?? "";
      const oName = `${oFirst} ${oLast}`.trim();
      if (oName.length < 2) continue;
      const unitId = ownerUnits[i] ? unitLabelToId.get(ownerUnits[i]) : undefined;
      if (!unitId) continue; // ohne Einheit keine WEG-Eigentümerschaft

      const oEmailRaw = ownerEmails[i] ?? "";
      const result = await inviteOrLetter({
        name: oName,
        firstName: oFirst || null,
        lastName: oLast || null,
        email: oEmailRaw && oEmailRaw.includes("@") ? oEmailRaw : null,
        phone: ownerPhones[i] ? ownerPhones[i].slice(0, 50) : null,
        role: "EIGENTUEMER",
        organizationId: actor.organizationId,
      });
      if (result) {
        await db.unitOwnership
          .create({
            data: {
              organizationId: actor.organizationId,
              unitId,
              userId: result.id,
              validFrom: new Date(),
            },
          })
          .catch(() => {});
        // Objektweite Eigentümerschaft (idempotent über Unique userId+propertyId)
        await db.ownership
          .create({ data: { userId: result.id, propertyId: property.id } })
          .catch(() => {});
        if (result.pw) letterUsers.push(result);
      }
    }
    // Stimmgewichte (voteUnits/MEA) aus der Einheiten-Eigentümerschaft ableiten.
    await syncOwnerVotingWeights(property.id);
  }

  // ── Mieter (optional, je eine Karte) ────────────────────────────────
  const tenantFirst = formData.getAll("tenantFirstName").map((v) => String(v).trim());
  const tenantLast = formData.getAll("tenantLastName").map((v) => String(v).trim());
  const tenantEmails = formData.getAll("tenantEmail").map((v) => String(v).trim().toLowerCase());
  const tenantPhones = formData.getAll("tenantPhone").map((v) => String(v).trim());
  const tenantUnits = formData.getAll("tenantUnit").map((v) => String(v).trim());

  const tenantCount = Math.min(tenantFirst.length, MAX_TENANTS);
  for (let i = 0; i < tenantCount; i++) {
    const tFirst = tenantFirst[i] ?? "";
    const tLast = tenantLast[i] ?? "";
    const tName = `${tFirst} ${tLast}`.trim();
    if (tName.length < 2) continue;

    const tEmailRaw = tenantEmails[i] ?? "";
    const result = await inviteOrLetter({
      name: tName,
      firstName: tFirst || null,
      lastName: tLast || null,
      email: tEmailRaw && tEmailRaw.includes("@") ? tEmailRaw : null,
      phone: tenantPhones[i] ? tenantPhones[i].slice(0, 50) : null,
      role: "MIETER",
      organizationId: actor.organizationId,
    });
    if (result) {
      const unitId = tenantUnits[i] ? unitLabelToId.get(tenantUnits[i]) : undefined;
      if (unitId) {
        await db.tenancy
          .create({ data: { userId: result.id, unitId } })
          .catch(() => {});
      }
      if (result.pw) letterUsers.push(result);
    }
  }

  revalidatePath("/verwaltung/objekte");
  revalidatePath("/verwaltung/nutzer");

  // Falls Zugangsschreiben gedruckt werden müssen: Batch-Seite öffnen
  if (letterUsers.length > 0) {
    const param = letterUsers.map((l) => `${l.id}~${l.pw}`).join("~");
    redirect(`/zugangsschreiben/batch?u=${encodeURIComponent(param)}`);
  }

  redirect("/verwaltung/objekte?eingerichtet=1");
}
