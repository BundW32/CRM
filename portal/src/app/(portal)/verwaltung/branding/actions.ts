"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";
import { IMAGE_TYPES, deleteBlob, saveUpload } from "@/lib/storage";
import { normalizeHex } from "@/lib/branding";
import { errorMessage, isNextControlFlowError } from "@/lib/errors";

// Sammelt und speichert die White-Label-/Impressum-Daten der eigenen
// Organisation. Nur SuperAdmins dürfen das Branding ihres Mandanten ändern.
async function saveBranding(formData: FormData): Promise<void> {
  const actor = await requireVerwalter();
  if (!actor.isSuperAdmin) redirect("/verwaltung");

  const data: {
    name?: string;
    legalName: string | null;
    primaryColor: string | null;
    email: string | null;
    phone: string | null;
    street: string | null;
    zip: string | null;
    city: string | null;
    logoStoredName?: string;
  } = {
    legalName: String(formData.get("legalName") ?? "").trim().slice(0, 200) || null,
    primaryColor: normalizeHex(String(formData.get("primaryColor") ?? "")),
    email: String(formData.get("email") ?? "").trim().slice(0, 200) || null,
    phone: String(formData.get("phone") ?? "").trim().slice(0, 50) || null,
    street: String(formData.get("street") ?? "").trim().slice(0, 200) || null,
    zip: String(formData.get("zip") ?? "").trim().slice(0, 20) || null,
    city: String(formData.get("city") ?? "").trim().slice(0, 100) || null,
  };

  const name = String(formData.get("name") ?? "").trim().slice(0, 200);
  if (name) data.name = name;

  // Logo nur ersetzen, wenn ein neues hochgeladen wurde.
  const file = formData.get("logo");
  if (file instanceof File && file.size > 0) {
    const upload = await saveUpload(file, IMAGE_TYPES);
    const current = await db.organization.findUnique({
      where: { id: actor.organizationId },
      select: { logoStoredName: true },
    });
    if (current?.logoStoredName) await deleteBlob(current.logoStoredName);
    data.logoStoredName = upload.storedName;
  }

  await db.organization.update({ where: { id: actor.organizationId }, data });
  revalidatePath("/", "layout");
}

// Branding-Einstellungen aus der Verwaltung speichern.
export async function updateBranding(formData: FormData) {
  try {
    await saveBranding(formData);
    redirect("/verwaltung/branding?gespeichert=1");
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    redirect(`/verwaltung/branding?fehler=${encodeURIComponent(errorMessage(e))}`);
  }
}

// Onboarding-Abschluss: gleiche Daten speichern, danach ins Dashboard.
export async function completeOnboarding(formData: FormData) {
  try {
    await saveBranding(formData);
    redirect("/dashboard");
  } catch (e) {
    if (isNextControlFlowError(e)) throw e;
    redirect(`/onboarding?fehler=${encodeURIComponent(errorMessage(e))}`);
  }
}
