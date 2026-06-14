"use server";

import bcrypt from "bcryptjs";
import crypto from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { generatePassword, generateUsername } from "@/lib/credentials";
import { db } from "@/lib/db";
import { portalUrl, sendMail } from "@/lib/mailer";
import { requireVerwalter } from "@/lib/session";

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
  email: string | null;
  phone: string | null;
  role: "EIGENTUEMER" | "MIETER";
}): Promise<{ id: string; pw: string } | null> {
  // Existiert bereits ein Nutzer mit dieser E-Mail, wird dieser mit dem Objekt
  // verknüpft (kein neuer Zugang, keine erneute Einladung).
  if (opts.email) {
    const exists = await db.user.findUnique({ where: { email: opts.email } });
    if (exists) return { id: exists.id, pw: "" };
  }

  if (opts.email) {
    const inviteToken = crypto.randomBytes(32).toString("hex");
    const user = await db.user.create({
      data: {
        name: opts.name,
        email: opts.email,
        phone: opts.phone ?? undefined,
        role: opts.role,
        passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12),
        passwordResetToken: inviteToken,
        passwordResetExpiry: new Date(Date.now() + INVITE_TTL_MS),
      },
    });
    await sendMail(
      opts.email,
      "Ihr Zugang zum B&W Kundenportal",
      `Guten Tag ${opts.name},\n\n` +
        `Sie wurden zum Kundenportal der B&W Immobilien Management UG eingeladen.\n\n` +
        `Zugang einrichten (gültig 7 Tage):\n` +
        `${portalUrl(`/login/reset/${inviteToken}?einladung=1`)}\n\n` +
        `Mit freundlichen Grüßen\nB&W Immobilien Management UG`
    );
    return { id: user.id, pw: "" };
  }

  // Ohne E-Mail: Zugangsschreiben mit Benutzername + Erst-Passwort
  const tempPassword = generatePassword(10);
  const username = await generateUsername(opts.name);
  const user = await db.user.create({
    data: {
      name: opts.name,
      username,
      phone: opts.phone ?? undefined,
      role: opts.role,
      passwordHash: await bcrypt.hash(tempPassword, 12),
      mustChangePassword: true,
    },
  });
  return { id: user.id, pw: tempPassword };
}

export async function createObjekt(formData: FormData) {
  await requireVerwalter();

  const name = String(formData.get("name") ?? "").trim();
  const street = String(formData.get("street") ?? "").trim();
  const zip = String(formData.get("zip") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  if (!name || !street || !zip || !city) {
    redirect("/verwaltung/objekte/neu?fehler=objekt");
  }

  // ── Objekt anlegen (inkl. optionaler Stammdaten) ────────────────────
  const property = await db.property.create({
    data: {
      name,
      street,
      zip,
      city,
      buildYear: optInt(formData.get("buildYear")),
      livingArea: optFloat(formData.get("livingArea")),
      floors: optInt(formData.get("floors")),
      buildingType: optStr(formData.get("buildingType")),
      heatingType: optStr(formData.get("heatingType")),
      notes: optStr(formData.get("notes"), 2000),
    },
  });

  // ── Einheiten ───────────────────────────────────────────────────────
  const unitLabels = formData.getAll("unitLabel").map((v) => String(v).trim());
  const unitFloors = formData.getAll("unitFloor").map((v) => String(v).trim());
  const unitLabelToId = new Map<string, string>();

  const unitsToCreate = unitLabels
    .map((label, i) => ({ label: label.slice(0, 200), floor: unitFloors[i] || undefined }))
    .filter((u) => u.label.length > 0)
    .slice(0, MAX_UNITS);

  if (unitsToCreate.length > 0) {
    await db.unit.createMany({
      data: unitsToCreate.map((u) => ({ propertyId: property.id, label: u.label, floor: u.floor })),
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
  const eigName = String(formData.get("eigName") ?? "").trim();
  if (eigName.length >= 2) {
    const eigEmailRaw = String(formData.get("eigEmail") ?? "").trim().toLowerCase();
    const result = await inviteOrLetter({
      name: eigName,
      email: eigEmailRaw && eigEmailRaw.includes("@") ? eigEmailRaw : null,
      phone: optStr(formData.get("eigPhone"), 50),
      role: "EIGENTUEMER",
    });
    if (result) {
      // catch: bereits bestehende Verknüpfung (Unique-Constraint) ignorieren
      await db.ownership
        .create({ data: { userId: result.id, propertyId: property.id } })
        .catch(() => {});
      if (result.pw) letterUsers.push(result);
    }
  }

  // ── Mieter (optional, je eine Karte) ────────────────────────────────
  const tenantNames = formData.getAll("tenantName").map((v) => String(v).trim());
  const tenantEmails = formData.getAll("tenantEmail").map((v) => String(v).trim().toLowerCase());
  const tenantPhones = formData.getAll("tenantPhone").map((v) => String(v).trim());
  const tenantUnits = formData.getAll("tenantUnit").map((v) => String(v).trim());

  const tenantCount = Math.min(tenantNames.length, MAX_TENANTS);
  for (let i = 0; i < tenantCount; i++) {
    const tName = tenantNames[i];
    if (!tName || tName.length < 2) continue;

    const tEmailRaw = tenantEmails[i] ?? "";
    const result = await inviteOrLetter({
      name: tName,
      email: tEmailRaw && tEmailRaw.includes("@") ? tEmailRaw : null,
      phone: tenantPhones[i] ? tenantPhones[i].slice(0, 50) : null,
      role: "MIETER",
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
