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
import { briefAnrede, type Empfaenger } from "./documents/anrede";

// Länge, ab der eine Knopfbeschriftung im Layout nicht mehr sauber umbricht.
// Dieselbe Grenze prüft der Erkenner in mailer.ts.
const MAX_LABEL = 40;

export type MailAction = { label: string; url: string };

export type MailTextOptions = {
  /**
   * Der Empfänger — daraus entsteht die Anrede.
   *
   * Es gilt dieselbe Regel wie bei den Briefen (`documents/anrede.ts`):
   * „Sehr geehrte Frau Şahin," wenn Anrede und Nachname bekannt sind, sonst
   * „Guten Tag <voller Name>,". Mehrere Empfänger in einem Namensfeld
   * (Eheleute, Erbengemeinschaft) erkennt der Helfer am Komma und weicht auf
   * „Sehr geehrte Damen und Herren," aus.
   *
   * Fehlt der Empfänger ganz, entfällt die Anrede — besser als „Guten Tag ,".
   * Eine fertige Zeichenkette gilt als vollständige Anredezeile und wird
   * unverändert übernommen (Sonderfall Handwerker: dort gibt es kein
   * Nutzerkonto und damit keine hinterlegte Anrede).
   */
  anrede?: Empfaenger | string | null;
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

  const anrede = opts.anrede;
  if (typeof anrede === "string") {
    if (anrede.trim()) bloecke.push(`Guten Tag ${anrede.trim()},`);
  } else if (anrede?.name?.trim()) {
    bloecke.push(briefAnrede(anrede));
  }

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
