"use server";

import { requireVerwalter } from "@/lib/session";
import {
  extractObjektFromPdf,
  isObjektImportEnabled,
  type ExtractedObjekt,
} from "@/lib/objekt-extraction";

const MAX_PDF_SIZE = 15 * 1024 * 1024; // 15 MB (Gemini Inline-Grenze)

export type ExtractResult =
  | { ok: true; data: ExtractedObjekt }
  | { ok: false; error: string };

// Wird imperativ aus dem Anlage-Formular aufgerufen: PDF hochladen → Felder per KI
// extrahieren und als Vorschlag zurückgeben. Speichert nichts – der Verwalter
// prüft/korrigiert die Werte anschließend im Formular.
export async function extractObjektFields(formData: FormData): Promise<ExtractResult> {
  const actor = await requireVerwalter();
  if (!actor.isSuperAdmin) return { ok: false, error: "Keine Berechtigung." };
  if (!isObjektImportEnabled()) {
    return { ok: false, error: "Der KI-Import ist nicht aktiviert." };
  }

  const file = formData.get("pdf");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Bitte eine PDF-Datei auswählen." };
  }
  if (file.type !== "application/pdf") {
    return { ok: false, error: "Es werden nur PDF-Dateien unterstützt." };
  }
  if (file.size > MAX_PDF_SIZE) {
    return { ok: false, error: "Die PDF-Datei ist größer als 15 MB." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const data = await extractObjektFromPdf(buffer, file.type);
  if (!data) {
    return { ok: false, error: "Aus dem PDF konnten keine Daten gelesen werden." };
  }
  return { ok: true, data };
}
