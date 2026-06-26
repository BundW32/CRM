"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { canVerwalterAccessProperty } from "@/lib/access";
import { requireVerwalter } from "@/lib/session";
import { syncDocumentSource } from "@/lib/document-sources/sync";

const configSchema = z.object({
  label: z.string().trim().min(2).max(200),
  source: z.enum(["GDRIVE"]),
  propertyId: z.string().optional(),
  audience: z.enum(["MIETER", "EIGENTUEMER", "ALLE"]),
  category: z.enum(["ABRECHNUNG", "PROTOKOLL", "VERTRAG", "BESCHEINIGUNG", "SONSTIGES"]),
  folderId: z.string().trim().min(10).max(500),
});

export async function createDocumentSourceConfig(formData: FormData) {
  const verwalter = await requireVerwalter();

  const parsed = configSchema.safeParse({
    label: formData.get("label"),
    source: formData.get("source"),
    propertyId: formData.get("propertyId") || undefined,
    audience: formData.get("audience"),
    category: formData.get("category"),
    folderId: formData.get("folderId"),
  });
  if (!parsed.success) redirect("/verwaltung/dokument-quellen?fehler=eingabe");

  // Scope-Prüfung: eingeschränkte Verwalter nur auf eigene Objekte.
  // Globale Quellen (ohne Objekt) sind SuperAdmin vorbehalten.
  const propertyId = parsed.data.propertyId ?? null;
  if (!(await canVerwalterAccessProperty(verwalter, propertyId))) {
    redirect("/verwaltung/dokument-quellen?fehler=eingabe");
  }

  await db.documentSourceConfig.create({
    data: {
      label: parsed.data.label,
      source: parsed.data.source,
      propertyId,
      audience: parsed.data.audience,
      category: parsed.data.category,
      config: { folderId: parsed.data.folderId },
      createdById: verwalter.id,
    },
  });

  revalidatePath("/verwaltung/dokument-quellen");
  redirect("/verwaltung/dokument-quellen");
}

export async function deleteDocumentSourceConfig(formData: FormData) {
  const verwalter = await requireVerwalter();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/verwaltung/dokument-quellen");

  const cfg = await db.documentSourceConfig.findUnique({
    where: { id },
    select: { propertyId: true },
  });
  if (!cfg) redirect("/verwaltung/dokument-quellen");

  // Scope-Prüfung: nur eigene Objekte; globale Quellen nur SuperAdmin.
  // (Schließt das NULL-propertyId-Loch: globale Configs anderer Verwalter
  // können nicht mehr von eingeschränkten Verwaltern gelöscht werden.)
  if (!(await canVerwalterAccessProperty(verwalter, cfg.propertyId))) {
    redirect("/verwaltung/dokument-quellen");
  }

  await db.documentSourceConfig.delete({ where: { id } }).catch(() => {});
  revalidatePath("/verwaltung/dokument-quellen");
  redirect("/verwaltung/dokument-quellen");
}

export async function triggerSync(formData: FormData) {
  const verwalter = await requireVerwalter();
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/verwaltung/dokument-quellen");

  // Scope-Prüfung: nur eigene Objekte; globale Quellen nur SuperAdmin
  const cfg = await db.documentSourceConfig.findUnique({
    where: { id },
    select: { propertyId: true },
  });
  if (!cfg) redirect("/verwaltung/dokument-quellen");
  if (!(await canVerwalterAccessProperty(verwalter, cfg.propertyId))) {
    redirect("/verwaltung/dokument-quellen");
  }

  const result = await syncDocumentSource(id, verwalter.id);

  revalidatePath("/verwaltung/dokument-quellen");
  revalidatePath("/infos");

  const msg = result.errors.length > 0 ? "fehler" : "ok";
  const imported = result.imported;
  redirect(`/verwaltung/dokument-quellen?sync=${msg}&imported=${imported}`);
}
