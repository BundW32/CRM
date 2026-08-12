// Serverseite der Willkommensaktion: Wie viele Plätze sind weg, und darf diese
// Registrierung die Aktion bekommen? Die Regeln selbst stehen in `aktion.ts`
// (rein, damit sie prüfbar sind) — hier kommt nur die Datenbank dazu.
//
// Aufteilung wie bei `branding.ts` / `branding-server.ts`: Wer die Fakten der
// Aktion braucht (Text, Code, Enddatum), soll dafür nicht den Prisma-Client
// hereinziehen.
import { cache } from "react";
import { db } from "./db";
import { isWegSaas } from "./app-mode";
import {
  AKTIONS_QUELLE,
  aktionsLink,
  aktionsStand,
  istAktionsCode,
  type AktionsStand,
} from "./aktion";

/**
 * Der Stand der Aktion für diese Anfrage — `null`, wenn sie vorbei ist.
 *
 * `cache()` je Anfrage: Kopfzeilen-Banner, Hero-Hinweis und Preisseite fragen
 * denselben Stand ab, das darf nicht drei Zählabfragen kosten.
 *
 * Zwei Grenzen bewusst so:
 * - **Nur in der WEG-SaaS-Tür.** Die Aktion wirbt für die öffentliche
 *   Selbstverwalter-Registrierung; die B&W-Tür hat keine.
 * - **Fehler heißt „keine Aktion".** Ein Werbebanner darf keine Startseite zu
 *   Fall bringen, und eine Zählabfrage, die nicht antwortet, darf keine Plätze
 *   verschenken. Beides führt hier zu `null`.
 */
export const aktuellerAktionsStand = cache(async (): Promise<AktionsStand | null> => {
  if (!isWegSaas()) return null;
  try {
    // Der Zähler sind die über die Aktion angelegten Gemeinschaften. Nach dem
    // Ende der Aktion kann er höher liegen als die Zahl der Gewährungen (wer
    // den Werbelink später noch aufruft, behält ihn als Herkunft) — dann ist
    // die Aktion ohnehin vorbei und der Zähler ohne Wirkung.
    const genutzt = await db.organization.count({ where: { referralSource: AKTIONS_QUELLE } });
    return aktionsStand(genutzt);
  } catch {
    return null;
  }
});

/**
 * Der Weg zur Registrierung — mit Aktionscode, solange die Aktion läuft.
 *
 * DIE eine Stelle, die das entscheidet. Jeder Knopf der Marken-Seiten fragt
 * hier: Kopfzeile, Hero, Abschluss-Band, mobile Leiste. Ein Knopf, der den Code
 * nicht mitnimmt, führt in eine Registrierung ohne Angebot — und der Besucher
 * müsste ihn abschreiben, obwohl er gerade darauf geklickt hat.
 */
export async function registrierenLink(): Promise<string> {
  return (await aktuellerAktionsStand()) ? aktionsLink() : "/registrieren";
}

/**
 * Bekommt diese Registrierung die Aktion? Geprüft wird beides: der Code (aus
 * dem Formularfeld ODER aus dem Werbelink) und der Stand der Aktion.
 *
 * Serverseitig, weil das Formularfeld aus dem Browser kommt: Ein Feld allein
 * hält keine Platzgrenze und keinen Zeitraum ein.
 *
 * Die Platzgrenze ist bewusst „bestmöglich": Zwei Registrierungen in derselben
 * Sekunde können beide den letzten Platz sehen. Für einen Start-Anreiz ist das
 * belanglos — eine Sperre über eine Transaktion mit Zeilensperre wäre hier
 * Aufwand ohne Nutzen. Deshalb wirbt die Seite mit „für die ersten N", nicht
 * mit „genau N".
 */
export async function aktionGewaehrt(
  codeEingabe: string | null | undefined,
  herkunft: string | null | undefined,
): Promise<boolean> {
  if (!istAktionsCode(codeEingabe) && !istAktionsCode(herkunft)) return false;
  return (await aktuellerAktionsStand()) !== null;
}
