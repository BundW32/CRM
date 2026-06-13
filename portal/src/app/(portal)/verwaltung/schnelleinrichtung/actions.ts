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

// Eine Zeile aus der Sammeleingabe: "Label | Etage" (Etage optional)
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

  // Einheiten aus der Sammeleingabe anlegen
  const units = parseUnitLines(String(formData.get("units") ?? ""));
  if (units.length > 0) {
    await db.unit.createMany({
      data: units.map((u) => ({
        propertyId: property.id,
        label: u.label,
        floor: u.floor,
      })),
    });
  }

  // Eigentümer (optional)
  const eigName = String(formData.get("eigName") ?? "").trim();
  const eigEmailRaw = String(formData.get("eigEmail") ?? "").trim().toLowerCase();
  const eigPhone = String(formData.get("eigPhone") ?? "").trim() || undefined;

  if (eigName.length >= 2) {
    const eigEmail = eigEmailRaw && eigEmailRaw.includes("@") ? eigEmailRaw : null;
    const conflict = eigEmail ? await db.user.findUnique({ where: { email: eigEmail } }) : null;

    if (!conflict) {
      if (eigEmail) {
        // Einladung per E-Mail
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
        // Zugangsschreiben (kein E-Mail-Eigentümer)
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
        revalidatePath("/verwaltung/objekte");
        redirect(`/zugangsschreiben/${owner.id}?pw=${encodeURIComponent(tempPassword)}`);
      }
    }
  }

  revalidatePath("/verwaltung/objekte");
  redirect("/verwaltung/objekte?eingerichtet=1");
}
