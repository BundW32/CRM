"use server";

import { requireVerwalter } from "@/lib/session";
import {
  BELEG_MIME_TYPES,
  extractRechnung,
  isBelegErkennungEnabled,
  vorschlagBezeichnung,
} from "@/lib/weg/beleg-erkennung";
import { loadWegProperty } from "@/lib/weg/scope";

const MAX_BELEG_SIZE = 15 * 1024 * 1024; // 15 MB (Gemini Inline-Grenze)

/** Die Felder des Formulars, so wie sie in die Eingabefelder gehören. */
export type BelegVorschlag = {
  title: string;
  creditor: string;
  /** Deutsche Schreibweise, z. B. „1.250,00". */
  amount: string;
  /** YYYY-MM-DD für das Datumsfeld. */
  incurredOn: string;
  dueDate: string;
  note: string;
};

export type BelegErkennungResult =
  | { ok: true; data: BelegVorschlag }
  | { ok: false; error: string };

// Wird imperativ aus dem Formular aufgerufen: Beleg hochladen → Felder per KI
// lesen und als Vorschlag zurückgeben. Speichert nichts — der Verwalter prüft
// und korrigiert die Werte anschließend im Formular und schickt es selbst ab.
export async function erkenneBeleg(formData: FormData): Promise<BelegErkennungResult> {
  const verwalter = await requireVerwalter();
  // Objekt-Scope wie bei jeder Aktion des Bereichs — auch wenn hier nichts
  // gespeichert wird: Die Funktion kostet Geld und darf nur im eigenen Objekt
  // aufgerufen werden.
  const property = await loadWegProperty(verwalter, String(formData.get("propertyId") ?? ""));
  if (!property) return { ok: false, error: "Keine Berechtigung." };
  if (!isBelegErkennungEnabled()) {
    return { ok: false, error: "Die Belegerkennung ist nicht aktiviert." };
  }

  const file = formData.get("beleg");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Bitte eine Rechnung als PDF oder Foto auswählen." };
  }
  if (!(BELEG_MIME_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, error: "Es werden PDF, JPEG, PNG und WebP unterstützt." };
  }
  if (file.size > MAX_BELEG_SIZE) {
    return { ok: false, error: "Die Datei ist größer als 15 MB." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const r = await extractRechnung(buffer, file.type);
  if (!r) {
    return { ok: false, error: "Aus dem Beleg konnten keine Daten gelesen werden. Bitte von Hand erfassen." };
  }
  return {
    ok: true,
    data: {
      title: vorschlagBezeichnung(r),
      creditor: r.creditor ?? "",
      amount: r.grossCents != null ? (r.grossCents / 100).toFixed(2).replace(".", ",") : "",
      incurredOn: r.invoiceDate ?? "",
      dueDate: r.dueDate ?? "",
      note: r.invoiceNumber && !vorschlagBezeichnung(r).includes(r.invoiceNumber)
        ? `Rechnungsnr. ${r.invoiceNumber}`
        : "",
    },
  };
}
