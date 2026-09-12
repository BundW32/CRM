"use server";

import { requireVerwalter } from "@/lib/session";
import {
  BELEG_MIME_TYPES,
  extractRechnung,
  isBelegErkennungEnabled,
  vorschlagBezeichnung,
  type ErkannteRechnung,
} from "@/lib/weg/beleg-erkennung";
import { LOKALE_MIME_TYPES, erkenneBelegLokal } from "@/lib/weg/beleg-lokal";
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
  | {
      ok: true;
      data: BelegVorschlag;
      /** Woher die Werte stammen — die Oberfläche sagt es dazu. */
      quelle: "e-rechnung" | "text" | "ki";
    }
  | {
      ok: false;
      error: string;
      /**
       * Lokal war nichts zu lesen (Scan, Foto), aber die KI-Erkennung ist
       * freigeschaltet: Die Oberfläche bietet sie dann als zweiten Schritt an —
       * mit dem Datenschutzhinweis, nie von selbst.
       */
      kiMoeglich?: boolean;
    };

function alsVorschlag(r: ErkannteRechnung): BelegVorschlag {
  const title = vorschlagBezeichnung(r);
  return {
    title,
    creditor: r.creditor ?? "",
    amount: r.grossCents != null ? (r.grossCents / 100).toFixed(2).replace(".", ",") : "",
    incurredOn: r.invoiceDate ?? "",
    dueDate: r.dueDate ?? "",
    note: r.invoiceNumber && !title.includes(r.invoiceNumber) ? `Rechnungsnr. ${r.invoiceNumber}` : "",
  };
}

/**
 * Wird imperativ aus dem Formular aufgerufen: Beleg hochladen → Felder lesen
 * und als Vorschlag zurückgeben. Speichert nichts — der Verwalter prüft und
 * korrigiert die Werte anschließend im Formular und schickt es selbst ab.
 *
 * Zwei Wege, die der Aufrufer ausdrücklich wählt (`weg`):
 * - `lokal` (Vorgabe): E-Rechnung-XML oder Textebene der PDF, alles auf dem
 *   Server. Braucht keinen Schlüssel und keine Freigabe.
 * - `ki`: die Datei geht vollständig an Google. Nur mit freigeschalteter
 *   Funktion UND dem bestätigten Datenschutzhinweis (`kiFreigabe=ja`) —
 *   der Server verlässt sich nicht darauf, dass die Oberfläche das Häkchen
 *   verlangt hat.
 */
export async function erkenneBeleg(formData: FormData): Promise<BelegErkennungResult> {
  const verwalter = await requireVerwalter();
  // Objekt-Scope wie bei jeder Aktion des Bereichs — auch wenn hier nichts
  // gespeichert wird: Die Funktion kostet Rechenzeit bzw. Geld und darf nur im
  // eigenen Objekt aufgerufen werden.
  const property = await loadWegProperty(verwalter, String(formData.get("propertyId") ?? ""));
  if (!property) return { ok: false, error: "Keine Berechtigung." };

  const file = formData.get("beleg");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Bitte eine Rechnung auswählen." };
  }
  if (file.size > MAX_BELEG_SIZE) {
    return { ok: false, error: "Die Datei ist größer als 15 MB." };
  }

  const weg = formData.get("weg") === "ki" ? "ki" : "lokal";

  if (weg === "ki") {
    if (!isBelegErkennungEnabled()) {
      return { ok: false, error: "Die KI-Belegerkennung ist nicht aktiviert." };
    }
    if (formData.get("kiFreigabe") !== "ja") {
      return {
        ok: false,
        error: "Bitte bestätigen Sie zuerst den Datenschutzhinweis zur Übermittlung an Google.",
      };
    }
    if (!(BELEG_MIME_TYPES as readonly string[]).includes(file.type)) {
      return { ok: false, error: "Für die KI-Erkennung werden PDF, JPEG, PNG und WebP unterstützt." };
    }
    const r = await extractRechnung(Buffer.from(await file.arrayBuffer()), file.type);
    if (!r) {
      return { ok: false, error: "Die KI konnte aus dem Beleg nichts lesen. Bitte von Hand erfassen." };
    }
    return { ok: true, data: alsVorschlag(r), quelle: "ki" };
  }

  const kiMoeglich = isBelegErkennungEnabled();
  if (!(LOKALE_MIME_TYPES as readonly string[]).includes(file.type)) {
    return {
      ok: false,
      error: kiMoeglich
        ? "Fotos lassen sich nur mit der KI-Erkennung lesen (siehe unten) — oder Sie erfassen die Rechnung von Hand."
        : "Ohne KI werden PDF und E-Rechnung (XML) gelesen. Fotos erfassen Sie bitte von Hand.",
      kiMoeglich,
    };
  }
  let lokal;
  try {
    lokal = await erkenneBelegLokal(new Uint8Array(await file.arrayBuffer()), file.type);
  } catch (err) {
    // Ein technischer Fehler ist keine Eigenschaft der Datei. Er landet im
    // Serverprotokoll und wird der Verwaltung als solcher gemeldet — nicht als
    // „vermutlich ein Scan".
    console.error("Belegerkennung (lokal) fehlgeschlagen", { datei: file.name, typ: file.type, groesse: file.size }, err);
    return {
      ok: false,
      error:
        "Die Datei konnte technisch nicht gelesen werden — das liegt nicht an Ihrer Rechnung. " +
        "Bitte erfassen Sie sie von Hand und melden Sie uns den Fall, wir schauen ins Protokoll.",
    };
  }
  if (!lokal) {
    return {
      ok: false,
      error: kiMoeglich
        ? "Die Datei enthält keinen lesbaren Text (vermutlich ein Scan). Sie können sie mit der KI-Erkennung lesen lassen — oder von Hand erfassen."
        : "Die Datei enthält keinen lesbaren Text (vermutlich ein Scan). Bitte von Hand erfassen.",
      kiMoeglich,
    };
  }
  return { ok: true, data: alsVorschlag(lokal.daten), quelle: lokal.quelle };
}
