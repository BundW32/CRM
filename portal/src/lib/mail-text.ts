// Aufbau der Mailtexte.
//
// Gewachsen war ein Flickenteppich: Von 22 Mails hatten neun eine Anrede und
// dreizehn keine, sieben endeten ohne Grußformel, und die Handlungsaufforderung
// stand mal als „Zum Vorgang: <link>" da, mal mit Beschriftung und Link auf
// getrennten Zeilen. Letzteres ist nicht nur uneinheitlich: Das Mail-Layout
// erkennt nur die einzeilige Form und macht daraus einen Knopf — bei getrennten
// Zeilen blieb die Aufforderung eine nackte URL im Fließtext.
//
// Deshalb ein Bauplan statt zusammengesetzter Zeichenketten. Die Reihenfolge
// (Anrede → Inhalt → Aufforderung → Gruß) liegt damit an einer Stelle fest und
// nicht in 22 Zeichenketten-Ketten verstreut.
import type { OrgBranding } from "./branding";

// Länge, ab der eine Knopfbeschriftung im Layout nicht mehr sauber umbricht.
// Dieselbe Grenze prüft der Erkenner in mailer.ts.
const MAX_LABEL = 40;

export type MailAction = { label: string; url: string };

export type MailTextOptions = {
  /** Name des Empfängers. Fehlt er, entfällt die Anrede — besser als „Guten Tag ,". */
  anrede?: string | null;
  /** Inhaltsabsätze. `null`/`false` fallen raus, damit bedingte Absätze inline bleiben. */
  absaetze: (string | null | undefined | false)[];
  /** Die eine Handlungsaufforderung der Mail; wird zum Knopf. */
  aktion?: MailAction | null;
  /** Grußformel. `null` unterdrückt sie (z. B. bei reinen System-Hinweisen). */
  gruss?: string | null;
  branding: OrgBranding;
};

/**
 * Zeilenweiser Datenblock („Objekt: …", „Termin: …") als **ein** Absatz.
 * Leere Werte fallen weg, statt eine Zeile „Ort: " zu hinterlassen.
 */
export function datenblock(zeilen: [string, string | null | undefined | false][]): string | null {
  const gefuellt = zeilen
    .filter(([, wert]) => typeof wert === "string" && wert.trim() !== "")
    .map(([bezeichnung, wert]) => `${bezeichnung}: ${String(wert).trim()}`);
  return gefuellt.length > 0 ? gefuellt.join("\n") : null;
}

/** Baut den Fließtext einer Mail. Ergebnis ist zugleich der Nur-Text-Teil. */
export function mailText(opts: MailTextOptions): string {
  const bloecke: string[] = [];

  if (opts.anrede?.trim()) bloecke.push(`Guten Tag ${opts.anrede.trim()},`);

  for (const absatz of opts.absaetze) {
    if (typeof absatz === "string" && absatz.trim() !== "") bloecke.push(absatz.trim());
  }

  if (opts.aktion) {
    // Die Beschriftung darf keinen Doppelpunkt und keinen Zeilenumbruch tragen –
    // beides zerlegt die Zeile und der Knopf entfällt stillschweigend.
    const label = opts.aktion.label
      .replace(/[\r\n]+/g, " ")
      .replace(/:/g, "")
      .trim()
      .slice(0, MAX_LABEL)
      .trim();
    bloecke.push(`${label}: ${opts.aktion.url}`);
  }

  // Grußformel: `undefined` heißt „Standard", `null` heißt „bewusst keine".
  if (opts.gruss !== null) {
    bloecke.push(`${opts.gruss ?? "Mit freundlichen Grüßen"}\n${opts.branding.legalName}`);
  }

  return bloecke.join("\n\n");
}
