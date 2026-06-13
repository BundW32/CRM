"use server";

import bcrypt from "bcryptjs";
import crypto from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { generatePassword, generateUsername } from "@/lib/credentials";
import { db } from "@/lib/db";
import { portalUrl, sendMail } from "@/lib/mailer";
import { requireVerwalter } from "@/lib/session";

const MAX_UNITS = 50;

function parseUnitLines(raw: string) {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, MAX_UNITS)
    .map((line) => {
      const [label, floor] = line.split("|").map((s) => s.trim());
      return { label: label.slice(0, 200), floor: floor ? floor.slice(0, 100) : undefined };
    })
    .filter((u) => u.label.length > 0);
}

function parseTenantLines(raw: string) {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const parts = line.split("|").map((s) => s.trim());
      const name = parts[0] ?? "";
      const unitLabel = parts[1] ?? "";
      const emailRaw = parts[2] ?? "";
      const email =
        emailRaw && emailRaw.includes("@") ? emailRaw.toLowerCase() : null;
      return { name, unitLabel, email };
    })
    .filter((t) => t.name.length >= 2);
}

export async function schnelleinrichtung(formData: FormData) {
  await requireVerwalter();

  const name = String(formData.get("name") ?? "").trim();
  const street = String(formData.get("street") ?? "").trim();
  const zip = String(formData.get("zip") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  if (!name || !street || !zip || !city) {
    redirect("/verwaltung/schnelleinrichtung?fehler=objekt");
  }

  const property = await db.property.create({ data: { name, street, zip, city } });

  // Einheiten anlegen und in einer Map speichern (Label → ID)
  const unitLines = parseUnitLines(String(formData.get("units") ?? ""));
  const unitLabelToId = new Map<string, string>();

  if (unitLines.length > 0) {
    await db.unit.createMany({
      data: unitLines.map((u) => ({
        propertyId: property.id,
        label: u.label,
        floor: u.floor,
      })),
    });
    // Frisch angelegte Einheiten laden, damit wir deren IDs haben
    const createdUnits = await db.unit.findMany({
      where: { propertyId: property.id },
      select: { id: true, label: true },
    });
    createdUnits.forEach((u) => unitLabelToId.set(u.label, u.id));
  }

  // Sammlung aller "Zugangsschreiben"-Nutzer: [{id, pw}]
  const letterUsers: Array<{ id: string; pw: string }> = [];

  // ── Eigentümer (optional) ──────────────────────────────────────────
  const eigName = String(formData.get("eigName") ?? "").trim();
  const eigEmailRaw = String(formData.get("eigEmail") ?? "").trim().toLowerCase();
  const eigPhone = String(formData.get("eigPhone") ?? "").trim() || undefined;

  if (eigName.length >= 2) {
    const eigEmail = eigEmailRaw && eigEmailRaw.includes("@") ? eigEmailRaw : null;
    const conflict = eigEmail
      ? await db.user.findUnique({ where: { email: eigEmail } })
      : null;

    if (!conflict) {
      if (eigEmail) {
        const inviteToken = crypto.randomBytes(32).toString("hex");
        const inviteExpiry = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
        const owner = await db.user.create({
          data: {
            name: eigName,
            email: eigEmail,
            phone: eigPhone,
            role: "EIGENTUEMER",
            passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12),
            passwordResetToken: inviteToken,
            passwordResetExpiry: inviteExpiry,
          },
        });
        await db.ownership.create({ data: { userId: owner.id, propertyId: property.id } });
        await sendMail(
          eigEmail,
          "Ihr Zugang zum B&W Kundenportal",
          `Guten Tag ${eigName},\n\n` +
            `Sie wurden zum Kundenportal der B&W Immobilien Management UG eingeladen.\n\n` +
            `Zugang einrichten (gültig 7 Tage):\n` +
            `${portalUrl(`/login/reset/${inviteToken}?einladung=1`)}\n\n` +
            `Mit freundlichen Grüßen\nB&W Immobilien Management UG`
        );
      } else {
        const tempPassword = generatePassword(10);
        const username = await generateUsername(eigName);
        const owner = await db.user.create({
          data: {
            name: eigName,
            username,
            phone: eigPhone,
            role: "EIGENTUEMER",
            passwordHash: await bcrypt.hash(tempPassword, 12),
            mustChangePassword: true,
          },
        });
        await db.ownership.create({ data: { userId: owner.id, propertyId: property.id } });
        letterUsers.push({ id: owner.id, pw: tempPassword });
      }
    }
  }

  // ── Mieter ────────────────────────────────────────────────────────
  const tenantLines = parseTenantLines(String(formData.get("tenants") ?? ""));

  for (const t of tenantLines) {
    // Duplikate überspringen
    if (t.email) {
      const exists = await db.user.findUnique({ where: { email: t.email } });
      if (exists) continue;
    }

    const unitId = t.unitLabel ? unitLabelToId.get(t.unitLabel) : undefined;

    if (t.email) {
      const inviteToken = crypto.randomBytes(32).toString("hex");
      const inviteExpiry = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
      const tenant = await db.user.create({
        data: {
          name: t.name,
          email: t.email,
          role: "MIETER",
          passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12),
          passwordResetToken: inviteToken,
          passwordResetExpiry: inviteExpiry,
        },
      });
      if (unitId) {
        await db.tenancy.create({ data: { userId: tenant.id, unitId } });
      }
      await sendMail(
        t.email,
        "Ihr Zugang zum B&W Kundenportal",
        `Guten Tag ${t.name},\n\n` +
          `Sie wurden zum Kundenportal der B&W Immobilien Management UG eingeladen.\n\n` +
          `Zugang einrichten (gültig 7 Tage):\n` +
          `${portalUrl(`/login/reset/${inviteToken}?einladung=1`)}\n\n` +
          `Mit freundlichen Grüßen\nB&W Immobilien Management UG`
      );
    } else {
      const tempPassword = generatePassword(10);
      const username = await generateUsername(t.name);
      const tenant = await db.user.create({
        data: {
          name: t.name,
          username,
          role: "MIETER",
          passwordHash: await bcrypt.hash(tempPassword, 12),
          mustChangePassword: true,
        },
      });
      if (unitId) {
        await db.tenancy.create({ data: { userId: tenant.id, unitId } });
      }
      letterUsers.push({ id: tenant.id, pw: tempPassword });
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
