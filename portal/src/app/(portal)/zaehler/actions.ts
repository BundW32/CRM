"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { MeterType } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { meterTypeLabels } from "@/lib/labels";
import { requireUser, requireVerwalter } from "@/lib/session";
import { sonstigesFreitext } from "@/lib/sonstiges";

// Einzige Quelle der zulässigen Zählerarten ist der Beschriftungs-Katalog: Er
// deckt den Enum vollständig ab. Eine Aufzählung von Hand hätte einen neu
// hinzugekommenen Wert stillschweigend abgewiesen — das Formular böte ihn an,
// die Aktion verwürfe ihn.
const METER_TYPES = Object.keys(meterTypeLabels) as [MeterType, ...MeterType[]];

const meterSchema = z.object({
  // "unit:<id>" für einen Einheitszähler oder "prop:<id>" für einen Allgemeinzähler
  target: z.string().min(1),
  type: z.enum(METER_TYPES),
  meterNumber: z.string().trim().max(100).optional(),
  location: z.string().trim().max(200).optional(),
  remoteReadable: z.boolean().optional(),
});

export async function createMeter(formData: FormData) {
  await requireVerwalter();
  const parsed = meterSchema.safeParse({
    target: formData.get("target"),
    type: formData.get("type"),
    meterNumber: formData.get("meterNumber") || undefined,
    location: formData.get("location") || undefined,
    remoteReadable: formData.get("remoteReadable") === "on",
  });
  if (!parsed.success) {
    redirect("/zaehler?fehler=eingabe");
  }
  const [kind, refId] = parsed.data.target.split(":");
  if ((kind !== "unit" && kind !== "prop") || !refId) {
    redirect("/zaehler?fehler=eingabe");
  }

  await db.meter.create({
    data: {
      unitId: kind === "unit" ? refId : null,
      propertyId: kind === "prop" ? refId : null,
      type: parsed.data.type,
      typeOther: sonstigesFreitext(parsed.data.type, formData.get("typeOther")),
      meterNumber: parsed.data.meterNumber || null,
      location: parsed.data.location || null,
      remoteReadable: parsed.data.remoteReadable ?? false,
    },
  });
  revalidatePath("/zaehler");
  redirect("/zaehler?flash=erstellt");
}

export async function deleteMeter(formData: FormData) {
  await requireVerwalter();
  const id = String(formData.get("id") ?? "");
  if (id) {
    await db.meter.delete({ where: { id } }).catch(() => {});
  }
  revalidatePath("/zaehler");
  redirect("/zaehler?flash=geloescht");
}

export async function submitReading(formData: FormData) {
  const user = await requireUser();
  const meterId = String(formData.get("meterId") ?? "");
  const valueRaw = String(formData.get("value") ?? "").trim().replace(",", ".");
  const dateRaw = String(formData.get("readingDate") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim().slice(0, 300) || null;

  const meter = await db.meter.findUnique({ where: { id: meterId } });
  if (!meter) redirect("/zaehler");

  // Zugriff prüfen: Verwalter immer; Mieter für Einheitszähler ihrer Einheit;
  // Eigentümer für Allgemeinzähler ihrer Objekte
  if (user.role !== "VERWALTER") {
    let allowed = false;
    if (meter.unitId) {
      const tenancy = await db.tenancy.findFirst({
        where: { userId: user.id, unitId: meter.unitId, active: true },
      });
      allowed = Boolean(tenancy);
    } else if (meter.propertyId) {
      const ownership = await db.ownership.findFirst({
        where: { userId: user.id, propertyId: meter.propertyId },
      });
      allowed = Boolean(ownership);
    }
    if (!allowed) redirect("/zaehler");
  }

  const value = Number(valueRaw);
  if (!Number.isFinite(value) || value < 0) {
    redirect("/zaehler?fehler=wert");
  }
  const readingDate = dateRaw ? new Date(dateRaw) : new Date();

  await db.meterReading.create({
    data: {
      meterId,
      value,
      readingDate: Number.isNaN(readingDate.getTime()) ? new Date() : readingDate,
      note,
      createdById: user.id,
    },
  });
  revalidatePath("/zaehler");
  redirect("/zaehler?gespeichert=1");
}
