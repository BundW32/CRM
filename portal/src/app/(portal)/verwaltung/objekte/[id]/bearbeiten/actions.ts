"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canVerwalterAccessProperty } from "@/lib/access";
import { db } from "@/lib/db";
import { requireVerwalter } from "@/lib/session";
import { IMAGE_TYPES, deleteBlob, saveUpload } from "@/lib/storage";

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
